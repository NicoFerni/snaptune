#pragma once

#include "dsp/Scales.h"

#include <juce_audio_processors/juce_audio_processors.h>

namespace snaptune::ids
{
inline constexpr const char* key = "key";
inline constexpr const char* scale = "scale";
inline constexpr const char* retune = "retune";
inline constexpr const char* humanize = "humanize";
inline constexpr const char* amount = "amount";
inline constexpr const char* formant = "formant";
inline constexpr const char* tracking = "tracking";
inline constexpr const char* mix = "mix";
inline constexpr const char* voice = "voice";
inline constexpr const char* midi = "midi";
inline constexpr const char* mode = "mode";

// Added in 2.3 (version hint 2, after the note parameters, so earlier sessions and automation keep their indices).
inline constexpr const char* transition = "transition";
inline constexpr const char* vibrato = "vibrato"; // keep the singer's vibrato
inline constexpr const char* vibratoDepth = "vibratoDepth";
inline constexpr const char* vibratoAdd = "vibratoAdd";
inline constexpr const char* vibratoRate = "vibratoRate";
inline constexpr const char* vibratoDelay = "vibratoDelay";

inline juce::String note (int pitchClass) { return "note" + juce::String (pitchClass); }
} // namespace snaptune::ids

namespace snaptune
{
inline const juce::StringArray voiceTypeNames { "Soprano", "Alto / Tenor", "Low Male", "Instrument" };
inline const juce::StringArray modeNames { "Studio", "Live" };

inline juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout()
{
    using namespace juce;

    AudioProcessorValueTreeState::ParameterLayout layout;

    StringArray keys, scales;

    for (auto* name : noteNames)
        keys.add (name);

    for (auto* name : scaleNames)
        scales.add (name);

    auto percent = AudioParameterFloatAttributes()
                       .withLabel ("%")
                       .withStringFromValueFunction ([] (float v, int) { return String (roundToInt (v)) + " %"; });

    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { ids::key, 1 }, "Key", keys, 0));
    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { ids::scale, 1 }, "Scale", scales, 0));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { ids::retune, 1 }, "Retune Speed", NormalisableRange<float> (0.0f, 400.0f, 0.1f, 0.4f), 20.0f,
        AudioParameterFloatAttributes().withLabel ("ms").withStringFromValueFunction ([] (float v, int)
                                                                                     { return v < 0.5f ? String ("Hard") : String (roundToInt (v)) + " ms"; })));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ids::humanize, 1 }, "Humanize", NormalisableRange<float> (0.0f, 100.0f, 0.1f), 0.0f, percent));
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ids::amount, 1 }, "Amount", NormalisableRange<float> (0.0f, 100.0f, 0.1f), 100.0f, percent));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { ids::formant, 1 }, "Formant", NormalisableRange<float> (-5.0f, 5.0f, 0.01f), 0.0f,
        AudioParameterFloatAttributes().withLabel ("st").withStringFromValueFunction ([] (float v, int)
                                                                                     {
                                                                                         const float rounded = std::round (v * 10.0f) / 10.0f;
                                                                                         return (rounded > 0.0f ? "+" : "") + String (rounded == 0.0f ? 0.0f : rounded, 1) + " st";
                                                                                     })));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ids::tracking, 1 }, "Tracking", NormalisableRange<float> (0.0f, 100.0f, 0.1f), 50.0f, percent));
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ids::mix, 1 }, "Mix", NormalisableRange<float> (0.0f, 100.0f, 0.1f), 100.0f, percent));
    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { ids::voice, 1 }, "Voice", voiceTypeNames, 1));
    layout.add (std::make_unique<AudioParameterBool> (ParameterID { ids::midi, 1 }, "MIDI Target Notes", false));
    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { ids::mode, 1 }, "Latency Mode", modeNames, 0));

    for (int pc = 0; pc < 12; ++pc)
        layout.add (std::make_unique<AudioParameterBool> (ParameterID { ids::note (pc), 1 }, String ("Custom ") + noteNames[(size_t) pc], true));

    // Their defaults are what earlier versions did, so a session saved before they existed sounds the same.
    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { ids::transition, 2 }, "Note Transition", NormalisableRange<float> (0.0f, 500.0f, 0.1f, 0.4f), 0.0f,
        AudioParameterFloatAttributes().withLabel ("ms").withStringFromValueFunction ([] (float v, int)
                                                                                     { return v < 0.5f ? String ("Auto") : String (roundToInt (v)) + " ms"; })));

    layout.add (std::make_unique<AudioParameterBool> (ParameterID { ids::vibrato, 2 }, "Keep Vibrato", false));
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ids::vibratoDepth, 2 }, "Vibrato Depth", NormalisableRange<float> (0.0f, 200.0f, 0.1f), 100.0f, percent));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { ids::vibratoAdd, 2 }, "Add Vibrato", NormalisableRange<float> (0.0f, 100.0f, 0.1f, 0.6f), 0.0f,
        AudioParameterFloatAttributes().withLabel ("ct").withStringFromValueFunction ([] (float v, int)
                                                                                     { return v < 0.5f ? String ("Off") : String (roundToInt (v)) + " ct"; })));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { ids::vibratoRate, 2 }, "Vibrato Rate", NormalisableRange<float> (3.0f, 9.0f, 0.01f), 5.5f,
        AudioParameterFloatAttributes().withLabel ("Hz").withStringFromValueFunction ([] (float v, int) { return String (v, 1) + " Hz"; })));

    layout.add (std::make_unique<AudioParameterFloat> (
        ParameterID { ids::vibratoDelay, 2 }, "Vibrato Delay", NormalisableRange<float> (0.0f, 1000.0f, 1.0f, 0.6f), 200.0f,
        AudioParameterFloatAttributes().withLabel ("ms").withStringFromValueFunction ([] (float v, int) { return String (roundToInt (v)) + " ms"; })));

    return layout;
}
} // namespace snaptune
