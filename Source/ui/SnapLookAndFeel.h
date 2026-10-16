#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

namespace snaptune
{
namespace palette
{
    inline const juce::Colour background { 0xff0a0c10 };
    inline const juce::Colour backgroundLift { 0xff11151c };
    inline const juce::Colour panel { 0xff12161d };
    inline const juce::Colour panelRaised { 0xff1a1f28 };
    inline const juce::Colour outline { 0xff242b36 };
    inline const juce::Colour outlineBright { 0xff343d4c };
    inline const juce::Colour grid { 0xff181d25 };
    inline const juce::Colour text { 0xffeef2f7 };
    inline const juce::Colour textDim { 0xff9aa4b5 };
    inline const juce::Colour textFaint { 0xff5d677a };
    inline const juce::Colour accent { 0xff3cf0bf };     // corrected pitch, active state
    inline const juce::Colour accentDeep { 0xff10a07c };
    inline const juce::Colour input { 0xffff8a5b };      // detected pitch
    inline const juce::Colour midi { 0xffa996ff };       // held MIDI notes
} // namespace palette

juce::Font uiFont (float height, bool bold = false);

/** Small uppercase labels: bold with extra letter spacing. */
juce::Font captionFont (float height = 10.0f);

/** Rounded panel with a faint top highlight. */
void drawPanel (juce::Graphics&, juce::Rectangle<float> bounds, float radius = 14.0f);

/** The SnapTune mark: a wave that snaps onto steps. */
void drawLogo (juce::Graphics&, juce::Rectangle<float> bounds);

/** Strokes a path twice with the given fill: a wide translucent pass for the glow, then the line. */
void strokeWithGlow (juce::Graphics&, const juce::Path&, const juce::FillType&, float width, float glowWidth, float glowAlpha);

/** Knobs read these component properties:
      "hero"       large style with the value inside and end labels
      "bipolar"    value arc grows from the centre
      "startLabel" / "endLabel"   text under the two ends of the arc (hero only) */
class SnapLookAndFeel final : public juce::LookAndFeel_V4
{
public:
    SnapLookAndFeel();

    void drawRotarySlider (juce::Graphics&, int x, int y, int width, int height, float sliderPos,
                           float rotaryStartAngle, float rotaryEndAngle, juce::Slider&) override;

    void drawComboBox (juce::Graphics&, int width, int height, bool isButtonDown, int buttonX, int buttonY,
                       int buttonW, int buttonH, juce::ComboBox&) override;
    juce::Font getComboBoxFont (juce::ComboBox&) override;
    void positionComboBoxText (juce::ComboBox&, juce::Label&) override;

    juce::Font getPopupMenuFont() override;
    void drawPopupMenuBackground (juce::Graphics&, int width, int height) override;

    void drawToggleButton (juce::Graphics&, juce::ToggleButton&, bool shouldDrawButtonAsHighlighted,
                           bool shouldDrawButtonAsDown) override;

    void drawTooltip (juce::Graphics&, const juce::String& text, int width, int height) override;
    void drawCornerResizer (juce::Graphics&, int w, int h, bool isMouseOver, bool isMouseDragging) override;
    juce::Rectangle<int> getTooltipBounds (const juce::String& tipText, juce::Point<int> screenPos, juce::Rectangle<int> parentArea) override;

private:
    void drawSmallKnob (juce::Graphics&, juce::Rectangle<float>, float sliderPos, float startAngle, float endAngle, juce::Slider&);
    void drawHeroKnob (juce::Graphics&, juce::Rectangle<float>, float sliderPos, float startAngle, float endAngle, juce::Slider&);
};
} // namespace snaptune
