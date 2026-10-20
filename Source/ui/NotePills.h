#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

#include <functional>

namespace snaptune
{
/** Twelve note buttons, C to B. Lit = in the scale, solid = the note being tuned to right now,
    violet dot = held MIDI note. Clicking one calls onToggle with its pitch class. Each note is a
    toggle button (on = in the scale), so VoiceOver and the keyboard can reach it. */
class NotePills final : public juce::Component, public juce::SettableTooltipClient
{
public:
    NotePills();

    std::function<void (int)> onToggle;

    void setState (uint16_t allowedMask, uint16_t heldMask, int targetPitchClass);

    /** Also applied to each note, which is what the pointer and VoiceOver land on. */
    void setTooltip (const juce::String& newTooltip) override;

    void resized() override;

private:
    struct Pill final : public juce::Button
    {
        explicit Pill (int pitchClass);
        void paintButton (juce::Graphics&, bool highlighted, bool down) override;

        const int pitchClass;
        bool isTarget = false, isHeld = false;
    };

    juce::OwnedArray<Pill> pills;
    uint16_t allowed = 0x0fff, held = 0;
    int target = -1;
};
} // namespace snaptune
