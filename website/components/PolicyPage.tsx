import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { links } from "@/lib/site";
import "@/app/landing.css";
import "@/app/guide.css";

// A page of plain policy text (privacy, terms), set like the guides: the manual's reading
// column on the green ground, with the site's links below.

export type PolicySection = { heading: string; body: React.ReactNode };

export function PolicyPage({ title, lead, updated, sections }: { title: string; lead: React.ReactNode; updated: string; sections: PolicySection[] }) {
  return (
    <main className="manual guide">
      <header className="nav">
        <Link href="/" className="nav-mark" aria-label="SnapTune home">
          <LogoMark className="nav-logo" />
          <span className="nav-name">SnapTune</span>
        </Link>
      </header>

      <article className="guide-body">
        <h1 className="heading guide-title">{title}</h1>
        <div className="guide-lead">{lead}</div>
        <p className="guide-updated">Last changed {updated}.</p>

        {sections.map((s) => (
          <section key={s.heading} className="guide-section">
            <h2 className="guide-heading">{s.heading}</h2>
            {s.body}
          </section>
        ))}
      </article>

      <footer className="guide-foot">
        <nav aria-label="Site">
          <Link href="/">SnapTune home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={links.repo}>Source on GitHub</a>
          <a href={links.support}>support@getsnaptune.com</a>
        </nav>
      </footer>
    </main>
  );
}
