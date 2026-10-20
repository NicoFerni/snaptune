Real-time pitch correction: VST3, Audio Unit and a standalone app for macOS (universal, Apple Silicon + Intel), and VST3 and a standalone app for Windows (64-bit).

### What's new in 1.2

- **Windows:** VST3 and a standalone app for Windows 10 or later (64-bit), with an installer.
- **Installers:** a .pkg for macOS and a setup .exe for Windows put everything in place.
- **Anonymous usage pings:** once per DAW session SnapTune sends its version, OS, CPU type, DAW name, plugin format and a random install id, so crashes and compatibility problems show up. No audio, projects or settings are sent. To turn it off, see [Usage data](https://github.com/NicoFerni/snaptune#usage-data) in the README.
- The version shown in the plugin window now matches the release.

Try it in your browser first at [getsnaptune.com](https://getsnaptune.com).

### Install on macOS

1. Download **SnapTune-…-macOS.pkg** below and open it.
2. The installer isn't notarized by Apple yet, so macOS blocks it the first time:
   - **macOS 15 or later:** click **Done**, then go to **System Settings > Privacy & Security**, scroll down and click **Open Anyway**.
   - **macOS 11 to 14:** right-click the .pkg and choose **Open**.
3. Follow the installer, then restart your DAW and rescan plugins (FL Studio: **Options > Manage plugins > Find installed plugins**).

If you installed 1.1.0 or earlier by hand in `~/Library/Audio/Plug-Ins`, the installer removes those copies so SnapTune isn't listed twice. Prefer copying files yourself? **SnapTune-…-macOS.zip** has the bundles and an INSTALL.txt.

### Install on Windows

1. Download **SnapTune-…-Windows-Setup.exe** below and run it.
2. The installer isn't code-signed yet, so SmartScreen may say "Windows protected your PC": click **More info > Run anyway**.
3. Restart your DAW and rescan plugins.

The VST3 goes to `C:\Program Files\Common Files\VST3`. **SnapTune-…-Windows.zip** has the same files for a manual install.

See the [README](https://github.com/NicoFerni/snaptune#readme) for the controls and how it works.
