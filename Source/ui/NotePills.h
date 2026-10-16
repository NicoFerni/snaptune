#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

#include <functional>

namespace snaptune
{
/** Twelve note buttons, C to B. Lit = in the scale, solid = the note being tuned to right now,
    violet dot = held MIDI note. Clicking one calls onToggle with its pitch class. */
class NotePills final : public juce::Component, public juce::SettableTooltipClient
{
public:
    std::function<void (int)> onToggle;

    void setState (uint16_t allowedMask, uint16_t heldMask, int targetPitchClass);

    void paint (juce::Graphics&) override;
    void mouseDown (const juce::MouseEvent&) override;
    void mouseMove (const juce::MouseEvent&) override;
    void mouseExit (const juce::MouseEvent&) override;

private:
    juce::Rectangle<float> pillBounds (int pitchClass) const;
    int pillAt (juce::Point<float>) const;

    uint16_t allowed = 0x0fff, held = 0;
    int target = -1, hovered = -1;
};
} // namespace snaptune
