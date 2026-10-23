Real-time pitch correction: VST3, Audio Unit and a standalone app for macOS (universal, Apple Silicon + Intel), VST3 and a standalone app for Windows (64-bit), and VST3, LV2 and a standalone app for Linux (64-bit).

### What's new in 2.1

- **Steadier tracking on real recordings:** with breath, room sound or something else leaking into the mic, SnapTune sometimes heard a held note an octave or more too low for a few hundredths of a second. The correction let go for that moment, which sounded like a slight stutter (most of all in Studio mode). It now keeps to the note you're singing, and still follows real octave leaps.

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
