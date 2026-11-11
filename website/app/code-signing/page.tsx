import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/PolicyPage";
import { links } from "@/lib/site";

// The code signing policy SignPath Foundation asks open-source projects to publish
// (https://signpath.org/terms): who may change the code, who approves each signed release, and the
// privacy policy. Linked from the footer of every page and from the release notes.

export const metadata: Metadata = {
  title: "Code signing policy",
  description: "How SnapTune's Windows installers are signed, and who approves each release.",
  alternates: { canonical: "/code-signing" },
};

export default function CodeSigning() {
  return (
    <PolicyPage
      title="Code signing policy"
      updated="10 November 2026"
      lead={
        <p>
          Free code signing provided by <a href="https://about.signpath.io">SignPath.io</a>, certificate by{" "}
          <a href="https://signpath.org">SignPath Foundation</a>.
        </p>
      }
      sections={[
        {
          heading: "What is signed",
          body: (
            <p>
              The Windows installer and the files it installs (the VST3 plugin and the standalone app), built from the public{" "}
              <a href={links.repo}>source on GitHub</a> by GitHub Actions for each release. Only SnapTune&apos;s own files are signed; the libraries it
              is built from are compiled into them from source.
            </p>
          ),
        },
        {
          heading: "Team",
          body: (
            <>
              <p>SnapTune has one maintainer, who holds all three roles:</p>
              <ul className="guide-steps">
                <li>
                  <b>Committer and reviewer:</b> <a href="https://github.com/NicoFerni">Nico Fernandez</a>. Changes from anyone else are reviewed before
                  they are merged.
                </li>
                <li>
                  <b>Approver:</b> <a href="https://github.com/NicoFerni">Nico Fernandez</a>. Every signing request is approved by hand.
                </li>
              </ul>
              <p>Every team member uses multi-factor authentication on GitHub and SignPath.</p>
            </>
          ),
        },
        {
          heading: "Privacy",
          body: (
            <p>
              SnapTune sends an anonymous usage ping once per DAW session and checks for updates once a day; the Windows installer has a box to turn
              both off. The <Link href="/privacy">privacy policy</Link> says exactly what is sent and kept.
            </p>
          ),
        },
      ]}
    />
  );
}
