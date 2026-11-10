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

VersionAnswer parseVersionAnswer (const juce::String& json)
{
    const auto answer = juce::JSON::parse (json);
    VersionAnswer result;
    result.version = answer["version"].toString().trim();

    const auto notice = answer["notice"];
    const Notice candidate { notice["id"].toString().trim(), notice["text"].toString().trim(), notice["url"].toString().trim() };

    if (candidate.id.isNotEmpty() && candidate.text.isNotEmpty() && candidate.text.length() <= 40
        && candidate.url.startsWith ("https://getsnaptune.com/"))
        result.notice = candidate;

    return result;
}

juce::String UpdateCheck::getNewerVersion() const
{
    const juce::ScopedLock sl (lock);
    return newer;
}

Notice UpdateCheck::getNotice() const
{
    const juce::ScopedLock sl (lock);
    return notice;
}

void UpdateCheck::noticeOpened()
{
    const juce::ScopedLock sl (lock);

    if (notice.id.isNotEmpty())
        snapTuneDataDir().getChildFile ("notice-seen").replaceWithText (notice.id);

    notice = {};
}

void UpdateCheck::found (const VersionAnswer& answer)
{
    const bool seen = snapTuneDataDir().getChildFile ("notice-seen").loadFileAsString().trim() == answer.notice.id;
    const juce::ScopedLock sl (lock);

    if (isNewerVersion (answer.version, JucePlugin_VersionString))
        newer = answer.version;

    if (! seen)
        notice = answer.notice;
}

void UpdateCheck::run()
{
    constexpr juce::int64 day = 24 * 60 * 60 * 1000;
    const auto cache = snapTuneDataDir().getChildFile ("latest-answer");

    // When it was asked for, then the answer as it came: "1761000000000\n{"version": …}".
    const auto cached = cache.loadFileAsString();

    if (juce::Time::currentTimeMillis() - cached.upToFirstOccurrenceOf ("\n", false, false).getLargeIntValue() < day)
    {
        found (parseVersionAnswer (cached.fromFirstOccurrenceOf ("\n", false, false)));
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

    const auto body = stream->readEntireStreamAsString();
    const auto answer = parseVersionAnswer (body);

    if (answer.version.isEmpty() || body.length() > 4000 || threadShouldExit())
        return;

    if (snapTuneDataDir().createDirectory().wasOk())
    {
        cache.replaceWithText (juce::String (juce::Time::currentTimeMillis()) + "\n" + body);

        // What versions before 2.3 kept instead.
        snapTuneDataDir().getChildFile ("latest-version").deleteFile();
    }

    found (answer);
}

} // namespace snaptune
