Real-time pitch correction: VST3, Audio Unit and a standalone app for macOS (universal, Apple Silicon + Intel), VST3 and a standalone app for Windows (64-bit), and VST3, LV2 and a standalone app for Linux (64-bit).

### What's new in 2.3

- **Note changes that sound sung:** the voice now glides from one note to the next along a curve instead of jumping, and the new **Transition** knob sets how long that takes. Turn it to zero for the hard, stepped sound.
- **Vibrato page:** **Keep my vibrato** leaves your own vibrato in while the note is tuned (with a Depth knob), and you can add one with its own rate and delay.
- **Clearer highs in Studio mode:** consonants and breath had lost some brightness since 2.2. They're back.
- **Fewer blips:** a moment where the pitch was misread by an octave could bend the voice for an instant. It no longer does.
- **Compare:** a button in the header plays your untuned voice at the same level and delay, to hear what the correction is doing.
- **Smaller things:** the preset box says when you've moved a knob off a preset, and holding Shift while dragging a knob moves it five times slower.
- **Feedback:** a button in the header opens a short form in your browser, no account needed. Tell me what works and what doesn't.

Sessions saved with earlier versions open as before.

### Install on macOS

1. Download **SnapTune-…-macOS.pkg** below and open it.
2. The installer isn't notarized by Apple yet, so macOS blocks it the first time:
   - **macOS 15 or later:** click **Done**, then go to **System Settings > Privacy & Security**, scroll down and click **Open Anyway**.
   - **macOS 11 to 14:** right-click the .pkg and choose **Open**.
3. Follow the installer, then restart your DAW and rescan plugins (FL Studio: **Options > Manage plugins > Find installed plugins**).

Prefer copying files yourself? **SnapTune-…-macOS.zip** has the bundles and an INSTALL.txt.

### Install on Windows

1. Download **SnapTune-…-Windows-Setup.exe** below and run it.
2. The installer isn't code-signed yet, so SmartScreen may say "Windows protected your PC": click **More info > Run anyway**.
3. Restart your DAW and rescan plugins.

The VST3 goes to `C:\Program Files\Common Files\VST3`. **SnapTune-…-Windows.zip** has the same files for a manual install.

### Install on Linux

1. Download **SnapTune-…-Linux.tar.gz** below and unpack it.
2. In a terminal, in the unpacked folder, run `./install.sh`. It installs for your user, no sudo: the VST3 in `~/.vst3`, the LV2 in `~/.lv2`, and the standalone app in `~/.local/bin` with an entry in the applications menu.
3. Restart your DAW and rescan plugins.

Needs glibc 2.35 or newer (Ubuntu 22.04, Debian 12, Fedora 36 or later). INSTALL.txt in the tarball says how to install by hand or for every user.

See the [README](https://github.com/NicoFerni/snaptune#readme) for the controls and how it works.
