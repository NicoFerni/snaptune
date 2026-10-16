#pragma once

#include "PluginProcessor.h"
#include "ui/MainView.h"
#include "ui/SnapLookAndFeel.h"

#include <juce_audio_processors/juce_audio_processors.h>

/** Resizable shell: the interface is laid out once at 1000 x 640 and scaled to the window. */
class SnapTuneEditor final : public juce::AudioProcessorEditor
{
public:
    explicit SnapTuneEditor (SnapTuneProcessor&);
    ~SnapTuneEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

    /** Feeds pitch frames straight to the display (used by the offline snapshot test). */
    void injectFrames (const snaptune::PitchFrame* frames, int count) { view.injectFrames (frames, count); }

private:
    SnapTuneProcessor& audioProcessor;
    snaptune::SnapLookAndFeel lookAndFeel;
    snaptune::MainView view;
    juce::TooltipWindow tooltips { this, 700 };
    bool rememberSize = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SnapTuneEditor)
};
