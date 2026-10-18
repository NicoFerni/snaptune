#pragma once

#include "../PluginProcessor.h"
#include "ModeSwitch.h"
#include "NotePills.h"
#include "PitchGraph.h"
#include "TunerGauge.h"

#include <juce_audio_processors/juce_audio_processors.h>

namespace snaptune
{
/** The whole interface, laid out at a fixed 1000 x 640; the editor scales it to the window. */
class MainView final : public juce::Component, private juce::Timer
{
public:
    static constexpr int baseWidth = 1000;
    static constexpr int baseHeight = 640;

    explicit MainView (SnapTuneProcessor&);
    ~MainView() override;

    void paint (juce::Graphics&) override;
    void resized() override;

    /** Feeds pitch frames straight to the display (used by the offline snapshot test). */
    void injectFrames (const PitchFrame* frames, int count);

private:
    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ComboBoxAttachment = juce::AudioProcessorValueTreeState::ComboBoxAttachment;
    using ButtonAttachment = juce::AudioProcessorValueTreeState::ButtonAttachment;

    /** A knob that takes keyboard focus (arrow keys move it) and repaints to show its focus ring. */
    struct FocusSlider final : public juce::Slider
    {
        void focusGained (FocusChangeType) override { repaint(); }
        void focusLost (FocusChangeType) override { repaint(); }
    };

    struct Knob
    {
        FocusSlider slider;
        juce::String caption;
        std::unique_ptr<SliderAttachment> attachment;
    };

    void timerCallback() override;
    void consumeFrames (const PitchFrame* frames, int count);
    void refreshState();
    void toggleNote (int pitchClass);
    void applyPreset (int index);
    int matchingPreset() const;
    void setParameter (const juce::String& id, float plainValue);
    float plainValue (const char* id) const;
    uint16_t allowedMask() const;

    void setUpCombo (juce::ComboBox&, const juce::String& title, const juce::StringArray& items, const char* parameterId,
                     std::unique_ptr<ComboBoxAttachment>&, const juce::String& tooltip);
    void setUpKnob (juce::Slider&, const juce::String& title, const char* parameterId, std::unique_ptr<SliderAttachment>&, double resetValue,
                    const juce::String& tooltip);
    void addKnob (const char* parameterId, const juce::String& title, bool bipolar, double resetValue, const juce::String& tooltip);

    SnapTuneProcessor& audioProcessor;

    juce::ComboBox presetBox, keyBox, scaleBox, voiceBox;
    juce::ToggleButton midiButton { "MIDI notes" };
    std::unique_ptr<ComboBoxAttachment> keyAttachment, scaleAttachment, voiceAttachment;
    std::unique_ptr<ButtonAttachment> midiAttachment;
    std::unique_ptr<ModeSwitch> modeSwitch;

    FocusSlider retuneKnob;
    std::unique_ptr<SliderAttachment> retuneAttachment;
    std::vector<std::unique_ptr<Knob>> knobs;

    TunerGauge gauge;
    PitchGraph graph;
    NotePills pills;

    std::vector<PitchFrame> scratch;
    PitchFrame lastVoiced;
    int framesSinceVoiced = 1 << 20;
    int shownMode = -1, shownLatency = -1, presetCheckCountdown = 0;

    juce::Rectangle<int> header, scaleBar, heroPanel, graphPanel, controlsPanel, latencyArea;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MainView)
};
} // namespace snaptune
