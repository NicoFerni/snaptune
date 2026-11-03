#pragma once

namespace snaptune
{
/** Factory starting points. Key, scale and voice are left alone: those depend on the song. */
struct FactoryPreset
{
    const char* name;
    float retune, humanize, amount, formant, tracking, mix;
    float transition = 0.0f;
    bool keepVibrato = false;
    float vibratoDepth = 100.0f, vibratoAdd = 0.0f, vibratoRate = 5.5f, vibratoDelay = 200.0f;
};

inline constexpr FactoryPreset factoryPresets[] = {
    { "Hard Tune", 0.0f, 0.0f, 100.0f, 0.0f, 50.0f, 100.0f },
    { "Melodic Trap", 8.0f, 10.0f, 100.0f, 0.0f, 50.0f, 100.0f },
    { "Natural", 40.0f, 35.0f, 100.0f, 0.0f, 50.0f, 100.0f, 120.0f, true },
    { "Subtle Polish", 90.0f, 50.0f, 75.0f, 0.0f, 50.0f, 100.0f, 150.0f, true },
    { "Deep Robot", 0.0f, 0.0f, 100.0f, -4.0f, 50.0f, 100.0f },
    { "Bright Pop", 15.0f, 15.0f, 100.0f, 1.5f, 50.0f, 100.0f, 60.0f, true },
    { "Hard Tune Vibrato", 0.0f, 0.0f, 100.0f, 0.0f, 50.0f, 100.0f, 0.0f, false, 100.0f, 35.0f, 5.5f, 250.0f },
    { "Smooth Glide", 10.0f, 0.0f, 100.0f, 0.0f, 50.0f, 100.0f, 90.0f, true, 100.0f },
};

inline constexpr int numFactoryPresets = (int) (sizeof (factoryPresets) / sizeof (factoryPresets[0]));
} // namespace snaptune
