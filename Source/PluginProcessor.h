#pragma once

#include "Telemetry.h"
#include "dsp/AutoTuneEngine.h"

#include <juce_audio_processors/juce_audio_processors.h>

class SnapTuneProcessor final : public juce::AudioProcessor, private juce::AsyncUpdater
{
public:
    SnapTuneProcessor();
    ~SnapTuneProcessor() override;

    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    void processBlockBypassed (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;
    using AudioProcessor::processBlockBypassed;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "SnapTune"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    snaptune::EngineSettings readSettings() const;

    juce::AudioProcessorValueTreeState apvts;
    snaptune::AutoTuneEngine engine;

private:
    void run (juce::AudioBuffer<float>&, juce::MidiBuffer&, bool bypassed);
    void handleAsyncUpdate() override;

    std::atomic<float>* key = nullptr;
    std::atomic<float>* scale = nullptr;
    std::atomic<float>* retune = nullptr;
    std::atomic<float>* humanize = nullptr;
    std::atomic<float>* amount = nullptr;
    std::atomic<float>* formant = nullptr;
    std::atomic<float>* tracking = nullptr;
    std::atomic<float>* mix = nullptr;
    std::atomic<float>* voice = nullptr;
    std::atomic<float>* midi = nullptr;
    std::atomic<float>* mode = nullptr;
    std::atomic<int> latencyToReport { 0 };
    std::array<std::atomic<float>*, 12> notes {};

    juce::SharedResourcePointer<snaptune::Telemetry> telemetry;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SnapTuneProcessor)
};
