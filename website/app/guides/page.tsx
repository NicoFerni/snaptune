import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { guideBySlug, guidesIn } from "@/lib/guides";
import { JsonLd, breadcrumbs, shareImage, siteUrl } from "@/lib/seo";
import { links } from "@/lib/site";
import "@/app/landing.css";
import "@/app/guide.css";

// Every guide on one page, grouped: the hub that links them all, so each is one click from here and
// two from home.

const title = "SnapTune Guides: Free Autotune in FL Studio, Reaper, Ableton and More";
const description = "Guides to free autotune with SnapTune: the hard-tune sound, the free plugins compared, and setup in FL Studio, Reaper, Ableton, GarageBand, Bitwig and on Linux.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guides" },
  openGraph: { title, description, url: "/guides", siteName: "SnapTune", type: "website", images: [shareImage] },
};

const groups = [
  { heading: "Start here", slugs: ["free-autotune", "free-autotune-plugins", "hard-tune"] },
  { heading: "In your DAW", slugs: ["autotune-fl-studio", "autotune-reaper", "autotune-ableton", "autotune-garageband", "autotune-bitwig", "autotune-linux"] },
  { heading: "En español", slugs: guidesIn("es").map((g) => g.slug) },
];

export default function Guides() {
  const listed = groups.flatMap((g) => g.slugs).map(guideBySlug);
  return (
    <>
      <JsonLd data={breadcrumbs([{ name: "SnapTune", path: "/" }, { name: "Guides", path: "/guides" }])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: listed.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteUrl}/${g.slug}`, name: g.heading })),
        }}
      />
      <main className="manual guide">
        <header className="nav">
          <Link href="/" className="nav-mark" aria-label="SnapTune home">
            <LogoMark className="nav-logo" />
            <span className="nav-name">SnapTune</span>
          </Link>
          <Link href="/#install" className="button nav-action">
            Download
          </Link>
        </header>

        <article className="guide-body">
          <h1 className="heading guide-title">Guides</h1>
          <p className="guide-lead">
            SnapTune is a free, open-source autotune plugin for Mac, Windows and Linux. These pages answer the usual questions: how to get the hard-tune
            sound, how it compares with the other free plugins, and how to set it up in your DAW.
          </p>

          {groups.map((group) => (
            <section key={group.heading} className="guide-section">
              <h2 className="guide-heading">{group.heading}</h2>
              <ul className="guide-index">
                {group.slugs.map(guideBySlug).map((g) => (
                  <li key={g.slug} lang={g.lang ?? "en"}>
                    <Link href={`/${g.slug}`}>{g.heading}</Link>
                    <p>{g.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>

        <footer className="guide-foot">
          <nav aria-label="Site">
            <Link href="/">SnapTune home</Link>
            <a href={links.repo}>Source on GitHub</a>
            <a href={links.support}>support@getsnaptune.com</a>
            <Link href="/privacy">Privacy</Link>
          </nav>
          <p>Auto-Tune is a trademark of Antares Audio Technologies; SnapTune is an independent project, not affiliated with Antares.</p>
        </footer>
      </main>
    </>
  );
}
