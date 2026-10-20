#include "PluginProcessor.h"
#include "Parameters.h"
#include "PluginEditor.h"

using namespace snaptune;

SnapTuneProcessor::SnapTuneProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "SnapTune", createParameterLayout())
{
    key = apvts.getRawParameterValue (ids::key);
    scale = apvts.getRawParameterValue (ids::scale);
    retune = apvts.getRawParameterValue (ids::retune);
    humanize = apvts.getRawParameterValue (ids::humanize);
    amount = apvts.getRawParameterValue (ids::amount);
    formant = apvts.getRawParameterValue (ids::formant);
    tracking = apvts.getRawParameterValue (ids::tracking);
    mix = apvts.getRawParameterValue (ids::mix);
    voice = apvts.getRawParameterValue (ids::voice);
    midi = apvts.getRawParameterValue (ids::midi);
    mode = apvts.getRawParameterValue (ids::mode);

    for (int pc = 0; pc < 12; ++pc)
        notes[(size_t) pc] = apvts.getRawParameterValue (ids::note (pc));

    telemetry->pluginCreated (wrapperType);
}

SnapTuneProcessor::~SnapTuneProcessor()
{
    cancelPendingUpdate();
}

bool SnapTuneProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto& in = layouts.getMainInputChannelSet();
    const auto& out = layouts.getMainOutputChannelSet();

    if (out != juce::AudioChannelSet::mono() && out != juce::AudioChannelSet::stereo())
        return false;

    return in == out;
}

void SnapTuneProcessor::prepareToPlay (double sampleRate, int)
{
    engine.setSettings (readSettings());
    engine.prepare (sampleRate, std::max (getTotalNumInputChannels(), getTotalNumOutputChannels()));
    latencyToReport = engine.getLatencySamples();
    setLatencySamples (engine.getLatencySamples());
}

EngineSettings SnapTuneProcessor::readSettings() const
{
    EngineSettings s;
    s.key = juce::jlimit (0, 11, (int) key->load());
    s.scale = (Scale) juce::jlimit (0, (int) Scale::numScales - 1, (int) scale->load());
    s.retuneMs = retune->load();
    s.humanize = humanize->load() * 0.01f;
    s.amount = amount->load() * 0.01f;
    s.formantSemitones = formant->load();
    s.tracking = tracking->load() * 0.01f;
    s.mix = mix->load() * 0.01f;
    s.voice = (VoiceType) juce::jlimit (0, (int) VoiceType::numTypes - 1, (int) voice->load());
    s.midiTargets = midi->load() > 0.5f;
    s.mode = mode->load() > 0.5f ? LatencyMode::live : LatencyMode::studio;

    uint16_t custom = 0;

    for (int pc = 0; pc < 12; ++pc)
        if (notes[(size_t) pc]->load() > 0.5f)
            custom = (uint16_t) (custom | (1u << pc));

    s.customMask = custom;
    return s;
}

void SnapTuneProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    run (buffer, midiMessages, false);
}

void SnapTuneProcessor::processBlockBypassed (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    // Keep running so bypass stays latency-compensated and glides back in without a gap.
    run (buffer, midiMessages, true);
}

void SnapTuneProcessor::run (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages, bool bypassed)
{
    juce::ScopedNoDenormals noDenormals;

    const int numSamples = buffer.getNumSamples();
    const int numIn = getTotalNumInputChannels();

    for (int ch = numIn; ch < getTotalNumOutputChannels(); ++ch)
        buffer.clear (ch, 0, numSamples);

    engine.setSettings (readSettings());

    const int numChannels = std::min (numIn, buffer.getNumChannels());

    if (numChannels == 0)
        return;

    auto* const* channels = buffer.getArrayOfWritePointers();
    int position = 0;

    // Split the block at MIDI events so target notes change at the right sample.
    for (const auto metadata : midiMessages)
    {
        const int eventPosition = juce::jlimit (0, numSamples, metadata.samplePosition);

        if (eventPosition > position)
        {
            engine.process (channels, numChannels, position, eventPosition - position, bypassed);
            position = eventPosition;
        }

        const auto message = metadata.getMessage();

        if (message.isNoteOn())
            engine.noteOn (message.getNoteNumber());
        else if (message.isNoteOff())
            engine.noteOff (message.getNoteNumber());
        else if (message.isAllNotesOff() || message.isAllSoundOff())
            engine.allNotesOff();
    }

    if (position < numSamples)
        engine.process (channels, numChannels, position, numSamples - position, bypassed);

    midiMessages.clear();

    // Switching Studio/Live changes the latency; tell the host from the message thread.
    if (engine.getLatencySamples() != latencyToReport.load())
    {
        latencyToReport = engine.getLatencySamples();
        triggerAsyncUpdate();
    }
}

void SnapTuneProcessor::handleAsyncUpdate()
{
    setLatencySamples (latencyToReport.load());
}

juce::AudioProcessorEditor* SnapTuneProcessor::createEditor()
{
    return new SnapTuneEditor (*this);
}

void SnapTuneProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = apvts.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void SnapTuneProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new SnapTuneProcessor();
}
