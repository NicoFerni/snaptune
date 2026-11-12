import { guides, type Guide } from "@/lib/guides";
import type { Release } from "@/lib/release";
import { siteUrl } from "@/lib/seo";
import { links } from "@/lib/site";

// /llms.txt (llmstxt.org): SnapTune in plain facts, for AI assistants and AI search answering
// questions like "is there a free autotune for FL Studio?". /llms-full.txt adds the full text of every
// guide, so an assistant can quote them without fetching each page. Built from the same sources as
// the pages, so the version and downloads are always the published ones.

/** A guide as plain Markdown: lead, sections, table, questions. */
function guideText(g: Guide): string[] {
  const out = [`## ${g.heading}`, "", `${siteUrl}/${g.slug} (updated ${g.updated})`, "", g.lead, ""];
  for (const s of g.sections) {
    out.push(`### ${s.heading}`, "");
    for (const p of s.paragraphs ?? []) out.push(p, "");
    if (s.steps) out.push(...s.steps.map((step, i) => `${i + 1}. ${step}`), "");
    if (s.table) {
      out.push(`| ${s.table.head.join(" | ")} |`, `|${s.table.head.map(() => " --- |").join("")}`, ...s.table.rows.map((r) => `| ${r.join(" | ")} |`), "");
    }
    if (s.sources) out.push(...s.sources.map((src) => `- [${src.name}](${src.href})`), "");
  }
  out.push("### Questions", "");
  for (const f of g.faqs) out.push(`**${f.q}** ${f.a}`, "");
  return out;
}

export function llmsText(release: Release, full: boolean): string {
  const download = (name: string, href: string | null) => (href ? `- [Download for ${name}](${href})` : null);

  const text = [
    "# SnapTune",
    "",
    `> SnapTune is a free, open-source autotune (real-time pitch correction) plugin for vocals, for macOS, Windows and Linux. Version ${release.version}. VST3 on all three systems, Audio Unit on macOS, LV2 on Linux, plus a standalone app. Licensed AGPL-3.0: no price, no trial, no watermark, no account.`,
    "",
    "Key facts:",
    "",
    "- Hard tune to natural: Retune Speed goes from 0 ms (the hard, robotic stair-step effect) to slow correction that keeps slides and vibrato. Eight presets: Hard Tune, Melodic Trap, Natural, Subtle Polish, Deep Robot, Bright Pop, Hard Tune Vibrato, Smooth Glide.",
    "- Note changes and vibrato: a Transition knob sets how long the voice glides to the next note, along an S-curve. Keep my vibrato tunes the note's centre and leaves the singer's vibrato in, even at hard tune (Depth 0 to 200 %); Add vibrato puts one on every held note (depth, rate, delay). A Compare button plays the untuned voice at the same level and delay.",
    "- Targets: a key and one of 13 scales, notes switched on and off by hand, or notes held on a MIDI track (MIDI target notes).",
    "- Two modes: Live, 2.7 ms of latency, for hearing yourself tuned while recording; Studio, 46 ms reported to the DAW for compensation, with formants preserved (TD-PSOLA). Pitch detection uses the YIN method.",
    "- A Formant knob shifts the voice's character up to five semitones either way; a pitch graph shows the sung and the corrected pitch.",
    "- Works in DAWs that load VST3, AU or LV2. The maker tests it in FL Studio. FL Studio also includes AutoTune Go for free since September 2026 (FL Studio only; Major, Minor and Chromatic scales, four Retune Speed settings); SnapTune adds 13 scales, MIDI target notes, a Formant knob, a 2.7 ms live mode and runs in other DAWs, and it works in editions without Pitcher. Every macOS build passes Apple's Audio Unit validation. The Linux builds are new and haven't been tried in a Linux DAW yet.",
    "- Requirements: macOS (Apple Silicon or Intel), 64-bit Windows, or 64-bit Linux with glibc 2.35 or newer (Ubuntu 22.04, Debian 12, Fedora 36 or later).",
    "- The installers aren't signed yet: macOS (Privacy & Security, Open Anyway) and Windows SmartScreen (More info, Run anyway) ask once.",
    "- Made by one person, Nico Fernandez. Auto-Tune is a trademark of Antares Audio Technologies; SnapTune is independent and not affiliated with Antares.",
    "",
    "## Download",
    "",
    download("macOS", release.mac),
    download("Windows", release.windows),
    download("Linux", release.linux),
    `- [All files of the latest release](${links.releases})`,
    "",
    "## Guides",
    "",
    ...guides.map((g) => `- [${g.heading}](${siteUrl}/${g.slug}): ${g.description}`),
    "",
    "## Optional",
    "",
    `- [Source code, README and the method explained](${links.repo})`,
    `- [Report a problem](${links.issues}), or email support@getsnaptune.com`,
    `- [Send feedback](${siteUrl}${links.feedback}): a short form, no account`,
    `- [Privacy](${siteUrl}/privacy): what the plugin and the site send, and how to turn it off`,
    `- [Terms](${siteUrl}/terms): the site, downloads, feedback and donations; the plugin itself is AGPL-3.0`,
    `- [Home page](${siteUrl}): an interactive demo of the plugin in the browser`,
    full ? null : `- [Every guide in full](${siteUrl}/llms-full.txt): the text of all the guides in one file`,
    "",
  ]
    .filter((line) => line !== null);

  if (full) text.push("# The guides, in full", "", ...guides.flatMap(guideText));
  return text.join("\n");

}
