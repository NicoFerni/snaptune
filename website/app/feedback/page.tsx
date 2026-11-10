import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { links } from "@/lib/site";
import { FeedbackForm } from "./FeedbackForm";
import "@/app/landing.css";
import "@/app/guide.css";
import "./feedback.css";

// Where the plugin's Feedback button lands (Source/Feedback.h), and the site's own "Send feedback"
// link: one box, no account. The plugin puts its version, format, DAW and system in the address;
// they're shown under the box and stored with the message. Messages show up in the admin panel.

export const metadata: Metadata = {
  title: "Send feedback about SnapTune",
  description: "Tell SnapTune's developer what works, what doesn't and what's missing. No account needed.",
  alternates: { canonical: "/feedback" },
  robots: { index: false, follow: true },
};

const one = (value: string | string[] | undefined, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export default async function Feedback({ searchParams }: PageProps<"/feedback">) {
  const query = await searchParams;
  const context = { v: one(query.v, 20), os: one(query.os, 60), host: one(query.host, 60), format: one(query.format, 20) };

  return (
    <main className="manual guide">
      <header className="nav">
        <Link href="/" className="nav-mark" aria-label="SnapTune home">
          <LogoMark className="nav-logo" />
          <span className="nav-name">SnapTune</span>
        </Link>
      </header>

      <article className="guide-body">
        <h1 className="heading guide-title">How is it going?</h1>
        <p className="guide-lead">
          Tell me what works, what doesn&apos;t and what&apos;s missing. I&apos;m one person building SnapTune, and this is how I find out what to
          fix next.
        </p>

        <FeedbackForm context={context} />

        <p className="feedback-other">
          For a bug you can reproduce, an <a href={links.issues}>issue on GitHub</a> is easier to follow up. Or write to{" "}
          <a href={links.support}>support@getsnaptune.com</a>.
        </p>
      </article>

      <footer className="guide-foot">
        <nav aria-label="Site">
          <Link href="/">SnapTune home</Link>
          <a href={links.repo}>Source on GitHub</a>
          <a href={links.x}>@getsnaptune on X</a>
        </nav>
      </footer>
    </main>
  );
}
