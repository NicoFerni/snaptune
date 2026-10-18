#include "SnapLookAndFeel.h"

namespace snaptune
{
juce::Font uiFont (float height, bool bold)
{
    return juce::Font (juce::FontOptions (height, bold ? juce::Font::bold : juce::Font::plain));
}

juce::Font captionFont (float height)
{
    return juce::Font (juce::FontOptions (height, juce::Font::bold).withKerningFactor (0.08f));
}

void drawFocusRing (juce::Graphics& g, juce::Rectangle<float> bounds, float radius)
{
    g.setColour (palette::accent);
    g.drawRoundedRectangle (bounds.reduced (1.0f), radius, 2.0f);
}

void drawPanel (juce::Graphics& g, juce::Rectangle<float> bounds, float radius)
{
    using namespace juce;

    g.setGradientFill (ColourGradient (palette::panel.brighter (0.06f), 0.0f, bounds.getY(), palette::panel, 0.0f, bounds.getY() + 80.0f, false));
    g.fillRoundedRectangle (bounds, radius);
    g.setColour (palette::outline);
    g.drawRoundedRectangle (bounds.reduced (0.5f), radius, 1.0f);

    // Faint highlight along the top edge, like light catching a bevel.
    ColourGradient highlight (Colours::white.withAlpha (0.0f), bounds.getX() + radius, 0.0f,
                              Colours::white.withAlpha (0.0f), bounds.getRight() - radius, 0.0f, false);
    highlight.addColour (0.5, Colours::white.withAlpha (0.07f));
    g.setGradientFill (highlight);
    g.fillRect (Rectangle<float> (bounds.getX() + radius, bounds.getY() + 0.5f, bounds.getWidth() - 2.0f * radius, 1.0f));
}

void drawLogo (juce::Graphics& g, juce::Rectangle<float> r)
{
    using namespace juce;

    g.setGradientFill (ColourGradient (palette::accent, r.getX(), r.getY(), palette::accentDeep, r.getRight(), r.getBottom(), false));
    g.fillRoundedRectangle (r, r.getWidth() * 0.27f);

    // A free-running wave on the left that snaps onto two steps on the right.
    const auto box = r.reduced (r.getWidth() * 0.2f);
    auto at = [&] (float x, float y) { return Point<float> (box.getX() + x * box.getWidth(), box.getY() + y * box.getHeight()); };

    Path mark;
    mark.startNewSubPath (at (0.0f, 0.62f));
    mark.cubicTo (at (0.1f, 0.05f), at (0.24f, 1.05f), at (0.38f, 0.62f));
    mark.lineTo (at (0.6f, 0.62f));
    mark.lineTo (at (0.6f, 0.3f));
    mark.lineTo (at (1.0f, 0.3f));

    g.setColour (palette::background);
    g.strokePath (mark, PathStrokeType (r.getWidth() * 0.095f, PathStrokeType::curved, PathStrokeType::rounded));
}

void strokeWithGlow (juce::Graphics& g, const juce::Path& path, const juce::FillType& fill, float width, float glowWidth, float glowAlpha)
{
    using namespace juce;

    if (glowAlpha > 0.0f)
    {
        auto glow = fill;
        glow.setOpacity (fill.getOpacity() * glowAlpha);
        g.setFillType (glow);
        g.strokePath (path, PathStrokeType (glowWidth, PathStrokeType::curved, PathStrokeType::rounded));
    }

    g.setFillType (fill);
    g.strokePath (path, PathStrokeType (width, PathStrokeType::curved, PathStrokeType::rounded));
}

//==============================================================================
SnapLookAndFeel::SnapLookAndFeel()
{
    using namespace juce;

    setColour (ResizableWindow::backgroundColourId, palette::background);
    setColour (ComboBox::textColourId, palette::text);
    setColour (ComboBox::backgroundColourId, palette::panelRaised);
    setColour (ComboBox::outlineColourId, palette::outline);
    setColour (ComboBox::arrowColourId, palette::textDim);
    setColour (PopupMenu::backgroundColourId, palette::panelRaised);
    setColour (PopupMenu::textColourId, palette::text);
    setColour (PopupMenu::headerTextColourId, palette::textFaint);
    setColour (PopupMenu::highlightedBackgroundColourId, palette::accent.withAlpha (0.16f));
    setColour (PopupMenu::highlightedTextColourId, palette::accent);
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
                       float angle, bool bipolar, juce::Colour colour, float glowAlpha, bool emphasised)
    {
        using namespace juce;

        const PathStrokeType stroke (thickness, PathStrokeType::curved, PathStrokeType::rounded);
        Path track;
        track.addCentredArc (centre.x, centre.y, radius, radius, 0.0f, startAngle, endAngle, true);
        g.setColour (emphasised ? palette::outlineBright : palette::outline);
        g.strokePath (track, stroke);

        const float origin = bipolar ? (startAngle + endAngle) * 0.5f : startAngle;

        if (std::abs (angle - origin) < 0.01f)
            return;

        Path value;
        value.addCentredArc (centre.x, centre.y, radius, radius, 0.0f, jmin (origin, angle), jmax (origin, angle), true);

        const FillType fill (ColourGradient (colour.withMultipliedBrightness (0.75f), centre.x - radius, centre.y + radius,
                                             colour, centre.x + radius, centre.y - radius, false));
        strokeWithGlow (g, value, fill, thickness, thickness * 2.6f, glowAlpha);
    }

    void drawKnobBody (juce::Graphics& g, juce::Point<float> centre, float radius, bool emphasised)
    {
        using namespace juce;

        const auto body = Rectangle<float> (radius * 2.0f, radius * 2.0f).withCentre (centre);

        // Soft shadow under the cap.
        g.setColour (Colours::black.withAlpha (0.35f));
        g.fillEllipse (body.translated (0.0f, radius * 0.08f).expanded (1.0f));

        ColourGradient fill (Colour (0xff272e3a), centre.x, body.getY(), Colour (0xff13171e), centre.x, body.getBottom(), false);
        g.setGradientFill (fill);
        g.fillEllipse (body);

        g.setGradientFill (ColourGradient (Colours::white.withAlpha (emphasised ? 0.22f : 0.14f), centre.x, body.getY(),
                                           Colours::white.withAlpha (0.0f), centre.x, body.getCentreY(), false));
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

    // Teal is kept for the output pitch and Retune Speed; the supporting knobs stay neutral.
    const auto arcColour = ! slider.isEnabled() ? palette::outlineBright : (emphasised ? palette::text : palette::textDim);
    drawValueArc (g, centre, radius - 3.0f, 4.5f, startAngle, endAngle, angle, (bool) slider.getProperties()["bipolar"], arcColour, 0.0f,
                  emphasised);

    if (slider.hasKeyboardFocus (false))
        drawFocusRing (g, area.expanded (2.0f), radius + 2.0f);

    const float bodyRadius = radius - 11.0f;
    drawKnobBody (g, centre, bodyRadius, emphasised);

    Path pointer;
    pointer.startNewSubPath (centre.getPointOnCircumference (bodyRadius * 0.35f, angle));
    pointer.lineTo (centre.getPointOnCircumference (bodyRadius * 0.78f, angle));
    g.setColour (slider.isEnabled() ? palette::text : palette::textFaint);
    g.strokePath (pointer, PathStrokeType (2.6f, PathStrokeType::curved, PathStrokeType::rounded));

    g.setColour (emphasised ? palette::text : palette::textDim);
    g.setFont (uiFont (12.5f, true));
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

    // Tick ring.
    for (int i = 0; i <= 20; ++i)
    {
        const float a = startAngle + (endAngle - startAngle) * (float) i / 20.0f;
        const bool major = i % 5 == 0;
        g.setColour ((a <= angle + 0.001f ? palette::accent.withAlpha (0.7f) : palette::outlineBright));
        g.drawLine (Line<float> (centre.getPointOnCircumference (radius - (major ? 1.0f : 3.0f), a),
                                 centre.getPointOnCircumference (radius + 3.0f, a)),
                    major ? 1.6f : 1.0f);
    }

    const float arcRadius = radius - 11.0f;
    drawValueArc (g, centre, arcRadius, 7.0f, startAngle, endAngle, angle, false, palette::accent, 0.18f, emphasised);

    if (slider.hasKeyboardFocus (false))
        drawFocusRing (g, Rectangle<float> (radius * 2.0f + 10.0f, radius * 2.0f + 10.0f).withCentre (centre), radius + 5.0f);

    const float bodyRadius = radius - 20.0f;
    drawKnobBody (g, centre, bodyRadius, emphasised);

    // Handle riding the end of the value arc.
    const auto handle = centre.getPointOnCircumference (arcRadius, angle);
    g.setColour (palette::accent.withAlpha (0.3f));
    g.fillEllipse (Rectangle<float> (17.0f, 17.0f).withCentre (handle));
    g.setColour (palette::text);
    g.fillEllipse (Rectangle<float> (9.0f, 9.0f).withCentre (handle));

    g.setColour (palette::text);
    g.setFont (uiFont (18.0f, true));
    g.drawText (slider.getTextFromValue (slider.getValue()), Rectangle<float> (bodyRadius * 1.9f, 24.0f).withCentre (centre),
                Justification::centred);

    const auto startLabel = slider.getProperties()["startLabel"].toString();
    const auto endLabel = slider.getProperties()["endLabel"].toString();
    g.setFont (captionFont());
    g.setColour (palette::textFaint);
    const auto startPoint = centre.getPointOnCircumference (radius + 2.0f, startAngle);
    const auto endPoint = centre.getPointOnCircumference (radius + 2.0f, endAngle);
    g.drawText (startLabel, Rectangle<float> (60.0f, 14.0f).withCentre (startPoint.translated (-4.0f, 12.0f)), Justification::centred);
    g.drawText (endLabel, Rectangle<float> (60.0f, 14.0f).withCentre (endPoint.translated (4.0f, 12.0f)), Justification::centred);
}

void SnapLookAndFeel::drawComboBox (juce::Graphics& g, int width, int height, bool, int, int, int, int, juce::ComboBox& box)
{
    using namespace juce;

    const auto r = Rectangle<float> (0.0f, 0.0f, (float) width, (float) height).reduced (0.5f);
    g.setColour (box.isMouseOver (true) ? palette::panelRaised.brighter (0.08f) : palette::panelRaised);
    g.fillRoundedRectangle (r, 8.0f);
    g.setColour (box.isMouseOver (true) ? palette::outlineBright : palette::outline);
    g.drawRoundedRectangle (r, 8.0f, 1.0f);

    if (box.hasKeyboardFocus (true))
        drawFocusRing (g, r.expanded (0.5f), 8.0f);

    const float cx = (float) width - 15.0f, cy = (float) height * 0.5f;
    Path chevron;
    chevron.startNewSubPath (cx - 4.0f, cy - 2.0f);
    chevron.lineTo (cx, cy + 2.0f);
    chevron.lineTo (cx + 4.0f, cy - 2.0f);
    g.setColour (palette::textDim);
    g.strokePath (chevron, PathStrokeType (1.6f, PathStrokeType::curved, PathStrokeType::rounded));
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
    g.fillAll (palette::panelRaised);
    g.setColour (palette::outlineBright);
    g.drawRect (0, 0, width, height);
}

void SnapLookAndFeel::drawToggleButton (juce::Graphics& g, juce::ToggleButton& button, bool highlighted, bool)
{
    using namespace juce;

    const auto r = button.getLocalBounds().toFloat();
    const float pillHeight = 18.0f, pillWidth = 32.0f;
    const auto pill = Rectangle<float> (pillWidth, pillHeight).withCentre ({ r.getX() + pillWidth * 0.5f + 1.0f, r.getCentreY() });
    const bool on = button.getToggleState();

    g.setColour (on ? palette::midi : palette::outline);
    g.fillRoundedRectangle (pill, pillHeight * 0.5f);

    const float knobX = on ? pill.getRight() - pillHeight * 0.5f : pill.getX() + pillHeight * 0.5f;
    g.setColour (on ? palette::background : palette::textDim);
    g.fillEllipse (Rectangle<float> (pillHeight - 6.0f, pillHeight - 6.0f).withCentre ({ knobX, pill.getCentreY() }));

    if (button.hasKeyboardFocus (false))
        drawFocusRing (g, pill.expanded (3.0f), pillHeight * 0.5f + 3.0f);

    g.setColour (on || highlighted ? palette::text : palette::textDim);
    g.setFont (uiFont (13.0f, true));
    g.drawText (button.getButtonText(), r.withLeft (pill.getRight() + 8.0f), Justification::centredLeft);
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
    g.setColour (palette::panelRaised);
    g.fillRoundedRectangle (bounds, 7.0f);
    g.setColour (palette::outlineBright);
    g.drawRoundedRectangle (bounds.reduced (0.5f), 7.0f, 1.0f);

    juce::AttributedString text;
    text.append (tipText, uiFont (13.0f), palette::text);
    juce::TextLayout layout;
    layout.createLayoutWithBalancedLineLengths (text, (float) width - 22.0f);
    layout.draw (g, bounds.reduced (11.0f, 8.0f));
}
} // namespace snaptune
