Real-time pitch correction for macOS: VST3, Audio Unit and a standalone app, universal (Apple Silicon + Intel).

### Install

1. Download **SnapTune-…-macOS.zip** below and unzip it.
2. Copy `SnapTune.vst3` to `~/Library/Audio/Plug-Ins/VST3/` and `SnapTune.component` to `~/Library/Audio/Plug-Ins/Components/`.
3. These builds aren't notarized by Apple, so clear the download quarantine once in Terminal:
   ```sh
   xattr -dr com.apple.quarantine ~/Library/Audio/Plug-Ins/VST3/SnapTune.vst3 ~/Library/Audio/Plug-Ins/Components/SnapTune.component
   ```
4. Restart your DAW and rescan plugins (FL Studio: **Options > Manage plugins > Find installed plugins**).

See the [README](https://github.com/NicoFerni/snaptune#readme) for the controls and how it works.
