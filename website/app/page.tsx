import { readFileSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Downloads } from "@/components/Downloads";
import { HowRow, type Moment } from "@/components/HowRow";
import { Cent, LogoMark } from "@/components/Logo";
import { Motion } from "@/components/Motion";
import { SnapTuneDemo } from "@/components/demo/SnapTuneDemo";
import { guides } from "@/lib/guides";
import { latestRelease } from "@/lib/release";
import { JsonLd, faqPage, softwareApplication } from "@/lib/seo";
import shots from "@/lib/shots.json";
import { hasPublicFile, kofi, links } from "@/lib/site";
import "./landing.css";

// The page is set like the manual that ships with a precision instrument: a gold cover, a playable
// plate, a sheet per feature, a receipt, the method with its 19th-century ancestors, a letter from the
// maker, notes at the back and a reply card.

type Shot = keyof typeof shots;

const sheets: { name: string; field: "gold" | "surface" | "deep"; text: ReactNode; shot: Shot; alt: string }[] = [
  {
    name: "Robot to natural",
    field: "gold",
    text: "At 0 ms, Retune Speed jumps straight to the note: the hard, stair-step sound. Turn it up and your slides and vibrato come back. Humanize relaxes the long notes.",
    shot: "tuner",
    alt: "The tuner reading G3, sung 40 cents flat, output in tune, above the Retune Speed knob at 8 ms",
  },
  {
    name: "Your key, or your melody",
    field: "surface",
    text: "Set the key and one of 13 scales, or switch notes on and off by hand. Hold notes on a MIDI track and the voice follows those instead, in any octave.",
    shot: "keys",
    alt: "The scale notes of C major lit, G being tuned to, beside the graph’s keyboard",
  },
  {
    name: "Your voice, kept",
    field: "deep",
    text: "In Studio mode the pitch moves and the character doesn’t: no chipmunk. The Formant knob shifts it on purpose, five semitones either way.",
    shot: "voice",
    alt: "The Formant knob at 0.0 semitones",
  },
  {
    name: "You can watch it",
    field: "gold",
    text: "The dashed line is what you sang and the solid one is what comes out, on lanes for the notes in your key. The tuner says which note, and how many cents off.",
    shot: "graph",
    alt: "The pitch graph: the sung pitch dashed, the output pitch solid on the note lanes",
  },
  {
    name: "Two speeds",
    field: "surface",
    text: "Live answers in 2.7 ms, so you can hear yourself tuned while you record. Studio takes 46 ms for the cleanest result, and tells your DAW so everything stays lined up.",
    shot: "modes",
    alt: "The latency reading 2.7 ms with Live selected",
  },
];

const receipt: { group: string; rows: string[] }[] = [
  { group: "The plugin", rows: ["VST3 for Mac", "Audio Unit for Mac", "VST3 for Windows, 64-bit", "VST3 and LV2 for Linux", "Standalone app"] },
  { group: "Inside", rows: ["Six factory presets", "Thirteen scales", "MIDI target notes", "Studio and Live modes"] },
  { group: "Later", rows: ["Updates", "The source code"] },
];

const moments: Moment[] = [
  {
    caption: "Your voice comes in",
    text: "Mono, from the vocal’s own track. A beat or a full mix has no single pitch to follow.",
    gap: 96,
    picture: { src: "/archive/voice-in.jpg", width: 560, height: 700, alt: "Engraving of a phonautograph: a horn above a table, on a stand", note: "Clarence Blake’s phonautograph, 1878." },
  },
  {
    caption: "It finds the pitch",
    text: "Every 2.7 ms the YIN method (de Cheveigné and Kawahara, 2002) measures the period, to under a tenth of a cent on a steady tone.",
    gap: 136,
    picture: { src: "/archive/find-pitch.jpg", width: 560, height: 700, alt: "Engraving: a horn piped to a small gas flame, whose flicker shows as a row of waves in a mirror above it", note: "Rudolph Koenig’s manometric flame, which showed sound as waves in a mirror. Drawn in 1878–79." },
  },
  {
    caption: "It picks the note",
    text: "The nearest one in your key or your MIDI notes, held for an eighth of a semitone so it doesn’t flicker between two.",
    gap: 80,
    picture: { src: "/archive/pick-note.jpg", width: 560, height: 700, alt: "Engraving of a tuning fork kept ringing by two electromagnets", note: "Rudolph Koenig’s tuning fork and resonator, from his 1865 price list." },
  },
  {
    caption: "It decides how fast",
    text: "Retune Speed smooths the move. At 0 ms it jumps; slower settings let vibrato through and still correct the drift.",
    gap: 124,
    picture: { src: "/archive/how-fast.jpg", width: 560, height: 700, alt: "Drawing of a phonautograph: a barrel-shaped horn, a hand crank and a drum", note: "A phonautograph, drawn in 1909." },
  },
  {
    caption: "It moves the pitch",
    text: "Studio re-spaces small grains of the wave (TD-PSOLA, 1990), so the formants stay put. Live reads through a short delay line instead.",
    gap: 88,
    picture: { src: "/archive/move-pitch.jpg", width: 560, height: 700, alt: "Engraving of the 1859 phonautograph’s horn and recording drum", note: "Scott de Martinville’s phonautograph, 1859 model." },
  },
  {
    caption: "You hear it tuned",
    text: "46 ms later in Studio, which your DAW compensates; 2.7 ms later in Live, quick enough to sing through.",
    gap: 140,
    picture: { src: "/archive/hear-it.jpg", width: 560, height: 700, alt: "Photograph of Thomas Edison seated beside his phonograph", note: "Thomas Edison with the phonograph, around 1878. It played the sound back." },
  },
];

// `text` is the answer as plain text, for search engines, where `a` has links in it.
const faqs: { q: string; a: ReactNode; text?: string }[] = [
  {
    q: "Is it actually free?",
    a: (
      <>
        Yes. It’s open source under the <a href={links.license}>AGPL-3.0 licence</a>: no trial, no watermark, no account.
      </>
    ),
    text: "Yes. It’s a free autotune plugin, open source under the AGPL-3.0 licence: no trial, no watermark, no account.",
  },
  {
    q: "Is it a free autotune for FL Studio?",
    a: (
      <>
        Yes, and FL Studio is where I test it. It loads in any edition that takes VST3 plugins, so it also works as a free alternative if yours
        doesn’t include Pitcher. <Link href="/autotune-fl-studio">The FL Studio guide</Link> shows the setup.
      </>
    ),
    text: "Yes, and FL Studio is where I test it. It loads in any edition that takes VST3 plugins, so it also works as a free alternative if yours doesn’t include Pitcher.",
  },
  {
    q: "It isn’t doing anything to my vocal.",
    a: "It needs the vocal on its own track; on a beat or a full mix there is no single pitch to follow. If the voice is breathy or the room echoes, raise Tracking. For deep voices, set Voice to Low Male.",
  },
  {
    q: "macOS says the installer can’t be opened.",
    a: "That’s the missing Apple notarization, not a broken file. Click Done, then open System Settings, Privacy & Security, and click Open Anyway. On macOS 14 or earlier, right-click the installer and choose Open.",
  },
  {
    q: "Windows says it protected my PC.",
    a: "That’s SmartScreen: the installer isn’t code-signed yet. Click More info, then Run anyway.",
  },
  {
    q: "Does it run on Linux?",
    a: "Yes, as a VST3, an LV2 and a standalone app, on 64-bit Linux with glibc 2.35 or newer (Ubuntu 22.04 and later). Unpack the download and run install.sh. The Linux builds are new and I haven’t tried them in a Linux DAW yet, so if yours has trouble, open an issue and say which DAW and distribution.",
  },
  {
    q: "Does it work in Ableton, Logic, Reaper…?",
    a: (
      <>
        I test it in FL Studio, and every build passes Apple’s Audio Unit validation. Other DAWs that load VST3, AU or LV2 should work, but I
        haven’t tried each one. If yours gives you trouble, <a href={links.issues}>open an issue</a> or write to{" "}
        <a href={links.support}>support@getsnaptune.com</a>, and say which DAW and version.
      </>
    ),
    text: "I test it in FL Studio, and every build passes Apple’s Audio Unit validation. Other DAWs that load VST3, AU or LV2 should work, but I haven’t tried each one. If yours gives you trouble, write to support@getsnaptune.com and say which DAW and version.",
  },
  {
    q: "Studio or Live?",
    a: "Live while you record: 2.7 ms, so you hear yourself tuned. Studio when you mix: 46 ms, compensated by your DAW, and the voice keeps its character on big jumps.",
  },
  {
    q: "Can it follow a melody I write?",
    a: "Yes. Turn on MIDI notes and send it a MIDI track: while a note is held, the voice is tuned to that note in any octave, and it goes back to the scale when you let go. In FL Studio, set the wrapper’s MIDI input port and add a MIDI Out channel on the same port.",
  },
  {
    q: "Why does it sound robotic?",
    a: "Retune Speed is at 0 ms, the Hard Tune preset, which is on purpose for that sound. For a natural result, pick Natural or Subtle Polish, or turn Retune Speed up.",
  },
  {
    q: "An update doesn’t show up.",
    a: "Your DAW keeps the old plugin loaded until it restarts. Quit it completely and open it again.",
  },
  {
    q: "What does it send home?",
    a: (
      <>
        Once per DAW session, an anonymous ping: the plugin’s version, the system, the DAW’s name, the format and a random install id, and whether
        the last session ended in a crash. Nothing about your audio or your projects. The <a href={`${links.repo}#usage-data`}>README</a> says
        how to turn it off.
      </>
    ),
    text: "Once per DAW session, an anonymous ping: the plugin’s version, the system, the DAW’s name, the format and a random install id, and whether the last session ended in a crash. Nothing about your audio or your projects.",
  },
  {
    q: "Is this Auto-Tune?",
    a: "No. Auto-Tune is a trademark of Antares, and SnapTune has no connection to them. It’s built on published methods, and the README explains each part.",
  },
];

/** A receipt's torn bottom edge: `teeth` points along the bottom of a clip-path polygon. */
function zigzag(teeth: number, depth = 12) {
  const points = ["0 0", "100% 0"];
  for (let i = teeth; i >= 0; --i) points.push(`${(100 * i) / teeth}% ${i % 2 === 0 ? `calc(100% - ${depth}px)` : "100%"}`);
  return `polygon(${points.join(", ")})`;
}

/** Semicircles in the ground's colour, bitten out of a sheet's edge. */
function Scallops({ count, edge }: { count: number; edge: "top" | "bottom" }) {
  return (
    <span className={`scallops scallops-${edge}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  );
}

type Credit = { file: string; title: string; label?: string; creator: string | null; license: string; page: string; via: string };

/** The found pictures on the page, credited in the imprint. */
function pictureCredits() {
  const used = new Set(["fig-13-the-phonautograph-of-clarence-john.jpg", "koenig-manometric-flame-1878.jpg", "koenig-tuning-fork-and-resonator-1865.jpg", "phonautograph-1909.jpg", "phonautograph-1859.jpg", "edison-and-phonograph-edit2.jpg", "phonautographe.jpg"]);
  const all = JSON.parse(readFileSync(join(process.cwd(), "public", "archive", "credits.json"), "utf8")) as Credit[];
  return all.filter((c) => used.has(c.file.split("/").pop()!));
}

function SheetPicture({ shot, alt }: { shot: Shot; alt: string }) {
  const { src, width, height } = shots[shot];
  return <Image src={src} width={width} height={height} alt={alt} sizes="(min-width: 900px) 50vw, 100vw" />;
}

export default async function Home() {
  const release = await latestRelease();
  const { version } = release;
  const shortVersion = version.replace(/\.0$/, "");
  const hasLoop = hasPublicFile("/media/snaptune-loop.mp4");
  const credits = pictureCredits();

  return (
    <>
      <JsonLd data={softwareApplication(release)} />
      <JsonLd data={faqPage(faqs.map((f) => ({ q: f.q, a: f.text ?? String(f.a) })))} />
      <Motion />
      <main id="top" className="manual">
        {/* The cover: the nav sits on the field above it, the card runs past the fold. */}
        <header className="nav">
          <a href="#top" className="nav-mark" aria-label="SnapTune, back to the top">
            <LogoMark className="nav-logo" />
            <span className="nav-name">SnapTune</span>
          </a>
          <nav className="nav-links" aria-label="Sections">
            <a href="#try">Try it</a>
            <a href="#how">How it works</a>
            <a href="#install">Install</a>
          </nav>
          <a href="#install" className="button nav-action">
            Download
          </a>
        </header>

        <section className="cover" aria-labelledby="title">
          {/* Marginalia: the spec plate split across the empty columns either side of the card. */}
          <dl className="cover-margin cover-margin-left" data-rise style={{ ["--i" as string]: 4 }}>
            <div>
              <dt>Edition</dt>
              <dd className="margin-figure">No.&nbsp;{shortVersion}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd className="margin-figure">0¢</dd>
            </div>
            <div>
              <dt>Licence</dt>
              <dd>AGPL, source on GitHub</dd>
            </div>
          </dl>
          <dl className="cover-margin cover-margin-right" data-rise style={{ ["--i" as string]: 5 }}>
            <div>
              <dt>Account needed</dt>
              <dd className="margin-figure">None</dd>
            </div>
            <div>
              <dt>Formats</dt>
              <dd>VST3, AU and LV2</dd>
            </div>
            <div>
              <dt>Systems</dt>
              <dd>Mac, Windows and Linux</dd>
            </div>
          </dl>
          <div className="cover-card">
            {["tl", "tr", "bl", "br"].map((c) => (
              <span key={c} className={`corner corner-${c}`} aria-hidden="true" />
            ))}
            <h1 id="title" className="cover-title" data-rise>
              <span>Snap</span>
              <span>Tune</span>
            </h1>
            <p className="cover-line" data-rise style={{ ["--i" as string]: 1 }}>
              A free autotune plugin that snaps your vocal onto the key, from robot to natural, with 2.7&nbsp;ms of delay while you record.</p>
            <ul className="cover-details" aria-label="At a glance" data-rise style={{ ["--i" as string]: 2 }}>
              <li>Version {shortVersion}</li>
              <li>Mac, Windows and Linux</li>
              <li>VST3, AU and LV2</li>
              <li>Open source</li>
            </ul>
            <figure className="cover-plate" data-rise style={{ ["--i" as string]: 3 }}>
              {hasLoop ? (
                <video src="/media/snaptune-loop.mp4" poster="/media/snaptune-loop.jpg" autoPlay muted loop playsInline aria-label="The SnapTune window tuning the test voice" />
              ) : (
                <Image src="/screenshot.png" width={1600} height={1024} alt="The SnapTune window" priority />
              )}
              <figcaption>The window, tuning the synthesized test voice in Hard Tune and then Natural.</figcaption>
            </figure>
            <nav className="cover-contents" aria-labelledby="contents-title">
              <h2 id="contents-title">Contents</h2>
              <ul>
                <li><a href="#try">Play it here</a></li>
                <li><a href="#features">What it does</a></li>
                <li><a href="#price">What it costs</a></li>
                <li><a href="#how">How it works</a></li>
                <li><a href="#maker">A note from me</a></li>
                <li><a href="#questions">Questions</a></li>
                <li><a href="#install">Install</a></li>
              </ul>
            </nav>
          </div>
        </section>

        {/* The playable plate. */}
        <section id="try" className="section showcase" aria-labelledby="try-title">
          <SnapTuneDemo version={shortVersion} />
        </section>

        {/* One sheet per capability, stacking like the leaves of a folder. */}
        <section id="features" className="section features" aria-labelledby="features-title">
          <h2 id="features-title" className="heading features-heading" data-reveal>
            What it does
          </h2>
          <div className="sheets">
            {sheets.map((s, i) => (
              <article key={s.name} className={`sheet field-${s.field}`} style={{ ["--i" as string]: i }}>
                <h3 className="sheet-name">{s.name}</h3>
                <p className="sheet-text" data-reveal>
                  {s.text}
                </p>
                <div className="sheet-picture" data-ui data-reveal>
                  <SheetPicture shot={s.shot} alt={s.alt} />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* The total, and the slip that adds up to it. */}
        <section id="price" className="section price" aria-labelledby="price-title">
          <div className="price-words">
            <div data-reveal>
              <h2 id="price-title" className="heading">
                Priced at 0¢
              </h2>
              <p className="price-note">No trial, no watermark, no account. The source is on GitHub under the AGPL.</p>
            </div>
            <div className="price-total" data-reveal>
              <p className="total-figure" aria-label="Zero cents">
                0¢
              </p>
              <p className="total-caption">Everything on the slip, added up.</p>
            </div>
          </div>
          <div className="slip" data-reveal style={{ clipPath: zigzag(28) }}>
            <p className="slip-head">
              SnapTune {shortVersion}
              <span>Receipt</span>
            </p>
            {receipt.map((g) => (
              <div key={g.group} className="slip-group">
                <p className="slip-group-name">{g.group}</p>
                <ul>
                  {g.rows.map((row) => (
                    <li key={row}>
                      <span>{row}</span>
                      <span className="slip-leader" aria-hidden="true" />
                      <span className="slip-value">0¢</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="slip-total">
              <span>Total</span>
              <span>0¢</span>
            </p>
          </div>
        </section>

        {/* The method, moment by moment, beside the machines that first drew a voice. */}
        <section id="how" className="section how" aria-labelledby="how-title">
          <div className="how-head" data-reveal>
            <h2 id="how-title" className="heading">
              How it works
            </h2>
            <p className="how-intro">
              In 1857 a machine drew a voice as a line for the first time. SnapTune does the same 375 times a second, then moves the line onto the
              note. The <a href={links.readme}>README</a> has the maths.
            </p>
          </div>
          <HowRow moments={moments} />
        </section>

        {/* The maker's letter, on a sheet with a tear-off strip. */}
        <section id="maker" className="section maker" aria-labelledby="maker-title">
          <article className="letter" data-reveal>
            <Cent className="letter-mark" />
            <h2 id="maker-title" className="visually-hidden">
              A note from me
            </h2>
            <p>SnapTune is free and open source, and one person makes it: me.</p>
            <p>
              I test it in FL Studio. Every build also passes Apple’s Audio Unit validation, and other DAWs that load VST3 or AU should work, but I
              haven’t tried them all. If yours gives you trouble, <a href={links.issues}>open an issue</a> or email{" "}
              <a href={links.support}>support@getsnaptune.com</a>, and tell me the DAW and its version.
            </p>
            <p>
              On a Mac the installer opens with a warning the first time, because SnapTune isn’t notarized yet. That takes Apple’s developer
              membership, <b>${kofi.goal} a year</b>. If SnapTune is useful to you, chipping in on Ko-fi is how that warning goes away for everyone.
            </p>
            {kofi.raised > 0 && (
              <p className="letter-goal">
                ${Math.min(kofi.raised, kofi.goal)} of ${kofi.goal} so far.
                <span className="letter-bar" aria-hidden="true">
                  <span style={{ transform: `scaleX(${Math.min(1, kofi.raised / kofi.goal)})` }} />
                </span>
              </p>
            )}
            <p>
              The code, the method and the tests are all on <a href={links.repo}>GitHub</a>. If you want to know exactly what it does to your voice,
              it’s written down.
            </p>
            <p className="letter-sign">
              Nico Fernandez
              <span>Maker of SnapTune</span>
            </p>
            <div className="letter-strip">
              <a href={kofi.url}>ko-fi.com/nicofernandev</a>
              <a href={kofi.url} className="button button-ink">
                Chip in
              </a>
            </div>
            <Scallops count={16} edge="bottom" />
          </article>
        </section>

        {/* Questions, set as reading text. */}
        <section id="questions" className="section questions" aria-labelledby="questions-title">
          <h2 id="questions-title" className="heading" data-reveal>
            Questions
          </h2>
          <div className="answers">
            {faqs.map((f) => (
              <p key={f.q} data-reveal>
                <b>{f.q}</b> {f.a}
              </p>
            ))}
          </div>
        </section>

      </main>

      {/* The reply card, and under it the back of the card, uncovered as the field slides away. */}
      <div className="curtain">
        <section id="install" className="install field-gold" aria-labelledby="install-title">
          <p className="install-note" data-reveal>
            The installer puts everything in place. A Mac or a Windows PC asks once before opening it, because it isn’t signed yet; the questions
            above say what to click.
          </p>
          <div className="reply-card" data-reveal>
            <h2 id="install-title" className="heading">
              Install it
            </h2>
            <p>
              Version {version}. On a Mac: the VST3, the Audio Unit and a standalone app. On Windows: the VST3 and the app.
              {release.linux && " On Linux: the VST3, the LV2 and the app, with an install script."} Then restart your DAW and rescan.
            </p>
            <Downloads release={release} />
          </div>
        </section>

        <footer className="back">
        <div className="back-card">
          <Scallops count={12} edge="top" />
          <div className="back-message">
            <p className="back-title" data-under="install">
              Tuned to 0¢
            </p>
            <p>Sing it however it comes out. SnapTune will put it on the note.</p>
          </div>
          <div className="back-address">
            <figure className="stamp">
              <Image src="/archive/phonautographe.jpg" width={1920} height={1074} alt="Engraving of the phonautograph" sizes="96px" />
            </figure>
            {guides.map((g) => (
              <Link key={g.slug} href={`/${g.slug}`}>
                {g.heading}
              </Link>
            ))}
            <a href={links.repo}>Source on GitHub</a>
            <a href={links.issues}>Report a bug</a>
            <a href={links.support}>support@getsnaptune.com</a>
            <a href={links.x}>@getsnaptune on X</a>
            <a href={kofi.url}>Ko-fi</a>
            <a href={links.license}>AGPL-3.0 licence</a>
          </div>
          <p className="back-imprint">
            SnapTune {version} by Nico Fernandez. Auto-Tune is a trademark of Antares Audio Technologies; SnapTune is an independent project, not
            affiliated with Antares. Pictures via Wikimedia Commons, all in the public domain unless marked:{" "}
            {credits.map((c, i) => (
              <span key={c.file}>
                <a href={c.page}>{c.label ?? c.title}</a>
                {c.license === "public domain" ? "" : ` (${c.license})`}
                {i < credits.length - 1 ? "; " : "."}
              </span>
            ))}
          </p>
        </div>
        </footer>
      </div>
    </>
  );
}
