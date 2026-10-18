#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

namespace snaptune
{
/** Tuner-style dial: where the voice was sung (coral dot) versus where it comes out after
    correction (teal needle), in cents around the target note shown in the middle. VoiceOver reads
    the same state as text, e.g. "G3, output in tune, sung -40 cents". */
class TunerGauge final : public juce::Component, public juce::SettableTooltipClient
{
public:
    /** inputCents / outputCents are relative to targetNote. */
    void setState (bool active, int targetNote, float inputCents, float outputCents);

    /** Eases the needle toward the latest state; call at the UI frame rate. */
    void animate();

    void paint (juce::Graphics&) override;
    std::unique_ptr<juce::AccessibilityHandler> createAccessibilityHandler() override;

    juce::String describe() const;

private:
    juce::String statusText() const;

    bool active = false;
    int note = -1;
    float targetInput = 0.0f, targetOutput = 0.0f;
    float shownInput = 0.0f, shownOutput = 0.0f, presence = 0.0f;
    juce::String announced;
};
} // namespace snaptune
