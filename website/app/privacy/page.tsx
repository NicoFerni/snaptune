import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { links } from "@/lib/site";

// What SnapTune and this site send and keep. Keep it in step with the code it describes:
// ../Source/Telemetry.cpp, ../Source/UpdateCheck.cpp, ../Source/Feedback.cpp, app/api/ping,
// app/download/[os], app/feedback, and the README's "Usage data" and "Feedback" sections. The
// Windows installer shows a short version of it (../packaging/windows/privacy.txt).

export const metadata: Metadata = {
  title: "Privacy · SnapTune",
  description: "What the SnapTune plugin and getsnaptune.com send and keep, and how to turn it off.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <PolicyPage
      title="Privacy"
      updated="10 November 2026"
      lead={
        <p>
          SnapTune never sends anything about your audio, your projects or your settings. It does send a short anonymous note once per DAW session,
          and you can turn that off. This page says exactly what goes where.
        </p>
      }
      sections={[
        {
          heading: "The plugin's usage ping",
          body: (
            <>
              <p>
                Once per DAW session, SnapTune sends to getsnaptune.com: the plugin version, the operating system&apos;s name, the CPU type (arm64 or
                x64), the DAW&apos;s name, the plugin format (VST3, AU, LV2 or the app), a random id made on your computer the first time it runs, and
                the same details for earlier sessions that ended without SnapTune shutting down (a crash of the plugin or the DAW).
              </p>
              <p>
                The server keeps the country the request came from, never the IP address. The random id isn&apos;t linked to you, your account or your
                computer&apos;s name. It&apos;s what lets me count installs and see whether people come back.
              </p>
            </>
          ),
        },
        {
          heading: "The update check",
          body: (
            <p>
              When the window opens, at most once a day, SnapTune asks getsnaptune.com/api/version for the latest version. Nothing is sent with that
              request. The answer can carry a short notice from me (a new version or a beta, for example) shown in the window&apos;s header; it can only
              open a page of getsnaptune.com.
            </p>
          ),
        },
        {
          heading: "Feedback",
          body: (
            <p>
              The Feedback button opens getsnaptune.com/feedback in your browser, with the plugin version, format, DAW and operating system in the
              page&apos;s address. Nothing is sent unless you press Send. What&apos;s kept is your message, those four details, your email address if you
              gave one (only to answer you), and the country. To stop the form being flooded, a one-way hash of your IP address is kept for one hour.
            </p>
          ),
        },
        {
          heading: "This website",
          body: (
            <p>
              The download buttons count each visitor once, from a one-way hash of the IP address added to a counter that can&apos;t give the hashes
              back. The site uses Vercel Web Analytics and Speed Insights, which count page views and loading times without cookies. The installers
              themselves are served by GitHub.
            </p>
          ),
        },
        {
          heading: "Turning it off",
          body: (
            <>
              <p>
                The Windows installer has a box for usage data; untick it and SnapTune sends nothing. On any system, create an empty file named{" "}
                <code>no-telemetry</code> in the SnapTune folder (<code>~/Library/Application Support/SnapTune</code> on a Mac,{" "}
                <code>%APPDATA%\SnapTune</code> on Windows, <code>~/.config/SnapTune</code> on Linux), or set the environment variable{" "}
                <code>SNAPTUNE_NO_TELEMETRY=1</code>.
              </p>
              <p>That turns off the usage ping and the update check. The Feedback button still works, and still sends nothing until you press Send.</p>
            </>
          ),
        },
        {
          heading: "Where it's kept, and for how long",
          body: (
            <p>
              The site runs on Vercel and the data is stored with Upstash, both in the United States. The usage log keeps the latest 20,000 sessions and
              drops older ones; feedback keeps the latest 2,000 messages. Mail to support@getsnaptune.com goes through Zoho. Nothing is sold or shared
              with anyone else.
            </p>
          ),
        },
        {
          heading: "Your data, and questions",
          body: (
            <p>
              To have a feedback message or email address deleted, or for anything else about this page, write to{" "}
              <a href={links.support}>support@getsnaptune.com</a>. The usage ping carries no name or address, so there&apos;s nothing in it to tie back
              to you. All of the code that sends anything is in the <a href={links.repo}>source on GitHub</a>. SnapTune is made by Nico Fernandez.
            </p>
          ),
        },
      ]}
    />
  );
}
