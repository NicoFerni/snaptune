#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace snaptune
{
/** Two-segment switch bound to a two-choice parameter (Studio / Live). Each segment is a radio
    button, so VoiceOver and the keyboard can reach it. */
class ModeSwitch final : public juce::Component, public juce::SettableTooltipClient
{
public:
    explicit ModeSwitch (juce::RangedAudioParameter& parameter);

    int getSelectedIndex() const noexcept { return selected; }

    /** Also applied to each segment, which is what the pointer and VoiceOver land on. */
    void setTooltip (const juce::String& newTooltip) override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    struct Segment final : public juce::Button
    {
        explicit Segment (const juce::String& label);
        void paintButton (juce::Graphics&, bool highlighted, bool down) override;
    };

    juce::ParameterAttachment attachment;
    juce::OwnedArray<Segment> segments;
    int selected = 0;
};
} // namespace snaptune
