#include "TunerGauge.h"
#include "../dsp/Scales.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
namespace
{
    constexpr float rangeCents = 50.0f;
    constexpr float sweep = juce::MathConstants<float>::pi * 0.42f; // each side of 12 o'clock

    float angleFor (float cents) { return juce::jlimit (-1.0f, 1.0f, cents / rangeCents) * sweep; }

    juce::String signedCents (float cents)
    {
        const int rounded = juce::roundToInt (cents);
        return (rounded > 0 ? "+" : "") + juce::String (rounded) + juce::String::fromUTF8 ("\xc2\xa2");
    }
} // namespace

void TunerGauge::setState (bool isActive, int targetNote, float inputCents, float outputCents)
{
    active = isActive;

    if (isActive)
    {
        note = targetNote;
        targetInput = inputCents;
        targetOutput = outputCents;
    }
}

void TunerGauge::animate()
{
    const float before = shownInput + shownOutput + presence;
    shownInput += 0.35f * (targetInput - shownInput);
    shownOutput += 0.35f * (targetOutput - shownOutput);
    presence += (active ? 0.3f : 0.08f) * ((active ? 1.0f : 0.0f) - presence);

    if (std::abs (shownInput + shownOutput + presence - before) > 0.002f)
        repaint();
}

void TunerGauge::paint (juce::Graphics& g)
{
    using namespace juce;

    const auto bounds = getLocalBounds().toFloat();
    const float radius = jmin (bounds.getWidth() * 0.39f, bounds.getHeight() * 0.72f);
    const Point<float> centre (bounds.getCentreX(), bounds.getY() + radius + 24.0f);
    const float arcEndY = centre.y - radius * std::cos (sweep);
    const PathStrokeType arcStroke (9.0f, PathStrokeType::curved, PathStrokeType::rounded);

    auto arc = [&] (float fromCents, float toCents)
    {
        Path p;
        p.addCentredArc (centre.x, centre.y, radius, radius, 0.0f, angleFor (fromCents), angleFor (toCents), true);
        return p;
    };

    // Track and the "in tune" window.
    g.setColour (palette::outline);
    g.strokePath (arc (-rangeCents, rangeCents), arcStroke);
    g.setColour (palette::accent.withAlpha (0.22f));
    g.strokePath (arc (-5.0f, 5.0f), arcStroke);

    // Ticks every 10 cents with labels at the ends and the centre.
    for (int cents = -50; cents <= 50; cents += 10)
    {
        const float a = angleFor ((float) cents);
        const bool major = cents % 50 == 0;
        g.setColour (major ? palette::textDim : palette::outlineBright);
        g.drawLine (Line<float> (centre.getPointOnCircumference (radius + 9.0f, a), centre.getPointOnCircumference (radius + (major ? 17.0f : 13.0f), a)),
                    major ? 1.6f : 1.0f);
    }

    g.setFont (captionFont (9.0f));
    g.setColour (palette::textFaint);

    for (int cents : { -50, 50 })
        g.drawText (cents < 0 ? "-50" : "+50",
                    Rectangle<float> (34.0f, 12.0f).withCentre (centre.getPointOnCircumference (radius - 24.0f, angleFor ((float) cents))),
                    Justification::centred);

    if (presence > 0.01f)
    {
        // Correction span: from where it was sung to where it lands.
        g.setColour (palette::accent.withAlpha (0.4f * presence));
        g.strokePath (arc (jmin (shownInput, shownOutput), jmax (shownInput, shownOutput)), PathStrokeType (3.0f));

        // Sung pitch.
        const auto sung = centre.getPointOnCircumference (radius, angleFor (shownInput));
        g.setColour (palette::input.withAlpha (0.25f * presence));
        g.fillEllipse (Rectangle<float> (22.0f, 22.0f).withCentre (sung));
        g.setColour (palette::input.withAlpha (presence));
        g.fillEllipse (Rectangle<float> (11.0f, 11.0f).withCentre (sung));

        // Corrected pitch needle.
        const float outAngle = angleFor (shownOutput);
        Path needle;
        needle.startNewSubPath (centre.getPointOnCircumference (radius * 0.8f, outAngle));
        needle.lineTo (centre.getPointOnCircumference (radius + 6.0f, outAngle));
        strokeWithGlow (g, needle, FillType (palette::accent.withAlpha (presence)), 3.0f, 10.0f, 0.2f);
    }

    // Note name in the middle, octave as a smaller suffix.
    const auto textArea = Rectangle<float> (radius * 1.5f, 62.0f).withCentre (centre.translated (0.0f, -radius * 0.5f));
    const bool hasNote = note >= 0 && presence > 0.05f;

    AttributedString name;
    name.setJustification (Justification::centred);
    const auto noteColour = hasNote ? palette::text.interpolatedWith (palette::textFaint, 1.0f - presence) : palette::textFaint;
    name.append (hasNote ? noteName (note) : "--", uiFont (52.0f, true), noteColour);

    if (hasNote)
        name.append (String (noteOctave (note)), uiFont (22.0f, true), noteColour.withAlpha (0.55f));

    name.draw (g, textArea);

    // Status line and the two readouts.
    const bool locked = std::abs (targetOutput) < 3.0f;
    g.setFont (captionFont (10.0f));
    g.setColour (! active ? palette::textFaint : (locked ? palette::accent : palette::textDim));
    g.drawText (! active ? "LISTENING" : (locked ? "IN TUNE" : "CORRECTING"),
                Rectangle<float> (140.0f, 14.0f).withCentre (centre.translated (0.0f, -radius * 0.5f + 38.0f)), Justification::centred);

    const float readoutY = arcEndY + 14.0f;
    auto readout = [&] (float x, Justification just, Colour colour, const String& label, const String& value)
    {
        g.setFont (captionFont (9.0f));
        g.setColour (palette::textFaint);
        g.drawText (label, Rectangle<float> (x, readoutY, 90.0f, 12.0f), just);
        g.setFont (uiFont (16.0f, true));
        g.setColour (colour);
        g.drawText (value, Rectangle<float> (x, readoutY + 13.0f, 90.0f, 20.0f), just);
    };

    const auto inputColour = active ? palette::input : palette::textFaint;
    const auto outputColour = active ? palette::accent : palette::textFaint;
    readout (bounds.getX() + 14.0f, Justification::centredLeft, inputColour, "SUNG", active ? signedCents (targetInput) : String ("--"));
    readout (bounds.getRight() - 104.0f, Justification::centredRight, outputColour, "OUTPUT", active ? signedCents (targetOutput) : String ("--"));
}
} // namespace snaptune
