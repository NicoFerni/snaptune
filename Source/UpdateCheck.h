#pragma once

#include <juce_core/juce_core.h>

namespace snaptune
{

/** Is `candidate` a later version than `current`? Compares dotted numbers ("2.1.0" > "2.0.3"). */
bool isNewerVersion (const juce::String& candidate, const juce::String& current);

/** A short line the website can put in the header, e.g. to announce a beta: its words, the page it
    opens, and an id so a notice that was opened isn't shown again. */
struct Notice
{
    juce::String id, text, url;
};

/** What getsnaptune.com/api/version answers: {"version": "2.3.0", "notice": {"id", "text", "url"}}. */
struct VersionAnswer
{
    juce::String version;
    Notice notice;
};

/** Reads that answer. A notice is kept only when it's complete, fits the header (40 characters) and
    opens a page of getsnaptune.com: nothing the server says can send the browser anywhere else. */
VersionAnswer parseVersionAnswer (const juce::String& json);

// Tells the window when a newer SnapTune is out, so it can offer the download, and passes on the
// website's notice when there is one. When the window opens it asks getsnaptune.com/api/version, at
// most once a day: the answer is kept in the data folder (latest-answer) and reused until it's a day
// old. Nothing is sent but the request itself. Off with the same opt-out as the usage pings
// (Telemetry.h), and never in the test runner. SNAPTUNE_UPDATE_URL points it at another server, for
// testing.
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

    /** The website's notice, or an empty one when there's none or it was opened already. */
    Notice getNotice() const;

    /** The notice was opened: don't show it again on this computer (notice-seen in the data folder). */
    void noticeOpened();

private:
    void run() override;
    void found (const VersionAnswer&);

    mutable juce::CriticalSection lock;
    juce::String newer;
    Notice notice;
    std::atomic<bool> started { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (UpdateCheck)
};

} // namespace snaptune
