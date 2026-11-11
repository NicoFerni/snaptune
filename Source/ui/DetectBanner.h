#pragma once

#include "../dsp/KeyFinder.h"

#include <juce_gui_basics/juce_gui_basics.h>

#include <functional>

namespace snaptune
{
/** What Detect has to say while it listens, laid over the top of the pitch graph: first how much
    singing it still needs, then the scales that fit, best first, as buttons that set Key and Scale. */
class DetectBanner final : public juce::Component
{
public:
    /** Singing to hear before the first answer. After 5 s the right scale is among the three shown
        about nine times in ten for a singer 30 cents off (99 in 100 after 20 s); it keeps listening,
        and the answer gets surer. */
    static constexpr double secondsBeforeSuggesting = 5.0;
    static constexpr int maxSuggestions = 3;

    DetectBanner();

    std::function<void (int key, Scale scale)> onChoose;
    std::function<void()> onCancel;

    /** `currentMask` is the scale in use, to say so when it already fits. */
    void setState (double secondsSung, const KeyFinder::Suggestion* suggestions, int count, uint16_t currentMask);

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    struct Chip final : public juce::Button
    {
        Chip() : juce::Button (juce::String()) {}
        void paintButton (juce::Graphics&, bool highlighted, bool down) override;

        int key = -1;
        Scale scale = Scale::major;
        bool best = false;
    };

    struct CancelButton final : public juce::Button
    {
        CancelButton() : juce::Button ("Cancel") {}
        void paintButton (juce::Graphics&, bool highlighted, bool down) override;
    };

    juce::OwnedArray<Chip> chips;
    CancelButton cancel;
    juce::String message;
    juce::Rectangle<int> messageArea;
    int shownChips = 0;
};
} // namespace snaptune
