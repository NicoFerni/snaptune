#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

namespace snaptune
{
/** Tuner-style dial: where the voice was sung (coral dot) versus where it comes out after
    correction (mint needle), in cents around the target note shown in the middle. */
class TunerGauge final : public juce::Component, public juce::SettableTooltipClient
{
public:
    /** inputCents / outputCents are relative to targetNote. */
    void setState (bool active, int targetNote, float inputCents, float outputCents);

    /** Eases the needle toward the latest state; call at the UI frame rate. */
    void animate();

    void paint (juce::Graphics&) override;

private:
    bool active = false;
    int note = -1;
    float targetInput = 0.0f, targetOutput = 0.0f;
    float shownInput = 0.0f, shownOutput = 0.0f, presence = 0.0f;
};
} // namespace snaptune
