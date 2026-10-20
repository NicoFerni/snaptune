#include "SnapLookAndFeel.h"
#include "SnapTuneFonts.h"

namespace snaptune
{
namespace
{
    juce::Typeface::Ptr loadTypeface (const char* data, int size)
    {
        return juce::Typeface::createSystemTypefaceFor (data, (size_t) size);
    }

    const juce::Typeface::Ptr& literataRegular()
    {
        static const auto typeface = loadTypeface (SnapTuneFonts::LiterataRegular_ttf, SnapTuneFonts::LiterataRegular_ttfSize);
        return typeface;
    }

    const juce::Typeface::Ptr& literataSemiBold()
    {
        static const auto typeface = loadTypeface (SnapTuneFonts::LiterataSemiBold_ttf, SnapTuneFonts::LiterataSemiBold_ttfSize);
        return typeface;
    }

    const juce::Typeface::Ptr& rokkittExtraBold()
    {
        static const auto typeface = loadTypeface (SnapTuneFonts::RokkittExtraBold_ttf, SnapTuneFonts::RokkittExtraBold_ttfSize);
        return typeface;
    }
} // namespace

juce::Font uiFont (float height, bool bold)
{
    return juce::Font (juce::FontOptions().withTypeface (bold ? literataSemiBold() : literataRegular()).withHeight (height));
}

juce::Font displayFont (float height)
{
    return juce::Font (juce::FontOptions().withTypeface (rokkittExtraBold()).withHeight (height));
}

juce::Font labelFont (float height)
{
    return uiFont (height);
}

void drawFocusRing (juce::Graphics& g, juce::Rectangle<float> bounds, float radius)
{
    g.setColour (palette::accent);
    g.drawRoundedRectangle (bounds.reduced (1.0f), radius, 2.0f);
}

void drawPanel (juce::Graphics& g, juce::Rectangle<float> bounds, float radius)
{
    g.setColour (palette::panel);
    g.fillRoundedRectangle (bounds, radius);
    g.setColour (palette::line);
    g.drawRoundedRectangle (bounds.reduced (0.5f), radius, 1.0f);
}

void drawLogo (juce::Graphics& g, juce::Rectangle<float> r)
{
    using namespace juce;

    // Drawn on a 48-unit grid: the arc's ends sit at 47 degrees either side of 3 o'clock.
    const float u = r.getWidth() / 48.0f;
    g.setColour (palette::accent);
    g.fillRoundedRectangle (r, 6.0f * u);

    Path arc;
    arc.addCentredArc (r.getX() + 24.0f * u, r.getY() + 24.0f * u, 13.0f * u, 13.0f * u, 0.0f, degreesToRadians (132.8f),
                       degreesToRadians (407.2f), true);
    g.setColour (palette::background);
    g.strokePath (arc, PathStrokeType (5.5f * u, PathStrokeType::mitered, PathStrokeType::butt));
    g.fillRect (Rectangle<float> (r.getX() + 21.25f * u, r.getY() + 6.0f * u, 5.5f * u, 36.0f * u));
}

//==============================================================================
SnapLookAndFeel::SnapLookAndFeel()
{
    using namespace juce;

    setDefaultSansSerifTypeface (literataRegular());

    setColour (ResizableWindow::backgroundColourId, palette::background);
    setColour (ComboBox::textColourId, palette::text);
    setColour (ComboBox::backgroundColourId, palette::raised);
    setColour (ComboBox::outlineColourId, palette::lineBright);
    setColour (ComboBox::arrowColourId, palette::textDim);
    setColour (PopupMenu::backgroundColourId, palette::raised);
    setColour (PopupMenu::textColourId, palette::text);
    setColour (PopupMenu::headerTextColourId, palette::textDim);
    setColour (PopupMenu::highlightedBackgroundColourId, palette::lineBright);
    setColour (PopupMenu::highlightedTextColourId, palette::text);
    setColour (Slider::textBoxTextColourId, palette::text);
    setColour (TooltipWindow::textColourId, palette::text);
}

void SnapLookAndFeel::drawRotarySlider (juce::Graphics& g, int x, int y, int width, int height, float sliderPos,
                                        float startAngle, float endAngle, juce::Slider& slider)
{
    const auto bounds = juce::Rectangle<int> (x, y, width, height).toFloat();

    if ((bool) slider.getProperties()["hero"])
        drawHeroKnob (g, bounds, sliderPos, startAngle, endAngle, slider);
    else
        drawSmallKnob (g, bounds, sliderPos, startAngle, endAngle, slider);
}

namespace
{
    void drawValueArc (juce::Graphics& g, juce::Point<float> centre, float radius, float thickness, float startAngle, float endAngle,
                       float angle, bool bipolar, juce::Colour colour, bool emphasised)
    {
        using namespace juce;

        const PathStrokeType stroke (thickness, PathStrokeType::curved, PathStrokeType::butt);
        Path track;
        track.addCentredArc (centre.x, centre.y, radius, radius, 0.0f, startAngle, endAngle, true);
        g.setColour (emphasised ? palette::lineBright.brighter (0.15f) : palette::lineBright);
        g.strokePath (track, stroke);

        const float origin = bipolar ? (startAngle + endAngle) * 0.5f : startAngle;

        if (std::abs (angle - origin) < 0.01f)
            return;

        Path value;
        value.addCentredArc (centre.x, centre.y, radius, radius, 0.0f, jmin (origin, angle), jmax (origin, angle), true);
        g.setColour (colour);
        g.strokePath (value, stroke);
    }

    void drawKnobBody (juce::Graphics& g, juce::Point<float> centre, float radius, bool emphasised)
    {
        const auto body = juce::Rectangle<float> (radius * 2.0f, radius * 2.0f).withCentre (centre);
        g.setColour (palette::raised);
        g.fillEllipse (body);
        g.setColour (emphasised ? palette::textDim.withAlpha (0.6f) : palette::lineBright);
        g.drawEllipse (body.reduced (0.5f), 1.0f);
    }
} // namespace

void SnapLookAndFeel::drawSmallKnob (juce::Graphics& g, juce::Rectangle<float> bounds, float sliderPos, float startAngle,
                                     float endAngle, juce::Slider& slider)
{
    using namespace juce;

    const bool emphasised = slider.isMouseOverOrDragging() && slider.isEnabled();
    auto knobArea = bounds.withTrimmedBottom (22.0f);
    const float size = jmin (knobArea.getWidth(), knobArea.getHeight());
    const auto area = knobArea.withSizeKeepingCentre (size, size).reduced (2.0f);
    const auto centre = area.getCentre();
    const float radius = area.getWidth() * 0.5f;
    const float angle = startAngle + sliderPos * (endAngle - startAngle);

    // Gold is kept for the output pitch and Retune Speed; the supporting knobs stay ivory.
    const auto arcColour = ! slider.isEnabled() ? palette::lineBright : (emphasised ? palette::text : palette::textDim);
    drawValueArc (g, centre, radius - 3.0f, 4.0f, startAngle, endAngle, angle, (bool) slider.getProperties()["bipolar"], arcColour,
                  emphasised);

    if (slider.hasKeyboardFocus (false))
        drawFocusRing (g, area.expanded (2.0f), radius + 2.0f);

    const float bodyRadius = radius - 11.0f;
    drawKnobBody (g, centre, bodyRadius, emphasised);

    Path pointer;
    pointer.startNewSubPath (centre.getPointOnCircumference (bodyRadius * 0.35f, angle));
    pointer.lineTo (centre.getPointOnCircumference (bodyRadius * 0.82f, angle));
    g.setColour (slider.isEnabled() ? palette::text : palette::textFaint);
    g.strokePath (pointer, PathStrokeType (2.4f, PathStrokeType::curved, PathStrokeType::butt));

    g.setColour (emphasised ? palette::text : palette::textDim);
    g.setFont (uiFont (13.0f, true));
    g.drawText (slider.getTextFromValue (slider.getValue()), bounds.removeFromBottom (18.0f), Justification::centred);
}

void SnapLookAndFeel::drawHeroKnob (juce::Graphics& g, juce::Rectangle<float> bounds, float sliderPos, float startAngle,
                                    float endAngle, juce::Slider& slider)
{
    using namespace juce;

    const bool emphasised = slider.isMouseOverOrDragging();
    const float size = jmin (bounds.getWidth(), bounds.getHeight());
    const auto area = bounds.withSizeKeepingCentre (size, size).reduced (6.0f);
    const auto centre = area.getCentre();
    const float radius = area.getWidth() * 0.5f;
    const float angle = startAngle + sliderPos * (endAngle - startAngle);

    // Tick ring: a scale to read the value against, not a second value display.
    for (int i = 0; i <= 20; ++i)
    {
        const float a = startAngle + (endAngle - startAngle) * (float) i / 20.0f;
        const bool major = i % 5 == 0;
        g.setColour (major ? palette::textDim.withAlpha (0.7f) : palette::lineBright);
        g.drawLine (Line<float> (centre.getPointOnCircumference (radius - (major ? 1.0f : 3.0f), a),
                                 centre.getPointOnCircumference (radius + 3.0f, a)),
                    major ? 1.4f : 1.0f);
    }

    const float arcRadius = radius - 11.0f;
    drawValueArc (g, centre, arcRadius, 5.0f, startAngle, endAngle, angle, false, palette::accent, emphasised);

    if (slider.hasKeyboardFocus (false))
        drawFocusRing (g, Rectangle<float> (radius * 2.0f + 10.0f, radius * 2.0f + 10.0f).withCentre (centre), radius + 5.0f);

    const float bodyRadius = radius - 20.0f;
    drawKnobBody (g, centre, bodyRadius, emphasised);

    // Handle riding the end of the value arc.
    const auto handle = centre.getPointOnCircumference (arcRadius, angle);
    g.setColour (palette::text);
    g.fillEllipse (Rectangle<float> (9.0f, 9.0f).withCentre (handle));

    g.setColour (palette::text);
    g.setFont (uiFont (18.0f, true));
    g.drawText (slider.getTextFromValue (slider.getValue()), Rectangle<float> (bodyRadius * 1.9f, 24.0f).withCentre (centre),
                Justification::centred);

    const auto startLabel = slider.getProperties()["startLabel"].toString();
    const auto endLabel = slider.getProperties()["endLabel"].toString();
    g.setFont (labelFont (12.0f));
    g.setColour (palette::textDim);
    const auto startPoint = centre.getPointOnCircumference (radius + 2.0f, startAngle);
    const auto endPoint = centre.getPointOnCircumference (radius + 2.0f, endAngle);
    g.drawText (startLabel, Rectangle<float> (60.0f, 14.0f).withCentre (startPoint.translated (-4.0f, 12.0f)), Justification::centred);
    g.drawText (endLabel, Rectangle<float> (60.0f, 14.0f).withCentre (endPoint.translated (4.0f, 12.0f)), Justification::centred);
}

void SnapLookAndFeel::drawComboBox (juce::Graphics& g, int width, int height, bool, int, int, int, int, juce::ComboBox& box)
{
    using namespace juce;

    const auto r = Rectangle<float> (0.0f, 0.0f, (float) width, (float) height).reduced (0.5f);
    g.setColour (palette::raised);
    g.fillRoundedRectangle (r, 4.0f);
    g.setColour (box.isMouseOver (true) ? palette::textDim.withAlpha (0.6f) : palette::lineBright);
    g.drawRoundedRectangle (r, 4.0f, 1.0f);

    if (box.hasKeyboardFocus (true))
        drawFocusRing (g, r.expanded (0.5f), 4.0f);

    const float cx = (float) width - 15.0f, cy = (float) height * 0.5f;
    Path chevron;
    chevron.startNewSubPath (cx - 4.0f, cy - 2.0f);
    chevron.lineTo (cx, cy + 2.0f);
    chevron.lineTo (cx + 4.0f, cy - 2.0f);
    g.setColour (palette::textDim);
    g.strokePath (chevron, PathStrokeType (1.6f, PathStrokeType::mitered, PathStrokeType::square));
}

juce::Font SnapLookAndFeel::getComboBoxFont (juce::ComboBox&)
{
    return uiFont (14.0f, true);
}

void SnapLookAndFeel::positionComboBoxText (juce::ComboBox& box, juce::Label& label)
{
    label.setBounds (8, 1, box.getWidth() - 28, box.getHeight() - 2);
    label.setFont (getComboBoxFont (box));
}

juce::Font SnapLookAndFeel::getPopupMenuFont()
{
    return uiFont (14.0f);
}

void SnapLookAndFeel::drawPopupMenuBackground (juce::Graphics& g, int width, int height)
{
    g.fillAll (palette::raised);
    g.setColour (palette::lineBright);
    g.drawRect (0, 0, width, height);
}

void SnapLookAndFeel::drawToggleButton (juce::Graphics& g, juce::ToggleButton& button, bool highlighted, bool)
{
    using namespace juce;

    // A box to tick, and when it's on, the one gold line under the label that marks a selection.
    const auto r = button.getLocalBounds().toFloat();
    const auto box = Rectangle<float> (16.0f, 16.0f).withCentre ({ r.getX() + 9.0f, r.getCentreY() });
    const bool on = button.getToggleState();

    g.setColour (on ? palette::text : palette::raised);
    g.fillRoundedRectangle (box, 3.0f);
    g.setColour (on ? palette::text : (highlighted ? palette::textDim.withAlpha (0.6f) : palette::lineBright));
    g.drawRoundedRectangle (box.reduced (0.5f), 3.0f, 1.0f);

    if (on)
    {
        Path tick;
        tick.startNewSubPath (box.getX() + 4.0f, box.getCentreY());
        tick.lineTo (box.getX() + 7.0f, box.getBottom() - 4.5f);
        tick.lineTo (box.getRight() - 3.5f, box.getY() + 4.5f);
        g.setColour (palette::background);
        g.strokePath (tick, PathStrokeType (2.0f, PathStrokeType::mitered, PathStrokeType::square));
    }

    if (button.hasKeyboardFocus (false))
        drawFocusRing (g, box.expanded (3.0f), 5.0f);

    const auto font = uiFont (13.0f, true);
    const auto labelArea = r.withLeft (box.getRight() + 8.0f);
    g.setColour (on || highlighted ? palette::text : palette::textDim);
    g.setFont (font);
    g.drawText (button.getButtonText(), labelArea, Justification::centredLeft);

    if (on)
    {
        const float textWidth = GlyphArrangement::getStringWidth (font, button.getButtonText());
        g.setColour (palette::accent);
        g.fillRect (Rectangle<float> (labelArea.getX(), labelArea.getCentreY() + 9.0f, textWidth, 1.0f));
    }
}

void SnapLookAndFeel::drawCornerResizer (juce::Graphics& g, int w, int h, bool isMouseOver, bool isMouseDragging)
{
    g.setColour ((isMouseOver || isMouseDragging) ? palette::textDim : palette::textFaint.withAlpha (0.6f));

    for (int row = 0; row < 3; ++row)
        for (int col = 2 - row; col < 3; ++col)
            g.fillEllipse ((float) w - 6.0f - (float) (2 - col) * 5.0f, (float) h - 6.0f - (float) (2 - row) * 5.0f, 2.2f, 2.2f);
}

juce::Rectangle<int> SnapLookAndFeel::getTooltipBounds (const juce::String& tipText, juce::Point<int> screenPos, juce::Rectangle<int> parentArea)
{
    juce::AttributedString text;
    text.append (tipText, uiFont (13.0f), palette::text);
    juce::TextLayout layout;
    layout.createLayoutWithBalancedLineLengths (text, 260.0f);

    const int w = (int) std::ceil (layout.getWidth()) + 22;
    const int h = (int) std::ceil (layout.getHeight()) + 16;
    return juce::Rectangle<int> (screenPos.x > parentArea.getCentreX() ? screenPos.x - (w + 12) : screenPos.x + 24,
                                 screenPos.y > parentArea.getCentreY() ? screenPos.y - (h + 6) : screenPos.y + 6, w, h)
        .constrainedWithin (parentArea);
}

void SnapLookAndFeel::drawTooltip (juce::Graphics& g, const juce::String& tipText, int width, int height)
{
    const auto bounds = juce::Rectangle<int> (width, height).toFloat();
    g.setColour (palette::raised);
    g.fillRoundedRectangle (bounds, 4.0f);
    g.setColour (palette::lineBright);
    g.drawRoundedRectangle (bounds.reduced (0.5f), 4.0f, 1.0f);

    juce::AttributedString text;
    text.append (tipText, uiFont (13.0f), palette::text);
    juce::TextLayout layout;
    layout.createLayoutWithBalancedLineLengths (text, (float) width - 22.0f);
    layout.draw (g, bounds.reduced (11.0f, 8.0f));
}
} // namespace snaptune
