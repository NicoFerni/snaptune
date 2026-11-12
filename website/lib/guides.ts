// The guides: one page per thing people search for when they want SnapTune without knowing its name
// ("free autotune", "autotune in FL Studio", "autotune on Linux"). Each answers that search properly,
// in plain text, and ends at the download. "Autotune" here is the generic word for pitch correction;
// Auto-Tune the product is Antares' trademark, and every guide says SnapTune isn't affiliated.

export type GuideSection = {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  /** A comparison table: the first column names the row. */
  table?: { caption: string; head: string[]; rows: string[][] };
  /** Where the facts in the section come from, linked. */
  sources?: { name: string; href: string }[];
};

export type Guide = {
  /** The path without its leading slash ("free-autotune", "es/autotune-gratis"). */
  slug: string;
  /** The page's language; English unless set. */
  lang?: "en" | "es";
  /** The same page in the other language, by slug, for hreflang. */
  translation?: string;
  /** When the page went up, and when its text last changed (for the sitemap and the page itself). */
  published: string;
  updated: string;
  /** The <title>, about 60 characters. */
  title: string;
  /** The meta description, about 155 characters. */
  description: string;
  keywords: string[];
  heading: string;
  lead: string;
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
};

const trademark = {
  q: "Is SnapTune the same as Auto-Tune?",
  a: "No. Auto-Tune is a trademark of Antares Audio Technologies, and SnapTune has no connection to them. People say “autotune” for any pitch correction; SnapTune is an independent, open-source one, built on published methods that its README explains.",
};

export const guides: Guide[] = [
  {
    slug: "free-autotune",
    translation: "es/autotune-gratis",
    published: "2026-10-20",
    updated: "2026-11-12",
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
    lead: "SnapTune is a free, open-source autotune plugin (VST3, AU and LV2) for Mac, Windows and Linux. It tunes your vocal to the key while it plays: the hard, robotic snap at one end of a knob, a natural fix nobody hears at the other. No trial, no watermark and no account.",
    sections: [
      {
        heading: "What you get",
        paragraphs: [
          "A VST3 and an Audio Unit for Mac, a VST3 for 64-bit Windows, and a VST3 and an LV2 for Linux, plus a standalone app on all three. It loads in any DAW that loads those formats.",
          "Set the key and one of 13 scales, or switch notes on and off by hand. Hold notes on a MIDI track and the voice follows those instead. Eight factory presets cover the usual sounds, from Hard Tune to Smooth Glide.",
        ],
      },
      {
        heading: "The hard-tune sound",
        paragraphs: [
          "Set Retune Speed to 0 ms, or pick the Hard Tune preset. The voice jumps straight onto each note with no glide between them: the stair-step effect from rap, trap and pop records. It works best when the key is set to the song’s key. For a vibrato on top of the snap, pick Hard Tune Vibrato, which adds one to every held note; to keep your own instead, turn on Keep my vibrato on the Vibrato page.",
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
        a: "Any DAW that loads VST3, Audio Unit or LV2 plugins. I test it in FL Studio, and every build passes Apple’s Audio Unit validation; I haven’t tried every other DAW, so if yours has trouble, open an issue on GitHub or write to support@getsnaptune.com.",
      },
      { q: "Why does it do nothing to my vocal?", a: "It needs the vocal on its own track: a beat or a full mix has no single pitch to follow." },
      trademark,
    ],
  },
  {
    slug: "autotune-fl-studio",
    published: "2026-10-20",
    updated: "2026-11-12",
    title: "Free Autotune for FL Studio: SnapTune vs AutoTune Go and Pitcher",
    description:
      "Free autotune in FL Studio: how SnapTune compares with AutoTune Go and Pitcher, how to install it, and how to set up hard tune or natural correction.",
    keywords: [
      "autotune fl studio free",
      "free autotune for fl studio",
      "fl studio autotune",
      "free pitcher",
      "free pitcher alternative",
      "fl studio pitch correction free",
      "how to autotune in fl studio",
      "fl studio fruity edition autotune",
      "autotune go fl studio",
      "autotune go alternative",
      "fl cloud autotune",
    ],
    heading: "Free autotune in FL Studio",
    lead: "SnapTune is a free, open-source pitch correction (autotune) plugin that I test in FL Studio, and it loads in every edition that takes third-party VST3 plugins. Since September 2026 FL Studio also gives every user AutoTune Go for free, so this page says how the two compare, and then how to set SnapTune up.",
    sections: [
      {
        heading: "SnapTune, AutoTune Go or Pitcher?",
        paragraphs: [
          "AutoTune Go comes with FL Cloud Free (Tools, Manage Cloud Plugins) and runs only inside FL Studio. Image-Line lists Major, Minor and Chromatic scales, four Retune Speed settings and automatic vocal range detection: a quick way to tune to the key of your beat.",
          "Pitcher is FL Studio’s own real-time pitch corrector, in the editions that include it, and Newtone is its note-by-note editor.",
          "SnapTune is a separate VST3 (and an Audio Unit on a Mac) for when you want more: 13 scales or notes picked by hand, a Retune Speed knob that runs from 0 ms up, Humanize, MIDI target notes, a Formant knob and a 2.7 ms Live mode to record through. It’s open source, and the same plugin loads in other DAWs if you ever move.",
        ],
      },
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
      {
        q: "Do I need it if I have AutoTune Go?",
        a: "Not always. For a quick tune in a major or minor key, AutoTune Go is a fine start. SnapTune is for other scales, a melody from MIDI, the Formant knob, a live mode to record through, or the same plugin outside FL Studio. Both are free, so try them side by side.",
      },
      { q: "Is it a replacement for Pitcher?", a: "For real-time tuning, yes: key and scale, retune speed from robotic to natural, MIDI target notes and a live mode. It isn’t a note-by-note editor like Newtone." },
      { q: "An update doesn’t show up in FL Studio.", a: "FL Studio keeps the old plugin loaded until it restarts. Quit it completely and open it again." },
      trademark,
    ],
  },
  {
    slug: "autotune-linux",
    published: "2026-10-20",
    updated: "2026-11-12",
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
    lead: "SnapTune is a free, open-source autotune for Linux: an LV2, a VST3 and a standalone app for 64-bit systems, with hard-tune or natural pitch correction for vocals.",
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
        a: "Any host that loads LV2 or VST3, such as Reaper, Bitwig Studio, Ardour and Qtractor. The Linux builds are new and I haven’t tried them in a Linux DAW yet; if yours has trouble, open an issue on GitHub or write to support@getsnaptune.com with the DAW and distribution.",
      },
      { q: "How do I uninstall it?", a: "Delete ~/.lv2/SnapTune.lv2, ~/.vst3/SnapTune.vst3, ~/.local/bin/SnapTune, ~/.local/share/applications/snaptune.desktop and the icon, ~/.local/share/icons/hicolor/512x512/apps/snaptune.png." },
      trademark,
    ],
  },
  {
    slug: "free-autotune-plugins",
    published: "2026-11-12",
    updated: "2026-11-12",
    title: "Free Autotune Plugins Compared: SnapTune, Graillon, MAutoPitch",
    description:
      "The free autotune plugins side by side: SnapTune, Graillon 3 Free, MAutoPitch, GSnap, x42-Autotune and AutoTune Go. Systems, formats, licence and what each is good for.",
    keywords: [
      "best free autotune plugin",
      "free autotune plugins",
      "free autotune vst comparison",
      "graillon alternative",
      "mautopitch alternative",
      "gsnap alternative",
      "x42 autotune alternative",
      "open source autotune",
      "free pitch correction plugins compared",
    ],
    heading: "Free autotune plugins compared",
    lead: "The free autotune plugins worth trying in 2026 are SnapTune, Graillon 3 Free, MAutoPitch, GSnap, x42-Autotune and, inside FL Studio, AutoTune Go. I make SnapTune, so read this with that in mind: the facts about the others come from their makers’ pages, linked at the bottom, as they stood on 12 November 2026.",
    sections: [
      {
        heading: "Side by side",
        table: {
          caption: "Free autotune plugins: systems, formats and licence",
          head: ["Plugin", "Systems", "Formats", "Open source", "Good for"],
          rows: [
            ["SnapTune", "Mac, Windows, Linux", "VST3, AU, LV2, standalone", "Yes (AGPL-3.0)", "Hard tune to natural, 13 scales, MIDI target notes, a 2.7 ms Live mode, Formant knob"],
            ["Graillon 3 Free (Auburn Sounds)", "Mac, Windows, Linux", "VST, AU, AAX, LV2", "No", "Correction plus pitch and formant shifting and vocal effects; some tuning controls are in the paid edition"],
            ["MAutoPitch (MeldaProduction)", "Mac, Windows", "VST, VST3, AU, AAX", "No", "Quick, simple correction with formant shift and stereo widening"],
            ["GSnap (GVST)", "Windows", "VST", "No", "The long-standing free classic, with a fixed-scale and a MIDI mode"],
            ["x42-Autotune (Robin Gareus)", "Linux, Mac, Windows", "LV2, JACK app", "Yes (GPL)", "Linux sessions; notes from a fixed set or from MIDI"],
            ["AutoTune Go (Antares, in FL Studio)", "Mac, Windows, FL Studio only", "Inside FL Studio (FL Cloud)", "No", "A quick tune in Major, Minor or Chromatic, four Retune Speed settings"],
          ],
        },
      },
      {
        heading: "Which one to pick",
        paragraphs: [
          "For the hard, stair-step sound and for natural correction from the same knob, with MIDI target notes and a mode fast enough to record through, try SnapTune. It is also the only one here that is open source and has VST3, AU and LV2 builds.",
          "For vocal effects on top of tuning (pitch shifting, formants, the character of a voice changer), Graillon 3 Free is the one most lists put first.",
          "For a light touch on backing vocals, MAutoPitch is quick to set and has a stereo width control.",
          "On Linux, SnapTune and x42-Autotune are both open source; x42 has been around for years and comes with most distributions’ audio packages.",
          "In FL Studio, AutoTune Go is already there. The FL Studio guide says how it and SnapTune differ.",
        ],
      },
      {
        heading: "Your DAW may already have one",
        paragraphs: [
          "Logic Pro has a Pitch Correction plugin, GarageBand has a Pitch Correction slider in the track editor, Reaper has ReaTune, and FL Studio has Pitcher in the editions that include it. Try those first if you only need a nudge; a separate plugin earns its place with more control or when you move between DAWs.",
        ],
      },
      {
        heading: "Sources",
        paragraphs: ["Each maker’s own page, read on 12 November 2026. Check them for the latest version before you install."],
        sources: [
          { name: "Graillon (Auburn Sounds)", href: "https://www.auburnsounds.com/products/Graillon.html" },
          { name: "MAutoPitch (MeldaProduction)", href: "https://www.meldaproduction.com/MAutoPitch" },
          { name: "GSnap (GVST)", href: "https://www.gvst.co.uk/gsnap.htm" },
          { name: "x42-Autotune (x42 plugins)", href: "https://x42-plugins.com/x42/x42-autotune" },
          { name: "AutoTune Go joins FL Cloud (Image-Line)", href: "https://www.image-line.com/news/autotune-go-joins-fl-cloud" },
          { name: "SnapTune source code and method (GitHub)", href: "https://github.com/NicoFerni/snaptune" },
        ],
      },
    ],
    faqs: [
      {
        q: "What is the best free autotune plugin?",
        a: "It depends on the job. SnapTune covers hard tune to natural with MIDI target notes and a 2.7 ms Live mode on Mac, Windows and Linux; Graillon 3 Free adds vocal effects; MAutoPitch is the quickest for a light touch; AutoTune Go is already inside FL Studio. They are all free, so try two side by side on your own voice.",
      },
      {
        q: "Which free autotune follows a MIDI melody?",
        a: "SnapTune (MIDI target notes), GSnap (MIDI mode) and x42-Autotune (MIDI input) all tune the voice to notes you play or draw.",
      },
      { q: "Is there an open-source autotune?", a: "Yes: SnapTune (AGPL-3.0, VST3, AU and LV2) and x42-Autotune (GPL, LV2)." },
      { q: "Which free autotune runs on Linux?", a: "SnapTune (LV2, VST3 and a standalone app), Graillon 3 Free and x42-Autotune." },
      trademark,
    ],
  },
  {
    slug: "hard-tune",
    published: "2026-11-12",
    updated: "2026-11-12",
    title: "How to Get the Hard Autotune Sound (Free Plugin Settings)",
    description:
      "The robotic, stair-step autotune sound from trap and pop, step by step with a free plugin: key, Retune Speed at 0 ms, and how to fix warble, wrong notes and low voices.",
    keywords: [
      "hard autotune settings",
      "how to get the autotune sound",
      "robotic autotune effect",
      "trap autotune settings",
      "t-pain autotune effect free",
      "hard tune vocals",
      "autotune retune speed 0",
    ],
    heading: "The hard autotune sound",
    lead: "The hard autotune sound is pitch correction set to its fastest: the voice jumps from note to note with no glide, the stair-step effect from trap, rap and pop records. Here is how to get it with SnapTune, a free plugin, and how to fix it when it sounds wrong.",
    sections: [
      {
        heading: "The settings",
        steps: [
          "Put SnapTune on the vocal’s own track, not on the beat or the master.",
          "Set Key and Scale to the key of the beat. If you don’t know it, use Chromatic for now: every note is a target, so it snaps without wrong-key jumps, just less musically.",
          "Pick the Hard Tune preset, or set Retune Speed to 0 ms and Humanize to 0.",
          "Leave Transition on Auto: at 0 ms Retune Speed the note changes are instant.",
          "Set Voice to the singer’s range: Low Male for deep voices, Soprano for high ones.",
        ],
      },
      {
        heading: "Two variations",
        paragraphs: [
          "Melodic Trap is a touch slower than Hard Tune (8 ms, with a little Humanize): still tight, but less like a synth. Hard Tune Vibrato adds a vibrato to every held note on top of the snap; to keep your own vibrato instead, turn on Keep my vibrato on the Vibrato page.",
          "Deep Robot pairs the snap with the formant four semitones down, for a darker, heavier voice; the Formant knob works in Studio mode.",
        ],
      },
      {
        heading: "When it sounds wrong",
        paragraphs: [
          "Wrong notes: the key is wrong, or the scale has notes the melody avoids. Check the key, or switch off the notes you don’t want by clicking them in the plugin.",
          "A warble or flutter on held notes: the singer is between two notes of the scale. Sing closer to the note, raise Humanize a little, or switch off one of the two notes.",
          "It doesn’t follow a low voice: set Voice to Low Male. If breaths and room echo make it jump, raise Tracking.",
          "The robot sound is too much: raise Retune Speed to 20 to 50 ms and the glides come back.",
        ],
      },
      {
        heading: "Hear it while you record",
        paragraphs: [
          "Singing into the effect changes how you sing: you lean into the snap. Switch SnapTune to Live while you record (2.7 ms, quick enough to sing through), and back to Studio when you mix.",
        ],
      },
    ],
    faqs: [
      { q: "What retune speed gives the hard autotune sound?", a: "0 ms, the fastest. Anything up to about 10 ms still sounds hard; past 20 ms the slides come back." },
      { q: "Do I need the paid Auto-Tune for this sound?", a: "No. Any pitch correction with a fast retune speed makes it. SnapTune is free and open source and has a Hard Tune preset." },
      { q: "Why does it sound different from the records?", a: "Usually the key. The effect only sounds right when the scale matches the song; with the wrong key, the voice jumps to notes that clash." },
      trademark,
    ],
  },
  {
    slug: "autotune-reaper",
    published: "2026-11-12",
    updated: "2026-11-12",
    title: "Free Autotune for Reaper: Install and Set Up SnapTune",
    description:
      "A free autotune plugin for Reaper on Mac, Windows and Linux: install SnapTune, find it in the FX browser, set hard tune or natural, and tune to MIDI notes.",
    keywords: ["autotune reaper free", "free autotune for reaper", "reaper pitch correction plugin", "reatune alternative", "reaper autotune vst3", "reaper linux autotune"],
    heading: "Free autotune in Reaper",
    lead: "SnapTune is a free, open-source autotune plugin that loads in Reaper as a VST3 (and as an Audio Unit on a Mac). Reaper already comes with ReaTune; SnapTune adds a hard-tune-to-natural Retune Speed knob, 13 scales, presets and a 2.7 ms Live mode. I test SnapTune in FL Studio and haven’t tried every Reaper setup yet, so if something is off, tell me.",
    sections: [
      {
        heading: "Install and find it",
        steps: [
          "Download SnapTune for your system and run the installer (on Linux, unpack the archive and run install.sh).",
          "In Reaper, open Options, Preferences, Plug-ins, VST, and click Re-scan. On a Mac the Audio Unit is under Plug-ins, AU.",
          "Click the FX button on the vocal track, type SnapTune in the search box and add it.",
        ],
      },
      {
        heading: "Hard tune or natural",
        steps: [
          "Set Key and Scale to the song.",
          "Pick Hard Tune for the robotic snap, Natural or Subtle Polish for a correction nobody hears.",
          "For deep voices set Voice to Low Male; if breaths make it jump, raise Tracking.",
        ],
      },
      {
        heading: "Recording through it",
        paragraphs: [
          "Arm the track, turn on record monitoring and switch SnapTune to Live: 2.7 ms, so you hear yourself tuned. Switch back to Studio for the mix; Reaper compensates its 46 ms on its own.",
        ],
      },
      {
        heading: "Tuning to MIDI notes",
        paragraphs: [
          "Reaper passes the MIDI on a track to that track’s effects. Put a MIDI item with the melody on the vocal track itself (or send MIDI to it from another track), and turn on MIDI notes in SnapTune: while a note is held, the voice is tuned to it.",
        ],
      },
    ],
    faqs: [
      { q: "Is SnapTune better than ReaTune?", a: "They’re different. ReaTune also does manual correction; SnapTune is built for real-time vocal tuning, with presets from hard tune to natural, vibrato controls and a Formant knob. Both are free, so try both." },
      { q: "Does it work in Reaper on Linux?", a: "Use the VST3 on Linux. The Linux builds are new and I haven’t tried them in a Linux DAW yet; if Reaper has trouble, open an issue on GitHub or write to support@getsnaptune.com." },
      trademark,
    ],
  },
  {
    slug: "autotune-ableton",
    published: "2026-11-12",
    updated: "2026-11-12",
    title: "Free Autotune for Ableton Live: SnapTune (VST3 and AU)",
    description:
      "A free autotune plugin for Ableton Live on Mac and Windows: install SnapTune, rescan, drop it on a vocal, set hard tune or natural, and tune to a MIDI track.",
    keywords: ["autotune ableton free", "free autotune for ableton", "ableton live pitch correction plugin", "ableton autotune vst3", "how to autotune in ableton"],
    heading: "Free autotune in Ableton Live",
    lead: "SnapTune is a free, open-source autotune plugin that loads in Ableton Live as a VST3 on Windows and Mac, and as an Audio Unit on a Mac. I test it in FL Studio and haven’t tried every version of Live yet; if something is off, tell me.",
    sections: [
      {
        heading: "Install and find it",
        steps: [
          "Download SnapTune for your system and run the installer.",
          "In Live, open Settings (Preferences in older versions), Plug-Ins. Turn on the VST3 system folders and, on a Mac, Audio Units. Click Rescan.",
          "In the browser, open Plug-Ins, find SnapTune and drag it onto the vocal track.",
        ],
      },
      {
        heading: "Hard tune or natural",
        steps: [
          "Set Key and Scale to the song.",
          "Pick Hard Tune for the robotic snap, Natural or Subtle Polish for a correction nobody hears.",
          "For deep voices set Voice to Low Male; if breaths make it jump, raise Tracking.",
        ],
      },
      {
        heading: "Recording through it",
        paragraphs: [
          "Set the track’s Monitor to In or Auto and switch SnapTune to Live: 2.7 ms, so you hear yourself tuned. Switch back to Studio for the mix; Live compensates its 46 ms.",
        ],
      },
      {
        heading: "Tuning to a MIDI track",
        paragraphs: [
          "Make a MIDI track with the melody. Set its MIDI To to the vocal track, and in the chooser below it pick SnapTune. Turn on MIDI notes in SnapTune: while a note is held, the voice is tuned to it.",
        ],
      },
    ],
    faqs: [
      { q: "Does Ableton have its own autotune?", a: "Live doesn’t include a real-time vocal tuner like this one, which is why people add a plugin. SnapTune is free and open source." },
      { q: "SnapTune doesn’t appear in the browser.", a: "Check that the VST3 system folders (and Audio Units on a Mac) are on under Settings, Plug-Ins, then Rescan. Quit and reopen Live after an update." },
      trademark,
    ],
  },
  {
    slug: "autotune-garageband",
    published: "2026-11-12",
    updated: "2026-11-12",
    title: "Free Autotune for GarageBand: SnapTune Audio Unit for Mac",
    description:
      "A free autotune Audio Unit for GarageBand on Mac: install SnapTune, turn on Audio Units, add it from Smart Controls, and get hard tune or natural correction.",
    keywords: ["autotune garageband free", "free autotune for garageband", "garageband autotune plugin", "garageband pitch correction", "autotune mac free"],
    heading: "Free autotune in GarageBand",
    lead: "SnapTune is a free, open-source autotune plugin for Mac, and its Audio Unit loads in GarageBand. GarageBand already has a Pitch Correction slider; SnapTune adds the hard-tune-to-natural Retune Speed knob, 13 scales, presets, vibrato controls and a Formant knob. Every build passes Apple’s Audio Unit validation, but I haven’t tried it in GarageBand myself yet; if something is off, tell me.",
    sections: [
      {
        heading: "Install and find it",
        steps: [
          "Download SnapTune for Mac and open the .pkg. The first time, macOS asks: open System Settings, Privacy & Security, and click Open Anyway.",
          "In GarageBand, open Settings, Audio/MIDI, and turn on Audio Units.",
          "Select the vocal track, open Smart Controls (B), click Plug-ins, then an empty slot, Audio Units, Nico Fernandez, SnapTune.",
        ],
      },
      {
        heading: "Hard tune or natural",
        steps: [
          "Set Key and Scale to the song (GarageBand shows the project key in the LCD).",
          "Pick Hard Tune for the robotic snap, Natural or Subtle Polish for a correction nobody hears.",
          "For deep voices set Voice to Low Male; if breaths make it jump, raise Tracking.",
        ],
      },
      {
        heading: "Recording through it",
        paragraphs: ["Turn on the track’s monitoring and switch SnapTune to Live: 2.7 ms, so you hear yourself tuned with headphones on. Switch back to Studio for the mix."],
      },
    ],
    faqs: [
      { q: "Isn’t GarageBand’s Pitch Correction enough?", a: "For a nudge, often yes. SnapTune is for the hard-tune effect with more control, other scales, vibrato and formant, or when you move to Logic or another DAW: the same plugin loads there." },
      { q: "Does it work on GarageBand for iPhone or iPad?", a: "No. SnapTune is a Mac Audio Unit; there’s no iOS version." },
      trademark,
    ],
  },
  {
    slug: "autotune-bitwig",
    published: "2026-11-12",
    updated: "2026-11-12",
    title: "Free Autotune for Bitwig Studio: SnapTune on Mac, Windows, Linux",
    description:
      "A free autotune plugin for Bitwig Studio on Mac, Windows and Linux: install the SnapTune VST3, add it to a vocal track and set hard tune or natural correction.",
    keywords: ["autotune bitwig free", "free autotune for bitwig", "bitwig pitch correction plugin", "bitwig linux autotune", "bitwig autotune vst3"],
    heading: "Free autotune in Bitwig Studio",
    lead: "SnapTune is a free, open-source autotune plugin that loads in Bitwig Studio as a VST3 on Mac, Windows and Linux. I test it in FL Studio and haven’t tried it in Bitwig yet; if something is off, tell me.",
    sections: [
      {
        heading: "Install and find it",
        steps: [
          "Download SnapTune for your system and run the installer (on Linux, unpack the archive and run install.sh, which puts the VST3 in ~/.vst3).",
          "In Bitwig, open Settings, Locations, and check that the VST3 folder is listed; Bitwig scans it on start, or rescan from there.",
          "On the vocal track, open the device panel, click the plus, search for SnapTune and add it.",
        ],
      },
      {
        heading: "Hard tune or natural",
        steps: [
          "Set Key and Scale to the song.",
          "Pick Hard Tune for the robotic snap, Natural or Subtle Polish for a correction nobody hears.",
          "For deep voices set Voice to Low Male; if breaths make it jump, raise Tracking.",
        ],
      },
      {
        heading: "Recording through it",
        paragraphs: ["Turn on monitoring for the vocal track and switch SnapTune to Live: 2.7 ms, so you hear yourself tuned. Switch back to Studio for the mix; Bitwig compensates its 46 ms."],
      },
    ],
    faqs: [
      { q: "Can it follow notes from another track?", a: "SnapTune takes MIDI notes as targets. In Bitwig, a Note Receiver device in front of SnapTune can bring in notes from a MIDI track; I haven’t tried that setup yet." },
      { q: "Does it work in Bitwig on Linux?", a: "It should, as a VST3. The Linux builds are new and I haven’t tried them in a Linux DAW yet; if Bitwig has trouble, open an issue on GitHub or write to support@getsnaptune.com." },
      trademark,
    ],
  },
  {
    slug: "es/autotune-gratis",
    lang: "es",
    translation: "free-autotune",
    published: "2026-11-12",
    updated: "2026-11-12",
    title: "Autotune gratis: plugin VST3, AU y LV2 para Mac, Windows y Linux",
    description:
      "SnapTune es un autotune gratis y de código abierto: afinación de voz de hard tune a natural, VST3, AU y LV2 para FL Studio y otros DAW. Sin prueba ni cuenta.",
    keywords: [
      "autotune gratis",
      "plugin autotune gratis",
      "autotune gratis fl studio",
      "autotune vst gratis",
      "autotune gratis para pc",
      "autotune gratis mac",
      "afinador de voz vst gratis",
      "corrector de tono gratis",
    ],
    heading: "Un autotune gratis",
    lead: "SnapTune es un plugin de autotune gratis y de código abierto (VST3, AU y LV2) para Mac, Windows y Linux. Afina tu voz a la tonalidad mientras suena: el salto duro y robótico en un extremo de la perilla, una corrección natural que nadie nota en el otro. Sin prueba, sin marca de agua y sin cuenta.",
    sections: [
      {
        heading: "Qué incluye",
        paragraphs: [
          "Un VST3 y un Audio Unit para Mac, un VST3 para Windows de 64 bits, y un VST3 y un LV2 para Linux, más una app independiente en los tres. Funciona en cualquier DAW que cargue esos formatos; yo lo pruebo en FL Studio.",
          "Elige la tonalidad y una de 13 escalas, o activa y desactiva notas a mano. Si tocas notas en una pista MIDI, la voz sigue esas notas. Ocho presets cubren los sonidos de siempre, de Hard Tune a Smooth Glide.",
        ],
      },
      {
        heading: "El sonido hard tune",
        paragraphs: [
          "Pon Retune Speed en 0 ms o elige el preset Hard Tune. La voz salta a cada nota sin deslizarse: el efecto escalonado del trap, el rap y el pop. Suena bien cuando la tonalidad coincide con la del tema. Para sumar un vibrato encima del salto, elige Hard Tune Vibrato; para conservar el tuyo, activa Keep my vibrato en la página Vibrato.",
        ],
      },
      {
        heading: "Afinación natural",
        paragraphs: [
          "Sube Retune Speed o elige Natural o Subtle Polish. Los deslizamientos y el vibrato pasan, y solo se corrige lo que se desvía de la nota. Humanize relaja las notas largas para que no suenen fijas. En modo Studio los formantes no se mueven, así que la voz conserva su carácter.",
        ],
      },
      {
        heading: "Escúchalo mientras grabas",
        paragraphs: [
          "El modo Live responde en 2,7 ms, lo bastante rápido para cantar a través de él y oírte afinado. El modo Studio usa 46 ms para el resultado más limpio y se lo informa al DAW, que alinea todo.",
        ],
      },
      {
        heading: "Instalación",
        steps: [
          "Descarga el instalador para tu sistema desde esta página.",
          "En Mac, abre el .pkg. En Windows, ejecuta el instalador. En Linux, descomprime el archivo y ejecuta install.sh.",
          "Reinicia el DAW, vuelve a escanear los plugins y pon SnapTune en la pista de voz.",
        ],
      },
    ],
    faqs: [
      { q: "¿De verdad es gratis?", a: "Sí. Es código abierto con licencia AGPL-3.0: sin prueba, sin marca de agua, sin cuenta, y el código está en GitHub." },
      {
        q: "¿Funciona en FL Studio?",
        a: "Sí, es donde lo pruebo, en cualquier edición que cargue plugins VST3. Desde septiembre de 2026 FL Studio también trae AutoTune Go gratis; SnapTune suma 13 escalas, notas MIDI, perilla de formantes, un modo Live de 2,7 ms y funciona en otros DAW.",
      },
      { q: "¿Por qué no le hace nada a mi voz?", a: "Necesita la voz sola en su pista: un beat o una mezcla completa no tiene una única altura que seguir." },
      { q: "macOS o Windows no me dejan abrir el instalador.", a: "Los instaladores todavía no están firmados. En Mac: Ajustes del Sistema, Privacidad y seguridad, Abrir igualmente. En Windows: Más información, Ejecutar de todas formas." },
      {
        q: "¿SnapTune es lo mismo que Auto-Tune?",
        a: "No. Auto-Tune es una marca de Antares Audio Technologies, y SnapTune no tiene relación con ellos. Se dice “autotune” a cualquier corrección de tono; SnapTune es una independiente y de código abierto.",
      },
    ],
  },
];

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug)!;

/** The guides in one language, for lists of links. */
export const guidesIn = (lang: "en" | "es") => guides.filter((g) => (g.lang ?? "en") === lang);
