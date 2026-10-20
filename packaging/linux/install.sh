#!/bin/sh
# Installs SnapTune for the current user, no root needed: the VST3 in ~/.vst3, the LV2 in ~/.lv2,
# and the standalone app in ~/.local/bin with an entry in the applications menu.
# Run it from the folder it came in:  ./install.sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
apps="$HOME/.local/share/applications"
icons="$HOME/.local/share/icons/hicolor/512x512/apps"

mkdir -p "$HOME/.vst3" "$HOME/.lv2" "$HOME/.local/bin" "$apps" "$icons"

# Replace an earlier version rather than copying into it.
rm -rf "$HOME/.vst3/SnapTune.vst3" "$HOME/.lv2/SnapTune.lv2"
cp -R "$here/SnapTune.vst3" "$HOME/.vst3/"
cp -R "$here/SnapTune.lv2" "$HOME/.lv2/"
cp "$here/SnapTune" "$HOME/.local/bin/SnapTune"
chmod +x "$HOME/.local/bin/SnapTune"
cp "$here/snaptune.png" "$icons/snaptune.png"

cat > "$apps/snaptune.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=SnapTune
Comment=Real-time pitch correction
Exec=$HOME/.local/bin/SnapTune
Icon=snaptune
Categories=AudioVideo;Audio;
Terminal=false
DESKTOP

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$apps" >/dev/null 2>&1 || true

echo "SnapTune is installed:"
echo "  VST3        $HOME/.vst3/SnapTune.vst3"
echo "  LV2         $HOME/.lv2/SnapTune.lv2"
echo "  Standalone  $HOME/.local/bin/SnapTune"
echo "Restart your DAW and rescan plugins."
