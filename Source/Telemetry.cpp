#include "Telemetry.h"

// After Telemetry.h, so JUCE_WINDOWS is defined.
#if JUCE_WINDOWS
 #ifndef NOMINMAX
  #define NOMINMAX
 #endif
 #ifndef WIN32_LEAN_AND_MEAN
  #define WIN32_LEAN_AND_MEAN
 #endif
 #include <windows.h>
#else
 #include <cerrno>
 #include <csignal>
 #include <unistd.h>
#endif

// Only the plugin target defines SNAPTUNE_TELEMETRY=1, so the test runner never phones home.
#ifndef SNAPTUNE_TELEMETRY
 #define SNAPTUNE_TELEMETRY 0
#endif

namespace snaptune
{

juce::File snapTuneDataDir()
{
    const auto base = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory);

   #if JUCE_MAC
    return base.getChildFile ("Application Support/SnapTune");
   #else
    return base.getChildFile ("SnapTune");
   #endif
}

bool networkDisabled()
{
    return juce::SystemStats::getEnvironmentVariable ("SNAPTUNE_NO_TELEMETRY", {}).isNotEmpty()
        || snapTuneDataDir().getChildFile ("no-telemetry").exists();
}

Telemetry::Telemetry() : juce::Thread ("SnapTune telemetry") {}

Telemetry::~Telemetry()
{
    stopThread (4000);

    // A clean shutdown: this session didn't crash.
    if (marker != juce::File())
        marker.deleteFile();
}

#if SNAPTUNE_TELEMETRY

namespace
{
constexpr auto endpoint = "https://getsnaptune.com/api/ping";

int currentProcessId()
{
   #if JUCE_WINDOWS
    return (int) GetCurrentProcessId();
   #else
    return (int) getpid();
   #endif
}

bool isProcessAlive (int pid)
{
   #if JUCE_WINDOWS
    auto* process = OpenProcess (PROCESS_QUERY_LIMITED_INFORMATION, FALSE, (DWORD) pid);

    if (process == nullptr)
        return false;

    DWORD exitCode = 0;
    const bool alive = GetExitCodeProcess (process, &exitCode) && exitCode == STILL_ACTIVE;
    CloseHandle (process);
    return alive;
   #else
    return kill ((pid_t) pid, 0) == 0 || errno == EPERM;
   #endif
}

juce::String installId (const juce::File& dir)
{
    const auto file = dir.getChildFile ("install-id");
    auto id = file.loadFileAsString().trim();

    if (id.length() != 36)
    {
        id = juce::Uuid().toDashedString();
        file.replaceWithText (id);
    }

    return id;
}

// The host's executable name, which says more than "Unknown" for hosts JUCE doesn't recognise.
juce::String hostName()
{
    const juce::PluginHostType host;
    const juce::String description = host.getHostDescription();

    if (description != "Unknown")
        return description;

    return juce::File (juce::PluginHostType::getHostPath()).getFileNameWithoutExtension();
}
} // namespace

void Telemetry::pluginCreated (juce::AudioProcessor::WrapperType wrapperType)
{
    if (started.exchange (true))
        return;

    if (networkDisabled())
        return;

    // JUCE's build tools load the plugin to write its LV2 and VST3 descriptions: not a session.
    const auto process = juce::File (juce::PluginHostType::getHostPath()).getFileNameWithoutExtension();

    if (process == "juce_lv2_helper" || process == "vst3_helper")
        return;

    dataDir = snapTuneDataDir();

    if (dataDir.createDirectory().failed())
        return;

    auto session = std::make_unique<juce::DynamicObject>();
    session->setProperty ("version", JucePlugin_VersionString);
    session->setProperty ("os", juce::SystemStats::getOperatingSystemName());
   #if JUCE_ARM
    session->setProperty ("arch", "arm64");
   #else
    session->setProperty ("arch", "x64");
   #endif
    session->setProperty ("host", hostName());
    session->setProperty ("format", juce::AudioProcessor::getWrapperTypeDescription (wrapperType));
    session->setProperty ("started", juce::Time::currentTimeMillis());

    // Markers left by earlier processes that are no longer running never reached the destructor.
    juce::Array<juce::var> uncleanExits;

    for (const auto& file : dataDir.findChildFiles (juce::File::findFiles, false, "session-*.json"))
    {
        const int pid = file.getFileNameWithoutExtension().fromFirstOccurrenceOf ("session-", false, false).getIntValue();

        if (pid == currentProcessId() || isProcessAlive (pid))
            continue;

        const auto previous = juce::JSON::parse (file);

        if (previous.isObject() && uncleanExits.size() < 10)
            uncleanExits.add (previous);

        file.deleteFile();
    }

    const juce::var sessionVar (session.release());
    marker = dataDir.getChildFile ("session-" + juce::String (currentProcessId()) + ".json");
    marker.replaceWithText (juce::JSON::toString (sessionVar, true));

    auto payload = std::make_unique<juce::DynamicObject>();
    payload->setProperty ("install", installId (dataDir));
    payload->setProperty ("session", sessionVar);
    payload->setProperty ("uncleanExits", uncleanExits);
    body = juce::JSON::toString (juce::var (payload.release()), true);

    startThread (juce::Thread::Priority::background);
}

void Telemetry::run()
{
    int status = 0;
    const auto options = juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inPostData)
                             .withExtraHeaders ("Content-Type: application/json")
                             .withConnectionTimeoutMs (3000)
                             .withStatusCode (&status)
                             .withProgressCallback ([this] (int, int) { return ! threadShouldExit(); });

    // Fire and forget: offline machines and blocked hosts just don't show up in the panel.
    const auto url = juce::SystemStats::getEnvironmentVariable ("SNAPTUNE_TELEMETRY_URL", endpoint);

    if (auto stream = juce::URL (url).withPOSTData (body).createInputStream (options))
        stream->readEntireStreamAsString();
}

#else

void Telemetry::pluginCreated (juce::AudioProcessor::WrapperType) {}
void Telemetry::run() {}

#endif

} // namespace snaptune
