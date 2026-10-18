import Image from "next/image";
import type { ReactNode } from "react";
import { ABPlayer } from "@/components/ABPlayer";
import { CopyCommand } from "@/components/CopyCommand";
import { DemoVideo } from "@/components/DemoVideo";
import { LogoMark, Wordmark } from "@/components/Logo";
import { clips, hasPublicFile, kofi, links, midiDemo, quarantineCommand, version } from "@/lib/site";

// Missing demo media is a visible to-do in `next dev` and simply absent from the built site.
const isDev = process.env.NODE_ENV === "development";

// Positions are percentages of the screenshot (docs/screenshot.png, 1600 × 1024).
const callouts = [
  {
    x: 4.2, y: 41,
    title: "The gauge",
    body: (
      <>
        You sang <span className="text-coral">−40¢</span> flat. What comes out is <span className="text-teal">0¢</span>. Coral is you, teal is the output.
      </>
    ),
  },
  {
    x: 8.5, y: 69,
    title: "Retune Speed",
    body: "All the way to 0 ms is the robotic stair-step. Turn it up and your slides and vibrato come back.",
  },
  {
    x: 59, y: 32,
    title: "The pitch graph",
    body: "Draws both lines while you sing, so you can see it grabbing the right note, or not.",
  },
  {
    x: 30, y: 8,
    title: "Scale notes",
    body: "Lit notes are allowed. Click one to switch it off and the voice will never land there.",
  },
];

const quickStart: ReactNode[] = [
  <>Put SnapTune on the <b className="text-ink">vocal&apos;s mixer track</b>, not the beat or the master.</>,
  <>Set <b className="text-ink">Key</b> and <b className="text-ink">Scale</b> to the song. Don&apos;t know the key? Pick Chromatic.</>,
  <>
    Pick a preset: <b className="text-ink">Hard Tune</b> for the robot, <b className="text-ink">Melodic Trap</b> for tight modern vocals,{" "}
    <b className="text-ink">Natural</b> if nobody should notice.
  </>,
  <>Set <b className="text-ink">Voice</b> to the singer. Deep voice: Low Male.</>,
  <>Use <b className="text-ink">Live</b> while you record and <b className="text-ink">Studio</b> when you mix.</>,
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

function Marker({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-teal bg-bg text-sm font-bold text-teal ${className}`}
    >
      {n}
    </span>
  );
}

// What a missing piece of demo media should be. Only rendered in `next dev`.
function Placeholder({ file, children }: { file: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-coral/60 bg-coral/5 p-5 text-sm text-muted">
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

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <Wordmark />
          </a>
          <div className="flex items-center gap-5 text-sm">
            <a href="#install" className="text-muted transition hover:text-ink">Install</a>
            <a href="#faq" className="hidden text-muted transition hover:text-ink sm:block">FAQ</a>
            <a href={links.download} className="rounded-lg border border-teal/60 px-3 py-1.5 font-semibold text-teal transition hover:bg-teal hover:text-bg">
              Download
            </a>
          </div>
        </nav>
      </header>

      <main id="top" className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
          <p className="caption">SnapTune {version} · macOS · VST3 + AU</p>
          <h1 className="mt-5 max-w-4xl text-[2.6rem] font-bold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            The hard-tune sound on your vocals, live while you record. <span className="text-teal">Free.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-muted">
            SnapTune is a pitch correction plugin for Mac, tested in FL Studio. Set the song&apos;s key, pick the Hard Tune preset and sing.
            Live mode adds 2.7 ms of delay, small enough to track through without the lag throwing you off.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <a
              href={links.download}
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-teal px-6 py-3.5 text-base font-bold text-bg transition hover:bg-[#6bf5cf]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
              </svg>
              Download SnapTune {version} for Mac (.zip)
            </a>
            <a href={links.repo} className="text-sm text-muted transition hover:text-ink">
              Source code on GitHub →
            </a>
          </div>
          <p className="mt-4 text-sm text-faint">
            No account, no email, no trial. Apple Silicon and Intel, macOS 11 or newer. Windows is planned for a later version.
          </p>

          {/* Annotated screenshot */}
          <div className="relative mt-14">
            <Image
              src="/screenshot.png"
              alt="The SnapTune window: tuner gauge, Retune Speed knob, scale note buttons and a pitch graph with the sung and corrected pitch"
              width={1600}
              height={1024}
              priority
              className="h-auto w-full rounded-xl border border-line"
            />
            {callouts.map((c, i) => (
              <span key={c.title} className="absolute hidden sm:block" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                <Marker n={i + 1} className="shadow-lg shadow-black/60" />
              </span>
            ))}
          </div>
          <h2 className="sr-only">What you&apos;re looking at</h2>
          <ol className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {callouts.map((c, i) => (
              <li key={c.title} className="flex gap-4">
                {/* The markers on the screenshot are hidden on phones, so the numbers would point at nothing. */}
                <Marker n={i + 1} className="max-sm:hidden" />
                <div>
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{c.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Before / after */}
        {(readyClips.length > 0 || isDev) && (
          <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
            <div className="rounded-2xl border border-line bg-panel px-5 sm:px-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-4">
                <h2 className="font-bold">Same take, before and after</h2>
                <p className="text-sm text-muted">Press play, then flip between them.</p>
              </div>
              <div className="divide-y divide-line">
                {readyClips.map((c) => (
                  <ABPlayer key={c.id} preset={c.preset} note={c.note} dry={c.dry} tuned={c.tuned} />
                ))}
              </div>
              {isDev && readyClips.length < clips.length && (
                <div className="pb-5 pt-1">
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


        {/* Quick start */}
        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Your first vocal in five settings</h2>
            <p className="mt-3 text-muted">The presets only touch the correction knobs. Key, scale and voice are up to you.</p>
          </div>
          <ol className="space-y-px overflow-hidden rounded-2xl border border-line">
            {quickStart.map((step, i) => (
              <li key={i} className="flex items-start gap-4 bg-panel px-5 py-4 text-muted">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal/15 text-xs font-bold text-teal">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Live vs Studio */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Live or Studio</h2>
          <p className="mt-3 text-muted">Switch any time. SnapTune tells your DAW the new delay.</p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-panel-2">
                <tr>
                  <th className="caption px-5 py-3 font-bold">Mode</th>
                  <th className="caption px-5 py-3 font-bold">Delay</th>
                  <th className="caption px-5 py-3 font-bold">Use it when</th>
                  <th className="caption px-5 py-3 font-bold">Trade-off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-panel">
                <tr>
                  <td className="px-5 py-4 font-bold">Live</td>
                  <td className="whitespace-nowrap px-5 py-4 text-lg font-bold text-teal">2.7 ms</td>
                  <td className="px-5 py-4 text-muted">You&apos;re recording and want to hear yourself tuned</td>
                  <td className="px-5 py-4 text-muted">Big jumps (following MIDI, say) shift your voice&apos;s character a little</td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-bold">Studio</td>
                  <td className="whitespace-nowrap px-5 py-4 text-lg font-bold">46 ms</td>
                  <td className="px-5 py-4 text-muted">You&apos;re mixing a recorded take. Your DAW compensates for the delay</td>
                  <td className="px-5 py-4 text-muted">Too much delay to sing through. In exchange your voice keeps its character, and Formant works</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-faint">Either mode uses under 1 % CPU on a MacBook Pro M5.</p>
        </section>

        {/* MIDI */}
        <section className="border-y border-line bg-panel/50">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
            <div>
              <p className="caption !text-violet">MIDI notes</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Write the melody. The voice follows it.</h2>
              <p className="mt-4 text-muted">
                Hold a note on a MIDI track and SnapTune tunes the vocal to that note, in any octave, instead of the nearest one in the scale.
                Let go and it goes back to the scale.
              </p>
              <ol className="mt-6 space-y-2 text-sm text-muted">
                <li><span className="text-ink">1.</span> In SnapTune&apos;s wrapper (gear icon), set <span className="text-ink">MIDI input port</span> to a free number.</li>
                <li><span className="text-ink">2.</span> Add a <span className="text-ink">MIDI Out</span> channel on the same port.</li>
                <li><span className="text-ink">3.</span> Draw the melody in its piano roll and turn on <span className="text-ink">MIDI notes</span> in SnapTune.</li>
              </ol>
            </div>
            {hasMidiDemo ? (
              <DemoVideo src={midiDemo} className="w-full rounded-xl border border-line" />
            ) : (
              isDev && (
                <Placeholder file={midiDemo}>
                  A 10–15 second screen recording: FL Studio&apos;s piano roll on one side, SnapTune&apos;s graph snapping to each drawn note on the
                  other. Until it exists, the text column stands alone.
                </Placeholder>
              )
            )}
          </div>
        </section>

        {/* Install */}
        <section id="install" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Install</h2>
          <p className="mt-3 text-muted">
            About two minutes. One step is a Terminal command, and I&apos;m working on <a href="#support" className="text-teal hover:underline">getting rid of it</a>.
          </p>
          <ol className="mt-8 space-y-8 border-l border-line pl-6">
            <li>
              <h3 className="font-semibold">1. Unzip <a href={links.download} className="text-teal hover:underline">SnapTune-{version}-macOS.zip</a></h3>
            </li>
            <li>
              <h3 className="font-semibold">2. Move the plugins into place</h3>
              <p className="mt-1 text-sm text-muted">In Finder, Go › Go to Folder… and paste each path.</p>
              <div className="mt-3 space-y-1 rounded-xl border border-line bg-panel p-4 font-mono text-[13px]">
                <p className="break-all"><span className="text-ink">SnapTune.vst3</span> <span className="text-faint">→</span> <span className="text-muted">~/Library/Audio/Plug-Ins/VST3/</span></p>
                <p className="break-all"><span className="text-ink">SnapTune.component</span> <span className="text-faint">→</span> <span className="text-muted">~/Library/Audio/Plug-Ins/Components/</span></p>
              </div>
            </li>
            <li>
              <h3 className="font-semibold">3. Let macOS open them</h3>
              <p className="mt-1 text-sm text-muted">macOS blocks plugins Apple hasn&apos;t checked. Paste this into Terminal once:</p>
              <CopyCommand command={quarantineCommand} />
            </li>
            <li>
              <h3 className="font-semibold">4. Restart your DAW and rescan</h3>
              <p className="mt-1 text-sm text-muted">
                Quit it completely first. In FL Studio: Options › Manage plugins › Find installed plugins.
              </p>
            </li>
          </ol>
        </section>

        {/* Support */}
        <section id="support" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20 sm:px-6">
          <div className="rounded-2xl border border-line bg-panel p-7 sm:p-9">
            <h2 className="text-2xl font-bold tracking-tight">Help get rid of step 3</h2>
            <p className="mt-4 text-muted">
              macOS shows that warning because SnapTune isn&apos;t notarized by Apple. Notarizing needs an Apple Developer membership, which
              costs <span className="font-semibold text-ink">$99 a year</span>. Once that&apos;s covered, SnapTune will ship as a signed installer
              that opens like any other Mac app: no Terminal, no &quot;can&apos;t be opened&quot; dialog.
            </p>
            {kofi.raised > 0 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">${kofi.raised} of ${kofi.goal}</span>
                  <span className="text-muted">{percent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Apple fee raised" aria-valuemin={0} aria-valuemax={kofi.goal} aria-valuenow={kofi.raised}>
                  <div className="h-full rounded-full bg-teal" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}
            <a
              href={kofi.url}
              className="mt-7 inline-flex items-center gap-2 rounded-xl border border-teal/60 px-5 py-3 font-bold text-teal transition hover:bg-teal hover:text-bg"
            >
              Chip in toward the Apple fee on Ko-fi
            </a>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-24 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">FAQ</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 font-semibold">
                  {f.q}
                  <svg viewBox="0 0 24 24" className="faq-chevron h-4 w-4 shrink-0 text-muted transition-transform" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <a href={links.download} className="font-semibold text-teal hover:underline">Download SnapTune {version} for Mac</a>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={links.repo} className="inline-flex items-center gap-1.5 hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d={githubIcon} /></svg>
              Star on GitHub
            </a>
            <a href={links.issues} className="hover:text-ink">Report a bug</a>
            <a href={kofi.url} className="hover:text-ink">Ko-fi</a>
            <a href={links.license} className="hover:text-ink">AGPL-3.0</a>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-faint sm:px-6">
          Auto-Tune is a trademark of Antares Audio Technologies. SnapTune is an independent project and not affiliated with Antares.
        </p>
      </footer>
    </>
  );
}
