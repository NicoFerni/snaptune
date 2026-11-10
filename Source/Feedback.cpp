#include "Feedback.h"
#include "Telemetry.h"

// Only the plugin target defines SNAPTUNE_TELEMETRY=1, so the test runner leaves the data folder alone.
#ifndef SNAPTUNE_TELEMETRY
 #define SNAPTUNE_TELEMETRY 0
#endif

#ifndef JucePlugin_VersionString
 #define JucePlugin_VersionString "0.0.0"
#endif

namespace snaptune
{

juce::URL feedbackUrl (juce::AudioProcessor::WrapperType wrapperType)
{
    return juce::URL ("https://getsnaptune.com/feedback")
        .withParameter ("v", JucePlugin_VersionString)
        .withParameter ("os", juce::SystemStats::getOperatingSystemName())
        .withParameter ("host", hostName())
        .withParameter ("format", juce::AudioProcessor::getWrapperTypeDescription (wrapperType));
}

void FeedbackPrompt::windowOpened()
{
   #if SNAPTUNE_TELEMETRY
    constexpr int sessionsBeforeAsking = 5;

    if (counted.exchange (true) || networkDisabled())
        return;

    const auto dir = snapTuneDataDir();

    if (dir.createDirectory().failed() || dir.getChildFile ("feedback-asked").exists())
        return;

    const auto file = dir.getChildFile ("sessions");
    const int sessions = file.loadFileAsString().getIntValue() + 1;
    file.replaceWithText (juce::String (sessions));
    ask = sessions >= sessionsBeforeAsking;
   #endif
}

void FeedbackPrompt::opened()
{
    if (ask.exchange (false))
        snapTuneDataDir().getChildFile ("feedback-asked").create();
}

} // namespace snaptune
