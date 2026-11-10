#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace snaptune
{

/** The feedback form on the website, with this session's version, system, DAW and plugin format in
    the address, so a message says where it came from without the user typing it. The form shows
    them before anything is sent. */
juce::URL feedbackUrl (juce::AudioProcessor::WrapperType);

// Decides when the header asks for feedback instead of only offering it: once, from the fifth host
// process the window has opened in, until the button is clicked. The count is a file in the data
// folder (sessions) and never leaves the computer; feedback-asked marks the click. Doesn't ask when
// the user opted out of pings (Telemetry.h), and never in the test runner.
//
// Shared by all windows in a process through juce::SharedResourcePointer.
class FeedbackPrompt final
{
public:
    /** Counts this process the first time it's called in it. */
    void windowOpened();

    bool shouldAsk() const { return ask.load(); }

    /** The feedback form was opened: never ask again on this computer. */
    void opened();

private:
    std::atomic<bool> counted { false }, ask { false };
};

} // namespace snaptune
