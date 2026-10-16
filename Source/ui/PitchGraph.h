#pragma once

#include "../dsp/AutoTuneEngine.h"

#include <juce_gui_basics/juce_gui_basics.h>

#include <vector>

namespace snaptune
{
/** Piano-roll pitch history: a keyboard down the left edge, one lane per semitone (in-scale lanes
    lit), the detected pitch in coral and the corrected pitch in mint, scrolling right to left.

    The note range stays put while you sing. It only slides when the voice has been out of view for
    a moment; scrolling or dragging moves it by hand and locks it, double-click follows again. */
class PitchGraph final : public juce::Component, public juce::SettableTooltipClient
{
public:
    PitchGraph();

    void setFramesPerSecond (double fps);
    void setAllowedMask (uint16_t mask);
    void pushFrames (const PitchFrame* frames, int count);

    /** Note the view starts on (and returns to) before anything has been sung. */
    void setHomeNote (int note);

    /** Notes currently on screen (bottom edge, top edge). */
    juce::Range<float> getNoteRange() const noexcept { return { viewLow, viewLow + span }; }

    void paint (juce::Graphics&) override;
    void mouseWheelMove (const juce::MouseEvent&, const juce::MouseWheelDetails&) override;
    void mouseDown (const juce::MouseEvent&) override;
    void mouseDrag (const juce::MouseEvent&) override;
    void mouseDoubleClick (const juce::MouseEvent&) override;

private:
    const PitchFrame& frameAgo (int age) const;
    int visibleFrames() const;
    const PitchFrame* latestVoiced (double withinSeconds) const;
    void moveViewTo (float lowestNote);

    std::vector<PitchFrame> history;
    int head = 0;
    int64_t totalFrames = 0;
    double framesPerSecond = 375.0;
    float visibleSeconds = 5.0f;
    float span = 16.0f;
    float viewLow = 49.5f, targetLow = 49.5f; // bottom edge of the view, in notes (row k spans k +/- 0.5)
    int homeNote = 57;
    bool followSinger = true, hasFollowed = false;
    int outOfViewFrames = 0;
    float dragStartLow = 0.0f;
    uint16_t allowedMask = 0x0fff;
};
} // namespace snaptune
