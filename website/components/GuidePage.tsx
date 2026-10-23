import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Downloads } from "@/components/Downloads";
import { LogoMark } from "@/components/Logo";
import { guides, type Guide } from "@/lib/guides";
import { latestRelease } from "@/lib/release";
import { JsonLd, faqPage, shareImage, softwareApplication } from "@/lib/seo";
import { links } from "@/lib/site";
import "@/app/landing.css";
import "@/app/guide.css";

// A guide: one search answered as a page from the manual. The heading and lead say what it is, the
// sections say how, the questions are the ones that search brings, and the reply card closes it with
// the download.

export function guideMetadata(guide: Guide): Metadata {
  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: `/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, url: `/${guide.slug}`, siteName: "SnapTune", type: "article", modifiedTime: guide.updated, images: [shareImage] },
    twitter: { card: "summary_large_image", site: "@getsnaptune", creator: "@getsnaptune", title: guide.title, description: guide.description, images: [shareImage] },
  };
}

export async function GuidePage({ guide }: { guide: Guide }) {
  const release = await latestRelease();
  const others = guides.filter((g) => g.slug !== guide.slug);

  return (
    <>
      <JsonLd data={softwareApplication(release)} />
      <JsonLd data={faqPage(guide.faqs)} />
      <main className="manual guide">
        <header className="nav">
          <Link href="/" className="nav-mark" aria-label="SnapTune home">
            <LogoMark className="nav-logo" />
            <span className="nav-name">SnapTune</span>
          </Link>
          <nav className="nav-links" aria-label="Sections">
            <Link href="/#try">Try it</Link>
            <Link href="/#how">How it works</Link>
          </nav>
          <a href="#download" className="button nav-action">
            Download
          </a>
        </header>

        <article className="guide-body">
          <h1 className="heading guide-title">{guide.heading}</h1>
          <p className="guide-lead">{guide.lead}</p>

          <figure className="guide-plate">
            <Image src="/screenshot.png" width={1600} height={1024} alt="The SnapTune plugin window: tuner, Retune Speed knob and pitch graph" priority sizes="(min-width: 900px) 60vw, 100vw" />
          </figure>

          {guide.sections.map((s) => (
            <section key={s.heading} className="guide-section">
              <h2 className="guide-heading">{s.heading}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.steps && (
                <ol className="guide-steps">
                  {s.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
            </section>
          ))}

          <section className="guide-section">
            <h2 className="guide-heading">Questions</h2>
            {guide.faqs.map((f) => (
              <p key={f.q}>
                <b>{f.q}</b> {f.a}
              </p>
            ))}
          </section>
        </article>

        <section id="download" className="guide-download field-gold" aria-labelledby="download-title">
          <div className="reply-card">
            <h2 id="download-title" className="heading">
              Get SnapTune
            </h2>
            <p>Version {release.version}, free. Restart your DAW and rescan after installing.</p>
            <Downloads release={release} />
          </div>
        </section>

        <footer className="guide-foot">
          <nav aria-label="Guides">
            <Link href="/">SnapTune home</Link>
            {others.map((g) => (
              <Link key={g.slug} href={`/${g.slug}`}>
                {g.heading}
              </Link>
            ))}
            <a href={links.repo}>Source on GitHub</a>
            <a href={links.support}>support@getsnaptune.com</a>
            <a href={links.x}>@getsnaptune on X</a>
          </nav>
          <p>Auto-Tune is a trademark of Antares Audio Technologies; SnapTune is an independent project, not affiliated with Antares.</p>
        </footer>
      </main>
    </>
  );
}
