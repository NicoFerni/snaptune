#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace snaptune
{

/** Where SnapTune keeps its install id, session markers and the update check's answer:
    ~/Library/Application Support/SnapTune, %APPDATA%\SnapTune or ~/.config/SnapTune. */
juce::File snapTuneDataDir();

/** True when the user opted out of pings and update checks: a file named "no-telemetry" in the
    data folder, or the SNAPTUNE_NO_TELEMETRY environment variable. */
bool networkDisabled();

// Anonymous usage pings for the admin panel on the website (website/app/api/ping). Once per host
// process, the first SnapTune instance sends the plugin version, OS, host and format, plus any
// earlier sessions that ended without SnapTune being shut down (a crash of the plugin or the DAW).
// Nothing about the audio or the user's projects is sent. Opt out with a file named "no-telemetry"
// in the SnapTune data folder, or the SNAPTUNE_NO_TELEMETRY environment variable.
// SNAPTUNE_TELEMETRY_URL points the ping at another server, for testing.
//
// Shared by all instances in a process through juce::SharedResourcePointer, so the request thread
// is stopped before the last instance (and possibly the plugin binary) goes away.
class Telemetry final : private juce::Thread
{
public:
    Telemetry();
    ~Telemetry() override;

    // Called by every new processor; only the first call in the process sends anything.
    void pluginCreated (juce::AudioProcessor::WrapperType);

private:
    void run() override;

    juce::File dataDir, marker;
    juce::String body;
    std::atomic<bool> started { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Telemetry)
};

} // namespace snaptune
