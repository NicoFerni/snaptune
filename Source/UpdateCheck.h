#pragma once

#include <juce_core/juce_core.h>

namespace snaptune
{

/** Is `candidate` a later version than `current`? Compares dotted numbers ("2.1.0" > "2.0.3"). */
bool isNewerVersion (const juce::String& candidate, const juce::String& current);

// Tells the window when a newer SnapTune is out, so it can offer the download. When the window opens
// it asks getsnaptune.com/api/version for the latest released version, at most once a day: the
// answer is kept in the data folder (latest-version) and reused until it's a day old. Nothing is sent
// but the request itself. Off with the same opt-out as the usage pings (Telemetry.h), and never in
// the test runner. SNAPTUNE_UPDATE_URL points it at another server, for testing.
//
// Shared by all windows in a process through juce::SharedResourcePointer.
class UpdateCheck final : private juce::Thread
{
public:
    UpdateCheck();
    ~UpdateCheck() override;

    /** Starts the check the first time it's called in this process. */
    void start();

    /** The newer version, e.g. "2.1.0", or empty while unknown or when this one is the latest. */
    juce::String getNewerVersion() const;

private:
    void run() override;
    void found (const juce::String& latest);

    mutable juce::CriticalSection lock;
    juce::String newer;
    std::atomic<bool> started { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (UpdateCheck)
};

} // namespace snaptune
