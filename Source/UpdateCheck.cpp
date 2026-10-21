#include "UpdateCheck.h"
#include "Telemetry.h"

// Only the plugin target defines SNAPTUNE_TELEMETRY=1, so the test runner never goes online.
#ifndef SNAPTUNE_TELEMETRY
 #define SNAPTUNE_TELEMETRY 0
#endif

#ifndef JucePlugin_VersionString
 #define JucePlugin_VersionString "0.0.0"
#endif

namespace snaptune
{

bool isNewerVersion (const juce::String& candidate, const juce::String& current)
{
    if (candidate.trim().isEmpty() || ! candidate.trim().containsOnly ("0123456789."))
        return false;

    const auto a = juce::StringArray::fromTokens (candidate.trim(), ".", {});
    const auto b = juce::StringArray::fromTokens (current.trim(), ".", {});

    for (int i = 0; i < juce::jmax (a.size(), b.size()); ++i)
    {
        const int x = a[i].getIntValue();
        const int y = b[i].getIntValue();

        if (x != y)
            return x > y;
    }

    return false;
}

UpdateCheck::UpdateCheck() : juce::Thread ("SnapTune update check") {}

UpdateCheck::~UpdateCheck()
{
    stopThread (4000);
}

void UpdateCheck::start()
{
   #if SNAPTUNE_TELEMETRY
    if (! started.exchange (true) && ! networkDisabled())
        startThread (juce::Thread::Priority::background);
   #endif
}

juce::String UpdateCheck::getNewerVersion() const
{
    const juce::ScopedLock sl (lock);
    return newer;
}

void UpdateCheck::found (const juce::String& latest)
{
    if (isNewerVersion (latest, JucePlugin_VersionString))
    {
        const juce::ScopedLock sl (lock);
        newer = latest.trim();
    }
}

void UpdateCheck::run()
{
    constexpr juce::int64 day = 24 * 60 * 60 * 1000;
    const auto cache = snapTuneDataDir().getChildFile ("latest-version");

    // "2.1.0 1761000000000": the version and when it was asked for.
    const auto cached = juce::StringArray::fromTokens (cache.loadFileAsString(), " \n", {});

    if (cached.size() >= 2 && juce::Time::currentTimeMillis() - cached[1].getLargeIntValue() < day)
    {
        found (cached[0]);
        return;
    }

    int status = 0;
    const auto options = juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
                             .withConnectionTimeoutMs (3000)
                             .withStatusCode (&status)
                             .withProgressCallback ([this] (int, int) { return ! threadShouldExit(); });

    const auto url = juce::SystemStats::getEnvironmentVariable ("SNAPTUNE_UPDATE_URL", "https://getsnaptune.com/api/version");
    const auto stream = juce::URL (url).createInputStream (options);

    if (stream == nullptr || status != 200)
        return;

    const auto latest = juce::JSON::parse (stream->readEntireStreamAsString())["version"].toString();

    if (latest.isEmpty() || threadShouldExit())
        return;

    if (snapTuneDataDir().createDirectory().wasOk())
        cache.replaceWithText (latest + " " + juce::String (juce::Time::currentTimeMillis()));

    found (latest);
}

} // namespace snaptune
