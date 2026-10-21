// The guides: one page per thing people search for when they want SnapTune without knowing its name
// ("free autotune", "autotune in FL Studio", "autotune on Linux"). Each answers that search properly,
// in plain text, and ends at the download. "Autotune" here is the generic word for pitch correction;
// Auto-Tune the product is Antares' trademark, and every guide says SnapTune isn't affiliated.

export type Guide = {
  slug: string;
  /** The <title>, about 60 characters. */
  title: string;
  /** The meta description, about 155 characters. */
  description: string;
  keywords: string[];
  heading: string;
  lead: string;
  sections: { heading: string; paragraphs?: string[]; steps?: string[] }[];
  faqs: { q: string; a: string }[];
};

const trademark = {
  q: "Is SnapTune the same as Auto-Tune?",
  a: "No. Auto-Tune is a trademark of Antares Audio Technologies, and SnapTune has no connection to them. People say “autotune” for any pitch correction; SnapTune is an independent, open-source one, built on published methods that its README explains.",
};

export const guides: Guide[] = [
  {
    slug: "free-autotune",
    title: "Free Autotune Plugin (VST3, AU, LV2) for Mac, Windows, Linux",
    description:
      "SnapTune is a free autotune plugin: hard-tune or natural pitch correction for vocals, VST3, AU and LV2, open source, no trial and no account.",
    keywords: [
      "free autotune",
      "free autotune plugin",
      "free autotune vst",
      "autotune vst free download",
      "free pitch correction plugin",
      "free vocal tuner plugin",
      "hard tune effect free",
      "autotune for mac free",
      "autotune for windows free",
    ],
    heading: "A free autotune plugin",
    lead: "SnapTune tunes your vocal to the key while it plays: the hard, robotic snap at one end of a knob, a natural fix nobody hears at the other. It is free and open source, with no trial, no watermark and no account.",
    sections: [
      {
        heading: "What you get",
        paragraphs: [
          "A VST3 and an Audio Unit for Mac, a VST3 for 64-bit Windows, and a VST3 and an LV2 for Linux, plus a standalone app on all three. It loads in any DAW that loads those formats.",
          "Set the key and one of 13 scales, or switch notes on and off by hand. Hold notes on a MIDI track and the voice follows those instead. Six factory presets cover the usual sounds, from Hard Tune to Subtle Polish.",
        ],
      },
      {
        heading: "The hard-tune sound",
        paragraphs: [
          "Set Retune Speed to 0 ms, or pick the Hard Tune preset. The voice jumps straight onto each note with no glide between them: the stair-step effect from rap, trap and pop records. It works best when the key is set to the song’s key.",
        ],
      },
      {
        heading: "Natural pitch correction",
        paragraphs: [
          "Turn Retune Speed up, or pick Natural or Subtle Polish. Slides and vibrato come through and only the drift off the note is corrected. Humanize relaxes long notes so they don’t sound locked. In Studio mode the formants stay put, so the voice keeps its character.",
        ],
      },
      {
        heading: "Hear it while you record",
        paragraphs: [
          "Live mode answers in 2.7 ms, quick enough to sing through and hear yourself tuned. Studio mode takes 46 ms for the cleanest result and reports it to your DAW, which lines everything up.",
        ],
      },
      {
        heading: "Install it",
        steps: [
          "Download the installer for your system from this page.",
          "On a Mac, open the .pkg. On Windows, run the setup. On Linux, unpack the archive and run install.sh.",
          "Restart your DAW and rescan plugins, then put SnapTune on the vocal track.",
        ],
      },
    ],
    faqs: [
      { q: "Is it really free?", a: "Yes. It’s open source under the AGPL-3.0 licence: no trial, no watermark, no account, and the source code is on GitHub." },
      {
        q: "Which DAWs does it work in?",
        a: "Any DAW that loads VST3, Audio Unit or LV2 plugins. I test it in FL Studio, and every build passes Apple’s Audio Unit validation; I haven’t tried every other DAW, so if yours has trouble, open an issue on GitHub.",
      },
      { q: "Why does it do nothing to my vocal?", a: "It needs the vocal on its own track: a beat or a full mix has no single pitch to follow." },
      trademark,
    ],
  },
  {
    slug: "autotune-fl-studio",
    title: "Free Autotune for FL Studio: a Free Pitcher Alternative",
    description:
      "How to get autotune in FL Studio for free with SnapTune: install, find it in the plugin list, put it on your vocal and set up hard tune or natural correction.",
    keywords: [
      "autotune fl studio free",
      "free autotune for fl studio",
      "fl studio autotune",
      "free pitcher",
      "free pitcher alternative",
      "fl studio pitch correction free",
      "how to autotune in fl studio",
      "fl studio fruity edition autotune",
    ],
    heading: "Free autotune in FL Studio",
    lead: "SnapTune is a free pitch correction plugin that I test in FL Studio. If your edition of FL Studio doesn’t include Pitcher, or you want a hard-tune sound with a live mode for recording, this is how to set it up.",
    sections: [
      {
        heading: "Install and find it",
        steps: [
          "Download SnapTune for your system and run the installer. It puts the VST3 where FL Studio looks for it (and, on a Mac, the Audio Unit too).",
          "Quit FL Studio completely and open it again.",
          "Open Options, Manage plugins, and run the scan for installed plugins. SnapTune shows up in the list.",
          "On the Mixer, select the vocal’s insert track, click an empty effect slot and choose SnapTune.",
        ],
      },
      {
        heading: "The hard-tune sound",
        steps: [
          "Set Key and Scale to the key of your beat.",
          "Pick the Hard Tune preset, or set Retune Speed to 0 ms.",
          "If a low voice isn’t followed well, set Voice to Low Male. If the take is breathy or the room echoes, raise Tracking.",
        ],
      },
      {
        heading: "Recording through it",
        paragraphs: [
          "Switch to Live while you record: SnapTune answers in 2.7 ms, so you hear yourself tuned in your headphones. Switch back to Studio when you mix; FL Studio compensates its 46 ms automatically.",
        ],
      },
      {
        heading: "Tuning to a melody you write",
        paragraphs: [
          "Turn on MIDI notes in SnapTune and set the wrapper’s MIDI input port. Add a MIDI Out channel on the same port and draw the melody in the piano roll: while a note is held, the voice is tuned to it, in any octave.",
        ],
      },
    ],
    faqs: [
      { q: "Does it work in FL Studio Fruity Edition?", a: "Yes. SnapTune is a separate plugin, so it loads in any FL Studio edition that loads third-party VST3 plugins." },
      { q: "Is it a replacement for Pitcher?", a: "For real-time tuning, yes: key and scale, retune speed from robotic to natural, MIDI target notes and a live mode. It isn’t a note-by-note editor like Newtone." },
      { q: "An update doesn’t show up in FL Studio.", a: "FL Studio keeps the old plugin loaded until it restarts. Quit it completely and open it again." },
      trademark,
    ],
  },
  {
    slug: "autotune-linux",
    title: "Free Autotune for Linux: an LV2 and VST3 Pitch Correction Plugin",
    description:
      "SnapTune brings free autotune to Linux: an LV2 and VST3 pitch correction plugin for Reaper, Bitwig, Ardour and other DAWs, plus a standalone app.",
    keywords: [
      "autotune linux",
      "free autotune linux",
      "lv2 autotune",
      "linux pitch correction plugin",
      "autotune vst3 linux",
      "ardour autotune",
      "reaper linux autotune",
      "bitwig linux autotune",
    ],
    heading: "Free autotune on Linux",
    lead: "SnapTune runs on 64-bit Linux as an LV2, a VST3 and a standalone app: hard-tune or natural pitch correction for vocals, free and open source.",
    sections: [
      {
        heading: "Install it",
        steps: [
          "Download the Linux archive from this page.",
          "Unpack it: tar xzf SnapTune-*-Linux.tar.gz",
          "Run ./install.sh from the unpacked folder. It needs no sudo: the LV2 goes to ~/.lv2, the VST3 to ~/.vst3, and the app to ~/.local/bin with a menu entry.",
          "Rescan plugins in your DAW and put SnapTune on the vocal track.",
        ],
      },
      {
        heading: "What it needs",
        paragraphs: [
          "64-bit Linux with glibc 2.35 or newer: Ubuntu 22.04 and later, Debian 12, Fedora 36 and their relatives. It runs under X11 or XWayland and uses FreeType and Fontconfig; the standalone app plays through ALSA or JACK.",
        ],
      },
      {
        heading: "Hard tune or natural",
        paragraphs: [
          "Set the key and scale, then pick Hard Tune (Retune Speed at 0 ms) for the robotic snap or Natural for a fix that keeps your vibrato. Live mode answers in 2.7 ms for recording; Studio mode reports its 46 ms to the host, which compensates.",
        ],
      },
    ],
    faqs: [
      {
        q: "Which Linux DAWs does it work in?",
        a: "Any host that loads LV2 or VST3, such as Reaper, Bitwig Studio, Ardour and Qtractor. The Linux builds are new and I haven’t tried them in a Linux DAW yet; if yours has trouble, open an issue on GitHub with the DAW and distribution.",
      },
      { q: "How do I uninstall it?", a: "Delete ~/.lv2/SnapTune.lv2, ~/.vst3/SnapTune.vst3, ~/.local/bin/SnapTune, ~/.local/share/applications/snaptune.desktop and the icon, ~/.local/share/icons/hicolor/512x512/apps/snaptune.png." },
      trademark,
    ],
  },
];

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug)!;
