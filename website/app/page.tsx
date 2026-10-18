import Image from "next/image";
import type { ReactNode } from "react";
import { ABPlayer } from "@/components/ABPlayer";
import { CopyCommand } from "@/components/CopyCommand";
import { DemoVideo } from "@/components/DemoVideo";
import { LogoMark } from "@/components/Logo";
import { clips, hasPublicFile, kofi, links, midiDemo, quarantineCommand, version } from "@/lib/site";

// Missing demo media is a visible to-do in `next dev` and simply absent from the built site.
const isDev = process.env.NODE_ENV === "development";

// Regions of the plugin screenshot (docs/screenshot.png, 1600 × 1024) as fractions of its size.
type Region = { x: number; y: number; w: number; h: number };

const regions = {
  graph: { x: 0.3425, y: 0.223, w: 0.6375, h: 0.512 },
  gauge: { x: 0.03, y: 0.234, w: 0.29, h: 0.254 },
  retune: { x: 0.03, y: 0.522, w: 0.29, h: 0.205 },
  notes: { x: 0.306, y: 0.139, w: 0.514, h: 0.056 },
} satisfies Record<string, Region>;

const quickStart: ReactNode[] = [
  <>Put SnapTune on the <b className="font-semibold text-ink">vocal&apos;s mixer track</b>, not the beat or the master.</>,
  <>Set <b className="font-semibold text-ink">Key</b> and <b className="font-semibold text-ink">Scale</b> to the song. Don&apos;t know the key? Pick Chromatic.</>,
  <>
    Pick a preset: <b className="font-semibold text-ink">Hard Tune</b> for the robot, <b className="font-semibold text-ink">Melodic Trap</b> for tight
    modern vocals, <b className="font-semibold text-ink">Natural</b> if nobody should notice.
  </>,
  <>Set <b className="font-semibold text-ink">Voice</b> to the singer. Deep voice: Low Male.</>,
  <>Use <b className="font-semibold text-ink">Live</b> while you record and <b className="font-semibold text-ink">Studio</b> when you mix.</>,
];

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "Is it actually free?",
    a: (
      <>
        Yes. It&apos;s open source under the <a href={links.license} className="text-teal hover:underline">AGPL-3.0 license</a>. No trial, no
        watermark, no account.
      </>
    ),
  },
  {
    q: "It isn't doing anything to my vocal.",
    a: "It needs the vocal on its own track. On a full mix or a beat it can't find a single pitch to follow. If the voice is breathy or the room is echoey, raise Tracking. For deep voices, set Voice to Low Male.",
  },
  {
    q: "macOS says it's damaged or can't be opened.",
    a: (
      <>
        That&apos;s the missing Apple notarization, not a broken file. Run the command in <a href="#install" className="text-teal hover:underline">step 3</a>.
        For the standalone app, right-click it and choose Open the first time.
      </>
    ),
  },
  {
    q: "Does it work in Ableton, Logic, Reaper…?",
    a: (
      <>
        It&apos;s tested in FL Studio, and every build passes Apple&apos;s own Audio Unit validation. Other DAWs that load VST3 or AU should
        work, but I haven&apos;t tried each one. If yours gives you trouble, <a href={links.issues} className="text-teal hover:underline">open an issue</a>{" "}
        and say which DAW and version.
      </>
    ),
  },
  {
    q: "Windows?",
    a: (
      <>
        Not yet. Windows is planned for a coming version. New versions show up on the{" "}
        <a href={links.releases} className="text-teal hover:underline">releases page</a>.
      </>
    ),
  },
  {
    q: "Is this Auto-Tune?",
    a: "No. Auto-Tune Pro costs hundreds of dollars or a monthly subscription; SnapTune is free and has no connection to Antares, who own the Auto-Tune trademark. It uses published techniques: YIN pitch detection and pitch-synchronous grain resynthesis. The README explains how each part works.",
  },
];

const githubIcon =
  "M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z";

// A close-up of one part of the plugin window, cut from the same screenshot.
function UiCrop({ region, alt, fadeTop = false, className = "" }: { region: Region; alt: string; fadeTop?: boolean; className?: string }) {
  const { x, y, w, h } = region;
  // A crop from inside a panel starts mid-gradient; fading its top edge hides the cut.
  const fade = fadeTop ? { maskImage: "linear-gradient(to bottom, transparent, black 22%)" } : {};
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: `${w * 1600} / ${h * 1024}`, ...fade }}>
      <Image
        src="/screenshot.png"
        alt={alt}
        width={1600}
        height={1024}
        className="absolute h-auto max-w-none"
        style={{ width: `${100 / w}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}
      />
    </div>
  );
}

// Apple's text links end in a chevron: "Learn more ›".
function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="group inline-flex items-center gap-1 text-teal hover:underline">
      {children}
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
      </svg>
    </a>
  );
}

function SectionHeader({ eyebrow, eyebrowClass = "text-teal", title, children }: { eyebrow: string; eyebrowClass?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className={`text-[19px] font-semibold sm:text-[21px] ${eyebrowClass}`}>{eyebrow}</p>
      <h2 className="headline mt-2 text-[40px] sm:text-[56px]">{title}</h2>
      {children && <p className="mx-auto mt-5 max-w-2xl text-[19px] leading-snug text-muted sm:text-[21px]">{children}</p>}
    </div>
  );
}

// What a missing piece of demo media should be. Only rendered in `next dev`.
function Placeholder({ file, children }: { file: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-coral/60 bg-coral/5 p-6 text-[15px] text-muted">
      <p className="caption !text-coral">Needs proof · dev only</p>
      <p className="mt-2">{children}</p>
      <p className="mt-2 font-mono text-xs text-ink">public{file}</p>
    </div>
  );
}

export default function Home() {
  const percent = Math.min(100, Math.round((kofi.raised / kofi.goal) * 100));
  const readyClips = clips.filter((c) => hasPublicFile(c.dry) && hasPublicFile(c.tuned));
  const hasMidiDemo = hasPublicFile(midiDemo);
  const shortVersion = version.replace(/\.0$/, "");

  const midiSteps = (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl bg-bg/60 text-[15px] text-muted">
      {[
        <>In SnapTune&apos;s wrapper (gear icon), set <span className="text-ink">MIDI input port</span> to a free number.</>,
        <>Add a <span className="text-ink">MIDI Out</span> channel on the same port.</>,
        <>Draw the melody in its piano roll and turn on <span className="text-ink">MIDI notes</span> in SnapTune.</>,
      ].map((step, i) => (
        <li key={i} className="flex items-start gap-4 px-5 py-4">
          <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet/15 text-xs font-semibold tabular-nums text-violet">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/* Local nav: Apple's product sub-navigation, a frosted bar over the page. */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/75 backdrop-blur-xl backdrop-saturate-150">
        <nav className="mx-auto flex h-13 max-w-[980px] items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2 text-[19px] font-semibold tracking-tight sm:text-[21px]">
            <LogoMark className="h-6 w-6" />
            SnapTune
          </a>
          <div className="flex items-center gap-5 text-xs">
            <a href="#features" className="hidden text-ink/80 transition hover:text-ink sm:block">Overview</a>
            <a href="#install" className="text-ink/80 transition hover:text-ink">Install</a>
            <a href="#faq" className="hidden text-ink/80 transition hover:text-ink sm:block">FAQ</a>
            <a href={links.download} className="rounded-full bg-teal px-3 py-1 font-medium text-bg transition hover:bg-[#6bf5cf]">
              Download
            </a>
          </div>
        </nav>
      </header>

      <main id="top" className="flex-1 overflow-x-clip">
        {/* Hero */}
        <section className="relative px-4 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="text-[19px] font-semibold text-teal sm:text-[21px]">SnapTune {shortVersion} for Mac</p>
          <h1 className="headline mx-auto mt-3 max-w-4xl text-[56px] sm:text-[88px]">Hard-tune. Live. Free.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-[19px] leading-snug text-muted sm:text-[24px]">
            A pitch correction plugin that snaps your voice to the key with 2.7&nbsp;ms of delay, so you hear it tuned while you record.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
            <a
              href={links.download}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal px-7 py-3 text-[17px] font-medium text-bg transition hover:bg-[#6bf5cf]"
            >
              Download for Mac
            </a>
            <MoreLink href={links.repo}>View the source on GitHub</MoreLink>
          </div>
          <p className="mt-6 text-sm text-faint">
            VST3 and Audio Unit · macOS 11 or later · Apple silicon and Intel · Tested in FL Studio
          </p>

          {/* The product, large, with the plugin's own glow behind it. */}
          <div className="relative mx-auto mt-16 max-w-[1100px] sm:mt-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-20 -top-24 bottom-0 bg-[radial-gradient(ellipse_at_center,rgba(60,240,191,0.16),transparent_62%)]"
            />
            <Image
              src="/screenshot.png"
              alt="The SnapTune window: tuner gauge, Retune Speed knob, scale note buttons and a pitch graph with the sung and output pitch"
              width={1600}
              height={1024}
              priority
              className="relative h-auto w-full rounded-[18px] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 sm:rounded-[26px]"
            />
          </div>
        </section>

        {/* The idea: two colours */}
        <section id="features" className="scroll-mt-16 px-4 pt-28 sm:px-6 sm:pt-40">
          <SectionHeader
            eyebrow="See what it's doing"
            title={
              <>
                <span className="text-coral">Coral</span> is what you sang.
                <br />
                <span className="text-teal">Teal</span> is what comes out.
              </>
            }
          >
            Every part of SnapTune speaks the same two colours, so you can tell at a glance whether it grabbed the right note.
          </SectionHeader>

          {/* Feature tiles: close-ups of the real window. */}
          <div className="mx-auto mt-16 grid max-w-[1100px] gap-4 sm:mt-20 md:grid-cols-2 md:gap-5">
            <article className="overflow-hidden rounded-[28px] bg-panel md:col-span-2">
              <div className="px-7 pt-9 sm:px-12 sm:pt-12">
                <h3 className="headline text-[28px] sm:text-[40px]">The pitch graph.</h3>
                <p className="mt-3 max-w-xl text-muted">
                  Draws both lines as you sing: dashed coral for your voice, solid teal for the output. Scroll to move through the range;
                  double-click to follow the singer again.
                </p>
              </div>
              <UiCrop region={regions.graph} alt="The pitch graph, with the sung pitch dashed and the output pitch snapped to each note" className="mt-8 sm:mt-10" />
            </article>

            <article className="flex flex-col overflow-hidden rounded-[28px] bg-panel">
              <div className="px-7 pt-9 sm:px-10 sm:pt-10">
                <h3 className="headline text-[28px] sm:text-[32px]">The gauge.</h3>
                <p className="mt-3 text-muted">
                  You sang <span className="text-coral">−40¢</span> flat. What comes out is <span className="text-teal">0¢</span>. Readable from
                  across the room.
                </p>
              </div>
              <UiCrop region={regions.gauge} alt="The tuner gauge: G3, sung −40 cents, output 0 cents" fadeTop className="mt-auto" />
            </article>

            <article className="flex flex-col overflow-hidden rounded-[28px] bg-panel">
              <div className="px-7 pt-9 sm:px-10 sm:pt-10">
                <h3 className="headline text-[28px] sm:text-[32px]">Retune Speed.</h3>
                <p className="mt-3 text-muted">
                  All the way to 0 ms is the robotic stair-step. Turn it up and your slides and vibrato come back.
                </p>
              </div>
              <UiCrop region={regions.retune} alt="The Retune Speed knob at 8 ms, from Fast to Slow" fadeTop className="mt-auto" />
            </article>

            <article className="overflow-hidden rounded-[28px] bg-panel md:col-span-2">
              <div className="grid items-center gap-8 px-7 py-9 sm:px-12 sm:py-12 lg:grid-cols-[1fr_1.9fr]">
                <div>
                  <h3 className="headline text-[28px] sm:text-[32px]">Scale notes.</h3>
                  <p className="mt-3 text-muted">Lit notes are allowed. Click one to switch it off and the voice will never land there.</p>
                </div>
                <UiCrop region={regions.notes} alt="The twelve scale note buttons, C major lit, G being tuned to" />
              </div>
            </article>
          </div>
        </section>

        {/* Before / after */}
        {(readyClips.length > 0 || isDev) && (
          <section className="px-4 pt-28 sm:px-6 sm:pt-40">
            <SectionHeader eyebrow="Listen" title="Same take. Before and after.">
              Press play, then flip between them.
            </SectionHeader>
            <div className="mx-auto mt-12 max-w-3xl rounded-[28px] bg-panel px-6 sm:px-8">
              <div className="divide-y divide-line">
                {readyClips.map((c) => (
                  <ABPlayer key={c.id} preset={c.preset} note={c.note} dry={c.dry} tuned={c.tuned} />
                ))}
              </div>
              {isDev && readyClips.length < clips.length && (
                <div className="py-6">
                  <Placeholder file={`/audio/<${clips.filter((c) => !readyClips.includes(c)).map((c) => c.id).join("|")}>-{dry,tuned}.mp3`}>
                    8–10 seconds of a real dry vocal, slightly off-key, then the same file through each preset. This section ships once the
                    first pair exists. Render the tuned file with{" "}
                    <code className="text-ink">SnapTuneTests --process dry.wav tuned.wav --key A --scale Minor --retune 0</code> so it&apos;s exactly
                    what the plugin outputs.
                  </Placeholder>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Live vs Studio */}
        <section className="px-4 pt-28 sm:px-6 sm:pt-40">
          <SectionHeader eyebrow="Two modes" title="Track it. Then mix it.">
            Switch any time. SnapTune tells your DAW the new delay.
          </SectionHeader>
          <div className="mx-auto mt-14 grid max-w-[980px] gap-4 md:grid-cols-2 md:gap-5">
            <article className="rounded-[28px] bg-panel p-8 sm:p-10">
              <h3 className="text-[21px] font-semibold">Live</h3>
              <p className="headline mt-6 text-[64px] text-teal sm:text-[80px]">2.7 ms</p>
              <p className="text-muted">of delay</p>
              <ul className="mt-8 space-y-3 border-t border-line pt-6 text-[15px] text-muted">
                <li><span className="text-ink">Use it when</span> you&apos;re recording and want to hear yourself tuned.</li>
                <li><span className="text-ink">Trade-off:</span> big jumps (following MIDI, say) shift your voice&apos;s character a little.</li>
              </ul>
            </article>
            <article className="rounded-[28px] bg-panel p-8 sm:p-10">
              <h3 className="text-[21px] font-semibold">Studio</h3>
              <p className="headline mt-6 text-[64px] sm:text-[80px]">46 ms</p>
              <p className="text-muted">compensated by your DAW</p>
              <ul className="mt-8 space-y-3 border-t border-line pt-6 text-[15px] text-muted">
                <li><span className="text-ink">Use it when</span> you&apos;re mixing a recorded take.</li>
                <li><span className="text-ink">In exchange:</span> your voice keeps its character, and Formant works.</li>
              </ul>
            </article>
          </div>
          <p className="mt-6 text-center text-sm text-faint">Either mode uses under 1 % CPU on a MacBook Pro M5.</p>
        </section>

        {/* Quick start */}
        <section className="px-4 pt-28 sm:px-6 sm:pt-40">
          <SectionHeader eyebrow="Quick start" title="Your first vocal in five settings.">
            The presets only touch the correction knobs. Key, scale and voice are up to you.
          </SectionHeader>
          <ol className="mx-auto mt-12 max-w-2xl divide-y divide-line overflow-hidden rounded-[28px] bg-panel">
            {quickStart.map((step, i) => (
              <li key={i} className="flex items-start gap-5 px-6 py-5 text-muted sm:px-8">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal/15 text-sm font-semibold tabular-nums text-teal">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* MIDI */}
        <section className="px-4 pt-28 sm:px-6 sm:pt-40">
          <div className="mx-auto max-w-[1100px] overflow-hidden rounded-[28px] bg-panel">
            <div className="grid items-center gap-10 p-8 sm:p-12 md:grid-cols-2">
              <div>
                <p className="text-[19px] font-semibold text-violet sm:text-[21px]">MIDI notes</p>
                <h2 className="headline mt-2 text-[36px] sm:text-[48px]">Write the melody. The voice follows.</h2>
                <p className="mt-5 text-muted">
                  Hold a note on a MIDI track and SnapTune tunes the vocal to that note, in any octave, instead of the nearest one in the scale.
                  Let go and it goes back to the scale.
                </p>
                {hasMidiDemo && <div className="mt-7">{midiSteps}</div>}
              </div>
              {hasMidiDemo ? (
                <DemoVideo src={midiDemo} className="w-full rounded-2xl ring-1 ring-white/10" />
              ) : (
                // Until the recording exists, the setup steps fill the second column.
                <div className="space-y-4">
                  {midiSteps}
                  {isDev && (
                    <Placeholder file={midiDemo}>
                      A 10–15 second screen recording: FL Studio&apos;s piano roll on one side, SnapTune&apos;s graph snapping to each drawn note on the
                      other. It replaces this column; the steps move under the text.
                    </Placeholder>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Install */}
        <section id="install" className="scroll-mt-16 px-4 pt-28 sm:px-6 sm:pt-40">
          <SectionHeader eyebrow="Install" title="Up and running in two minutes.">
            One step is a Terminal command, and I&apos;m working on <a href="#support" className="text-teal hover:underline">getting rid of it</a>.
          </SectionHeader>
          <ol className="mx-auto mt-12 grid max-w-[980px] gap-4 md:grid-cols-2 md:gap-5">
            <li className="rounded-[28px] bg-panel p-8">
              <p className="text-sm font-semibold text-teal">Step 1</p>
              <h3 className="mt-1 text-[21px] font-semibold">Unzip the download</h3>
              <p className="mt-2 text-[15px] text-muted">
                <a href={links.download} className="text-teal hover:underline">SnapTune-{version}-macOS.zip</a> holds the VST3, the Audio Unit and a
                standalone app.
              </p>
            </li>
            <li className="rounded-[28px] bg-panel p-8">
              <p className="text-sm font-semibold text-teal">Step 2</p>
              <h3 className="mt-1 text-[21px] font-semibold">Move the plugins into place</h3>
              <p className="mt-2 text-[15px] text-muted">In Finder, choose Go › Go to Folder… and paste each path.</p>
              <dl className="mt-4 space-y-3 rounded-2xl bg-bg/60 p-4 font-mono text-[13px] tracking-normal">
                {[
                  ["SnapTune.vst3", "~/Library/Audio/Plug-Ins/VST3/"],
                  ["SnapTune.component", "~/Library/Audio/Plug-Ins/Components/"],
                ].map(([file, folder]) => (
                  <div key={file}>
                    <dt className="text-ink">{file}</dt>
                    <dd className="text-muted"><span className="text-faint" aria-hidden="true">→ </span>{folder}</dd>
                  </div>
                ))}
              </dl>
            </li>
            <li className="rounded-[28px] bg-panel p-8 md:col-span-2">
              <p className="text-sm font-semibold text-teal">Step 3</p>
              <h3 className="mt-1 text-[21px] font-semibold">Let macOS open them</h3>
              <p className="mt-2 text-[15px] text-muted">macOS blocks plugins Apple hasn&apos;t checked. Paste this into Terminal once:</p>
              <CopyCommand command={quarantineCommand} />
            </li>
            <li className="rounded-[28px] bg-panel p-8 md:col-span-2">
              <p className="text-sm font-semibold text-teal">Step 4</p>
              <h3 className="mt-1 text-[21px] font-semibold">Restart your DAW and rescan</h3>
              <p className="mt-2 text-[15px] text-muted">Quit it completely first. In FL Studio: Options › Manage plugins › Find installed plugins.</p>
            </li>
          </ol>
        </section>

        {/* Support */}
        <section id="support" className="scroll-mt-16 px-4 pt-28 sm:px-6 sm:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="headline text-[40px] sm:text-[56px]">Help get rid of step 3.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-[19px] leading-snug text-muted sm:text-[21px]">
              macOS shows that warning because SnapTune isn&apos;t notarized by Apple. Notarizing needs an Apple Developer membership, which costs{" "}
              <span className="text-ink">$99 a year</span>. Once that&apos;s covered, SnapTune ships as a signed installer that opens like any other
              Mac app.
            </p>
            {kofi.raised > 0 && (
              <div className="mx-auto mt-8 max-w-sm text-left">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">${kofi.raised} of ${kofi.goal}</span>
                  <span className="text-muted">{percent}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Apple fee raised" aria-valuemin={0} aria-valuemax={kofi.goal} aria-valuenow={kofi.raised}>
                  <div className="h-full rounded-full bg-teal" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}
            <a
              href={kofi.url}
              className="mt-9 inline-flex min-h-11 items-center justify-center rounded-full border border-teal/60 px-7 py-3 font-medium text-teal transition hover:bg-teal hover:text-bg"
            >
              Chip in on Ko-fi
            </a>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 px-4 pb-32 pt-28 sm:px-6 sm:pt-40">
          <h2 className="headline mx-auto max-w-3xl text-[40px] sm:text-[48px]">Questions.</h2>
          <div className="mx-auto mt-10 max-w-3xl divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-6 text-[19px] font-semibold sm:text-[21px]">
                  {f.q}
                  <svg viewBox="0 0 24 24" className="faq-icon h-5 w-5 shrink-0 text-muted transition-transform" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="pb-6 pr-10 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-panel/40">
        <div className="mx-auto max-w-[980px] px-4 py-6 text-xs text-faint sm:px-6">
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
            <a href={links.download} className="text-[13px] font-medium text-teal hover:underline">Download SnapTune {version} for Mac</a>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
              <a href={links.repo} className="inline-flex items-center gap-1.5 hover:text-ink">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><path d={githubIcon} /></svg>
                GitHub
              </a>
              <a href={links.issues} className="hover:text-ink">Report a bug</a>
              <a href={kofi.url} className="hover:text-ink">Ko-fi</a>
              <a href={links.license} className="hover:text-ink">AGPL-3.0</a>
            </div>
          </div>
          <p className="pt-5 leading-relaxed">
            Auto-Tune is a trademark of Antares Audio Technologies. SnapTune is an independent project and not affiliated with Antares.
          </p>
        </div>
      </footer>
    </>
  );
}
