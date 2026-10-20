#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

namespace snaptune
{
/** SnapTune's colours: bottle green and gold. The window's panels sit darker than its ground, text is
    ivory in two strengths, and colour goes on data only: gold for the pitch that comes out (and the one
    selected thing in a group), sage for the pitch as sung. */
namespace palette
{
    inline const juce::Colour background { 0xff133621 }; // the window's ground
    inline const juce::Colour panel { 0xff0e2a19 };      // panels and the graph's white-key lanes
    inline const juce::Colour raised { 0xff1b462b };     // controls
    inline const juce::Colour line { 0xff234d34 };       // panel edges and dividers
    inline const juce::Colour lineBright { 0xff2f5f40 }; // control edges, inactive tracks
    inline const juce::Colour grid { 0xff173a24 };       // the graph's row lines
    inline const juce::Colour laneBlack { 0xff0b2314 };  // the graph's black-key lanes
    inline const juce::Colour text { 0xffefe8cf };       // ivory
    inline const juce::Colour textDim { 0xffb4bea4 };    // labels; 4.5:1 or better on every surface
    inline const juce::Colour textFaint { 0xff8e9c87 };  // placeholders and disabled controls only
    inline const juce::Colour accent { 0xfff4d96c };     // gold: corrected pitch, the selection
    inline const juce::Colour input { 0xff9cc0a4 };      // sage: detected pitch
    inline const juce::Colour held { 0xffefe8cf };       // held MIDI notes
} // namespace palette

/** Literata, the text face, with tabular figures (Source/fonts). */
juce::Font uiFont (float height, bool bold = false);

/** Rokkitt ExtraBold, the display face: the wordmark and the tuner's note name. */
juce::Font displayFont (float height);

/** Labels above and beside controls: sentence case, regular weight. 12.5 stays above the 10 pt macOS
    minimum down to the smallest window size (0.91x). */
juce::Font labelFont (float height = 12.5f);

/** Keyboard focus ring drawn around a control's bounds. */
void drawFocusRing (juce::Graphics&, juce::Rectangle<float> bounds, float radius);

/** A flat panel, one step darker than the ground, with a 1px edge. */
void drawPanel (juce::Graphics&, juce::Rectangle<float> bounds, float radius = 6.0f);

/** The SnapTune mark: a cent sign drawn as a tuner, an arc with the needle through it, green on a gold tile. */
void drawLogo (juce::Graphics&, juce::Rectangle<float> bounds);

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
