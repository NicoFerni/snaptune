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

    // Signs carry the direction, not colour: "+12¢", "−38¢" (a real minus sign).
    juce::String signedCents (float cents)
    {
        const int rounded = juce::roundToInt (cents);
        const auto sign = rounded > 0 ? juce::String ("+") : (rounded < 0 ? juce::String::fromUTF8 ("\xe2\x88\x92") : juce::String());
        return sign + juce::String (std::abs (rounded)) + juce::String::fromUTF8 ("\xc2\xa2");
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

    // Tell VoiceOver when the note or status changes, not on every cent.
    const auto now = juce::String (active ? note : -1) + statusText();

    if (now != announced)
    {
        announced = now;

        if (auto* handler = getAccessibilityHandler())
            handler->notifyAccessibilityEvent (juce::AccessibilityEvent::valueChanged);
    }
}

juce::String TunerGauge::statusText() const
{
    if (! active)
        return "Listening";

    return std::abs (targetOutput) < 3.0f ? "Output in tune" : "Correcting";
}

juce::String TunerGauge::describe() const
{
    if (! active || note < 0)
        return "Listening";

    const auto cents = [] (float c) { return juce::String (juce::roundToInt (c)) + " cents"; };
    return juce::String (noteName (note)).replace ("#", " sharp") + juce::String (noteOctave (note)) + ", "
           + statusText().toLowerCase() + ", sung " + cents (targetInput) + ", output " + cents (targetOutput);
}

std::unique_ptr<juce::AccessibilityHandler> TunerGauge::createAccessibilityHandler()
{
    struct Readout final : public juce::AccessibilityTextValueInterface
    {
        explicit Readout (const TunerGauge& g) : gauge (g) {}

        bool isReadOnly() const override { return true; }
        juce::String getCurrentValueAsString() const override { return gauge.describe(); }
        void setValueAsString (const juce::String&) override {}

        const TunerGauge& gauge;
    };

    return std::make_unique<juce::AccessibilityHandler> (*this, juce::AccessibilityRole::staticText, juce::AccessibilityActions(),
                                                         juce::AccessibilityHandler::Interfaces { std::make_unique<Readout> (*this) });
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
    const PathStrokeType arcStroke (7.0f, PathStrokeType::curved, PathStrokeType::butt);

    auto arc = [&] (float fromCents, float toCents)
    {
        Path p;
        p.addCentredArc (centre.x, centre.y, radius, radius, 0.0f, angleFor (fromCents), angleFor (toCents), true);
        return p;
    };

    // Track and the "in tune" window.
    g.setColour (palette::lineBright);
    g.strokePath (arc (-rangeCents, rangeCents), arcStroke);
    g.setColour (palette::accent.withAlpha (0.28f));
    g.strokePath (arc (-5.0f, 5.0f), arcStroke);

    // Ticks every 10 cents with labels at the ends.
    for (int cents = -50; cents <= 50; cents += 10)
    {
        const float a = angleFor ((float) cents);
        const bool major = cents % 50 == 0;
        g.setColour (major ? palette::textDim : palette::lineBright);
        g.drawLine (Line<float> (centre.getPointOnCircumference (radius + 8.0f, a), centre.getPointOnCircumference (radius + (major ? 16.0f : 12.0f), a)),
                    major ? 1.4f : 1.0f);
    }

    g.setFont (labelFont (12.0f));
    g.setColour (palette::textDim);

    for (int cents : { -50, 50 })
        g.drawText (cents < 0 ? String::fromUTF8 ("\xe2\x88\x92" "50") : String ("+50"),
                    Rectangle<float> (38.0f, 14.0f).withCentre (centre.getPointOnCircumference (radius - 24.0f, angleFor ((float) cents))),
                    Justification::centred);

    if (presence > 0.01f)
    {
        // Correction span: from where it was sung to where it lands.
        g.setColour (palette::accent.withAlpha (0.35f * presence));
        g.strokePath (arc (jmin (shownInput, shownOutput), jmax (shownInput, shownOutput)), PathStrokeType (3.0f));

        // Sung pitch.
        const auto sung = centre.getPointOnCircumference (radius, angleFor (shownInput));
        g.setColour (palette::input.withAlpha (presence));
        g.fillEllipse (Rectangle<float> (12.0f, 12.0f).withCentre (sung));
        g.setColour (palette::panel.withAlpha (presence));
        g.drawEllipse (Rectangle<float> (14.0f, 14.0f).withCentre (sung), 2.0f);

        // Corrected pitch needle.
        const float outAngle = angleFor (shownOutput);
        Path needle;
        needle.startNewSubPath (centre.getPointOnCircumference (radius * 0.78f, outAngle));
        needle.lineTo (centre.getPointOnCircumference (radius + 6.0f, outAngle));
        g.setColour (palette::accent.withAlpha (presence));
        g.strokePath (needle, PathStrokeType (3.0f, PathStrokeType::curved, PathStrokeType::butt));
    }

    // Note name in the middle, octave as a smaller suffix.
    const auto textArea = Rectangle<float> (radius * 1.5f, 62.0f).withCentre (centre.translated (0.0f, -radius * 0.5f));
    const bool hasNote = note >= 0 && presence > 0.05f;

    AttributedString name;
    name.setJustification (Justification::centred);
    const auto noteColour = hasNote ? palette::text.interpolatedWith (palette::textFaint, 1.0f - presence) : palette::textFaint;
    name.append (hasNote ? noteName (note) : "--", displayFont (58.0f), noteColour);

    if (hasNote)
        name.append (String (noteOctave (note)), displayFont (26.0f), noteColour.withAlpha (0.6f));

    name.draw (g, textArea);

    // Status line and the two readouts.
    const bool locked = std::abs (targetOutput) < 3.0f;
    g.setFont (labelFont (12.5f));
    g.setColour (! active ? palette::textDim : (locked ? palette::accent : palette::textDim));
    g.drawText (statusText(),
                Rectangle<float> (180.0f, 16.0f).withCentre (centre.translated (0.0f, -radius * 0.5f + 38.0f)), Justification::centred);

    const float readoutY = arcEndY + 13.0f;
    auto readout = [&] (float x, Justification just, Colour colour, const String& label, const String& value)
    {
        g.setFont (labelFont (12.0f));
        g.setColour (palette::textDim);
        g.drawText (label, Rectangle<float> (x, readoutY, 90.0f, 15.0f), just);
        g.setFont (uiFont (17.0f, true));
        g.setColour (colour);
        g.drawText (value, Rectangle<float> (x, readoutY + 16.0f, 90.0f, 21.0f), just);
    };

    const auto inputColour = active ? palette::input : palette::textFaint;
    const auto outputColour = active ? palette::accent : palette::textFaint;
    readout (bounds.getX() + 14.0f, Justification::centredLeft, inputColour, "Sung", active ? signedCents (targetInput) : String ("--"));
    readout (bounds.getRight() - 104.0f, Justification::centredRight, outputColour, "Output", active ? signedCents (targetOutput) : String ("--"));
}
} // namespace snaptune
