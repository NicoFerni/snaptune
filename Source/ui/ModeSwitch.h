#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace snaptune
{
/** Two-segment switch bound to a two-choice parameter (Studio / Live). */
class ModeSwitch final : public juce::Component, public juce::SettableTooltipClient
{
public:
    explicit ModeSwitch (juce::RangedAudioParameter& parameter);

    int getSelectedIndex() const noexcept { return selected; }

    void paint (juce::Graphics&) override;
    void mouseDown (const juce::MouseEvent&) override;

private:
    juce::ParameterAttachment attachment;
    juce::StringArray labels;
    int selected = 0;
};
} // namespace snaptune
