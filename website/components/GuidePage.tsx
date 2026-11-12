import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Downloads } from "@/components/Downloads";
import { LogoMark } from "@/components/Logo";
import { guideBySlug, guidesIn, type Guide } from "@/lib/guides";
import { latestRelease } from "@/lib/release";
import { JsonLd, breadcrumbs, faqPage, shareImage, softwareApplication, techArticle } from "@/lib/seo";
import { links } from "@/lib/site";
import "@/app/landing.css";
import "@/app/guide.css";

// A guide: one search answered as a page from the manual. The heading and lead say what it is (the
// lead's first sentence is the answer, for search snippets and AI assistants alike), the sections say
// how, the questions are the ones that search brings, and the reply card closes it with the download.

const words = {
  en: {
    home: "SnapTune home",
    homeLabel: "SnapTune home",
    tryIt: "Try it",
    how: "How it works",
    download: "Download",
    guides: "Guides",
    questions: "Questions",
    get: "Get SnapTune",
    version: (v: string) => `Version ${v}, free. Restart your DAW and rescan after installing.`,
    updated: (d: string) => `Updated ${d}`,
    by: "by Nico Fernandez, who makes SnapTune",
    alt: "The SnapTune plugin window: tuner, Retune Speed knob and pitch graph",
    source: "Source on GitHub",
    feedback: "Send feedback",
    privacy: "Privacy",
    other: "En español",
    trademark: "Auto-Tune is a trademark of Antares Audio Technologies; SnapTune is an independent project, not affiliated with Antares.",
    locale: "en-GB",
  },
  es: {
    home: "Inicio de SnapTune",
    homeLabel: "Inicio de SnapTune",
    tryIt: "Pruébalo",
    how: "Cómo funciona",
    download: "Descargar",
    guides: "Guías",
    questions: "Preguntas",
    get: "Descarga SnapTune",
    version: (v: string) => `Versión ${v}, gratis. Después de instalar, reinicia el DAW y vuelve a escanear los plugins.`,
    updated: (d: string) => `Actualizado el ${d}`,
    by: "por Nico Fernandez, que hace SnapTune",
    alt: "La ventana del plugin SnapTune: afinador, perilla Retune Speed y gráfico de altura",
    source: "Código en GitHub",
    feedback: "Enviar comentarios",
    privacy: "Privacidad",
    other: "In English",
    trademark: "Auto-Tune es una marca de Antares Audio Technologies; SnapTune es un proyecto independiente, sin relación con Antares.",
    locale: "es",
  },
};

const langOf = (guide: Guide) => guide.lang ?? "en";

/** A date like "12 November 2026", or "12 de noviembre de 2026". */
const longDate = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

export function guideMetadata(guide: Guide): Metadata {
  const path = `/${guide.slug}`;
  const lang = langOf(guide);
  // hreflang: each language version names itself and the other; English is the default.
  const languages = guide.translation
    ? lang === "en"
      ? { en: path, es: `/${guide.translation}`, "x-default": path }
      : { en: `/${guide.translation}`, es: path, "x-default": `/${guide.translation}` }
    : undefined;
  return {
    title: guide.title,
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: path, languages },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: path,
      siteName: "SnapTune",
      type: "article",
      locale: lang === "es" ? "es_419" : "en_US",
      publishedTime: guide.published,
      modifiedTime: guide.updated,
      authors: ["Nico Fernandez"],
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", site: "@getsnaptune", creator: "@getsnaptune", title: guide.title, description: guide.description, images: [shareImage] },
  };
}

export async function GuidePage({ guide }: { guide: Guide }) {
  const release = await latestRelease();
  const lang = langOf(guide);
  const t = words[lang];
  const others = guidesIn(lang).filter((g) => g.slug !== guide.slug);
  const translation = guide.translation ? guideBySlug(guide.translation) : null;

  return (
    <>
      <JsonLd data={softwareApplication(release)} />
      <JsonLd
        data={techArticle({ path: `/${guide.slug}`, headline: guide.heading, description: guide.description, lang, published: guide.published, updated: guide.updated })}
      />
      <JsonLd
        data={breadcrumbs([
          { name: "SnapTune", path: "/" },
          { name: t.guides, path: "/guides" },
          { name: guide.heading, path: `/${guide.slug}` },
        ])}
      />
      <JsonLd data={faqPage(guide.faqs)} />
      <main className="manual guide" lang={lang}>
        <header className="nav">
          <Link href="/" className="nav-mark" aria-label={t.homeLabel}>
            <LogoMark className="nav-logo" />
            <span className="nav-name">SnapTune</span>
          </Link>
          <nav className="nav-links" aria-label="Sections">
            <Link href="/#try">{t.tryIt}</Link>
            <Link href="/#how">{t.how}</Link>
          </nav>
          <a href="#download" className="button nav-action">
            {t.download}
          </a>
        </header>

        <article className="guide-body">
          <h1 className="heading guide-title">{guide.heading}</h1>
          <p className="guide-lead">{guide.lead}</p>
          <p className="guide-updated">
            <time dateTime={guide.updated}>{t.updated(longDate(guide.updated, t.locale))}</time>, {t.by}
            {translation && (
              <>
                {" · "}
                <Link href={`/${translation.slug}`} hrefLang={translation.lang ?? "en"}>
                  {t.other}
                </Link>
              </>
            )}
          </p>

          <figure className="guide-plate">
            <Image src="/screenshot.png" width={1600} height={1024} alt={t.alt} priority sizes="(min-width: 900px) 60vw, 100vw" />
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
              {s.table && (
                <div className="guide-table">
                  <table>
                    <caption>{s.table.caption}</caption>
                    <thead>
                      <tr>
                        {s.table.head.map((h) => (
                          <th key={h} scope="col">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map(([name, ...cells]) => (
                        <tr key={name}>
                          <th scope="row">{name}</th>
                          {cells.map((c, i) => (
                            <td key={i}>{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {s.sources && (
                <ul className="guide-sources">
                  {s.sources.map((src) => (
                    <li key={src.href}>
                      <a href={src.href} rel="noopener">
                        {src.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="guide-section">
            <h2 className="guide-heading">{t.questions}</h2>
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
              {t.get}
            </h2>
            <p>{t.version(release.version)}</p>
            <Downloads release={release} lang={lang} />
          </div>
        </section>

        <footer className="guide-foot">
          <nav aria-label={t.guides}>
            <Link href="/">{t.home}</Link>
            {others.map((g) => (
              <Link key={g.slug} href={`/${g.slug}`}>
                {g.heading}
              </Link>
            ))}
            <Link href="/guides">{t.guides}</Link>
            <a href={links.repo}>{t.source}</a>
            <Link href={links.feedback}>{t.feedback}</Link>
            <a href={links.support}>support@getsnaptune.com</a>
            <a href={links.x}>@getsnaptune on X</a>
            <Link href="/privacy">{t.privacy}</Link>
          </nav>
          <p>{t.trademark}</p>
        </footer>
      </main>
    </>
  );
}
