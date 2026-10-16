#pragma once

namespace snaptune
{
/** Factory starting points. Key, scale and voice are left alone: those depend on the song. */
struct FactoryPreset
{
    const char* name;
    float retune, humanize, amount, formant, tracking, mix;
};

inline constexpr FactoryPreset factoryPresets[] = {
    { "Hard Tune", 0.0f, 0.0f, 100.0f, 0.0f, 50.0f, 100.0f },
    { "Melodic Trap", 8.0f, 10.0f, 100.0f, 0.0f, 50.0f, 100.0f },
    { "Natural", 40.0f, 35.0f, 100.0f, 0.0f, 50.0f, 100.0f },
    { "Subtle Polish", 90.0f, 50.0f, 75.0f, 0.0f, 50.0f, 100.0f },
    { "Deep Robot", 0.0f, 0.0f, 100.0f, -4.0f, 50.0f, 100.0f },
    { "Bright Pop", 15.0f, 15.0f, 100.0f, 1.5f, 50.0f, 100.0f },
};

inline constexpr int numFactoryPresets = (int) (sizeof (factoryPresets) / sizeof (factoryPresets[0]));
} // namespace snaptune
