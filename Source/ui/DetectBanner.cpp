#include "DetectBanner.h"
#include "SnapLookAndFeel.h"

namespace snaptune
{
namespace
{
    constexpr int padding = 14, chipWidth = 98, chipHeight = 28, chipGap = 8, cancelWidth = 62;
    constexpr float messageHeight = 13.5f;

    juce::String scaleLabel (int key, Scale scale) { return juce::String (noteNames[(size_t) key]) + " " + scaleNames[(size_t) scale]; }
} // namespace

DetectBanner::DetectBanner()
{
    setTitle ("Key detection");
    setInterceptsMouseClicks (false, true); // the graph under the words still scrolls

    for (int i = 0; i < maxSuggestions; ++i)
    {
        auto* chip = chips.add (new Chip());
        chip->best = i == 0;
        chip->setWantsKeyboardFocus (true);
        chip->setTooltip (i == 0 ? "The scale that fits what it heard best. Click to set Key and Scale to it."
                                 : "Also fits what it heard, a little less well. Click to set Key and Scale to it.");
        chip->setHelpText (chip->getTooltip());
        chip->onClick = [this, chip]
        {
            if (onChoose && chip->key >= 0)
                onChoose (chip->key, chip->scale);
        };
        addChildComponent (chip);
    }

    cancel.setWantsKeyboardFocus (true);
    cancel.setTooltip ("Stop listening and leave Key and Scale as they are.");
    cancel.setHelpText (cancel.getTooltip());
    cancel.onClick = [this]
    {
        if (onCancel)
            onCancel();
    };
    addAndMakeVisible (cancel);
}

void DetectBanner::setState (double secondsSung, const KeyFinder::Suggestion* suggestions, int count, uint16_t currentMask)
{
    const bool suggesting = secondsSung >= secondsBeforeSuggesting && count > 0;
    const int numChips = suggesting ? juce::jmin (count, chips.size()) : 0;
    juce::String text;

    if (! suggesting)
    {
        text = "Listening: sing, or play the vocal.";

        if (secondsSung >= 1.0)
            text << " " << (int) secondsSung << " of " << (int) secondsBeforeSuggesting << " s";
    }
    else
    {
        text << (int) secondsSung << " s heard. " << (suggestions[0].mask() == currentMask ? "Your scale fits:" : "Fits best:");
    }

    bool changed = text != message || numChips != shownChips;

    for (int i = 0; i < chips.size(); ++i)
    {
        auto* chip = chips[i];
        chip->setVisible (i < numChips);

        if (i < numChips && (chip->key != suggestions[i].key || chip->scale != suggestions[i].scale))
        {
            chip->key = suggestions[i].key;
            chip->scale = suggestions[i].scale;
            chip->setButtonText (scaleLabel (chip->key, chip->scale));
            // "C#" would be read as "C number sign".
            chip->setTitle ("Set the key to " + chip->getButtonText().replace ("#", " sharp"));
            changed = true;
        }
    }

    if (changed)
    {
        message = text;
        shownChips = numChips;
        resized();
        repaint();
    }
}

void DetectBanner::resized()
{
    auto area = getLocalBounds().reduced (padding, 0);
    cancel.setBounds (area.removeFromRight (cancelWidth).withSizeKeepingCentre (cancelWidth, chipHeight));

    // The words, then the suggestions right after them, best first. The words give way if it's tight.
    const int chipsWidth = shownChips * (chipWidth + chipGap) + (shownChips > 0 ? chipGap : 0);
    const int wordsWidth = (int) std::ceil (juce::GlyphArrangement::getStringWidth (uiFont (messageHeight, true), message)) + 2;
    messageArea = area.removeFromLeft (juce::jmin (wordsWidth, area.getWidth() - chipsWidth));
    area.removeFromLeft (shownChips > 0 ? 2 * chipGap : 0);

    for (int i = 0; i < shownChips; ++i)
    {
        chips[i]->setBounds (area.removeFromLeft (chipWidth).withSizeKeepingCentre (chipWidth, chipHeight));
        area.removeFromLeft (chipGap);
    }
}

void DetectBanner::paint (juce::Graphics& g)
{
    const auto r = getLocalBounds().toFloat().reduced (0.5f);
    g.setColour (palette::raised);
    g.fillRoundedRectangle (r, 6.0f);
    g.setColour (palette::accent);
    g.drawRoundedRectangle (r, 6.0f, 1.0f);

    g.setColour (palette::text);
    g.setFont (uiFont (messageHeight, true));
    g.drawFittedText (message, messageArea, juce::Justification::centredLeft, 1, 0.85f);
}

void DetectBanner::Chip::paintButton (juce::Graphics& g, bool highlighted, bool down)
{
    using namespace juce;

    // The best fit is gold, as the one selected thing; the others are ordinary controls.
    const auto r = getLocalBounds().toFloat().reduced (0.5f);
    g.setColour (best ? palette::accent.withMultipliedBrightness (down ? 0.88f : highlighted ? 0.94f : 1.0f) : palette::panel);
    g.fillRoundedRectangle (r, 4.0f);

    if (! best)
    {
        g.setColour (highlighted || down ? palette::textDim.withAlpha (0.6f) : palette::lineBright);
        g.drawRoundedRectangle (r, 4.0f, 1.0f);
    }

    if (hasKeyboardFocus (false))
        drawFocusRing (g, r.expanded (0.5f), 4.0f);

    g.setColour (best ? palette::panel : palette::text);
    g.setFont (uiFont (13.5f, true));
    g.drawFittedText (getButtonText(), getLocalBounds().reduced (4, 0), Justification::centred, 1, 0.85f);
}

void DetectBanner::CancelButton::paintButton (juce::Graphics& g, bool highlighted, bool down)
{
    const auto r = getLocalBounds().toFloat().reduced (0.5f);

    if (hasKeyboardFocus (false))
        drawFocusRing (g, r, 4.0f);

    g.setColour (highlighted || down ? palette::text : palette::textDim);
    g.setFont (uiFont (13.0f, true));
    g.drawText (getButtonText(), getLocalBounds(), juce::Justification::centred);
}
} // namespace snaptune
