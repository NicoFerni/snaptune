import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { kofi, links } from "@/lib/site";

// The terms for the site, the downloads, the feedback form and donations. The plugin's own licence is
// the AGPL-3.0 in ../LICENSE; nothing here takes away from it. Keep it in step with app/privacy.

export const metadata: Metadata = {
  title: "Terms · SnapTune",
  description: "The terms for getsnaptune.com, the SnapTune downloads, the feedback form and donations. The plugin itself is licensed under the AGPL-3.0.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <PolicyPage
      title="Terms"
      updated="12 November 2026"
      lead={
        <p>
          SnapTune is free and open source. These terms cover this website, the downloads, the feedback form and donations. The plugin itself is
          licensed under the <a href={links.license}>GNU Affero General Public License, version 3</a> (AGPL-3.0), and nothing here takes away any right
          that licence gives you.
        </p>
      }
      sections={[
        {
          heading: "Using SnapTune",
          body: (
            <>
              <p>
                You can use SnapTune for free, on as many computers as you like, for any music, commercial releases included. What you record and tune
                with it is yours: SnapTune claims nothing over your audio, and never sends it anywhere.
              </p>
              <p>
                You can study, change and share the code under the AGPL-3.0. If you share a changed version, or let people use one over a network, the
                licence asks you to share its source code too. If the licence doesn&apos;t fit what you want to do, write to{" "}
                <a href={links.support}>support@getsnaptune.com</a>.
              </p>
            </>
          ),
        },
        {
          heading: "No warranty",
          body: (
            <>
              <p>
                SnapTune is made by one person and given away as it is, without any warranty, as the AGPL-3.0 says. I test every release, but I
                can&apos;t promise it works in every DAW, on every computer or with every voice. Save your projects and keep backups.
              </p>
              <p>
                As far as the law allows, I&apos;m not liable for any loss or damage from using SnapTune or this site, including lost work, lost sessions
                or a DAW that crashes.
              </p>
            </>
          ),
        },
        {
          heading: "Downloads",
          body: (
            <p>
              Download SnapTune only from this site or from the <a href={links.releases}>releases on GitHub</a>. The installers aren&apos;t signed yet,
              so macOS and Windows ask before running them; a copy from anywhere else may have been changed.
            </p>
          ),
        },
        {
          heading: "The feedback form and support",
          body: (
            <p>
              Send what you like about SnapTune, but no spam, abuse or attempts to break the site. I read everything and use it to improve SnapTune; I
              can&apos;t promise to answer every message. What the form keeps is on the <a href="/privacy">privacy page</a>.
            </p>
          ),
        },
        {
          heading: "Donations",
          body: (
            <p>
              Donations through <a href={kofi.url}>Ko-fi</a> are a gift toward SnapTune&apos;s costs, such as code signing. They don&apos;t buy a
              licence, features or support, and SnapTune stays free whether or not you give. Ko-fi handles the payment under its own terms.
            </p>
          ),
        },
        {
          heading: "Names and trademarks",
          body: (
            <p>
              SnapTune&apos;s name and logo belong to its maker; the AGPL-3.0 covers the code, not the name. Auto-Tune is a trademark of Antares Audio
              Technologies, and SnapTune is not affiliated with Antares. FL Studio, VST, Audio Units and the other product names on this site belong to
              their owners and are used only to say what SnapTune works with.
            </p>
          ),
        },
        {
          heading: "Changes, law and contact",
          body: (
            <p>
              If these terms change, this page will show the new date at the top. They are governed by the laws of the State of Delaware, United States, without regard to its conflict-of-law rules. For questions, write to{" "}
              <a href={links.support}>support@getsnaptune.com</a>. SnapTune is made by Nico Fernandez.
            </p>
          ),
        },
      ]}
    />
  );
}
