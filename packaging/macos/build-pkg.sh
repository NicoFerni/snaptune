#!/bin/bash
# Builds the SnapTune installer package from a folder holding the signed SnapTune.vst3, SnapTune.component
# and SnapTune.app. Used by CI; also runs locally:
#
#   packaging/macos/build-pkg.sh <stage dir> <version number> <output .pkg>

set -euo pipefail

stage=$1
version=$2
output=$3

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# component <bundle> <package id> <install location> <package file>
component() {
    local root="$work/root-$4"
    mkdir -p "$root"
    ditto "$stage/$1" "$root/$1"

    # Not relocatable: otherwise Installer "updates" an older copy wherever it finds one with the same
    # bundle id (e.g. a hand-installed ~/Library copy or an app left in Downloads) instead of installing here.
    pkgbuild --analyze --root "$root" "$work/$4.plist" >/dev/null
    plutil -replace 0.BundleIsRelocatable -bool NO "$work/$4.plist"

    pkgbuild --root "$root" \
             --component-plist "$work/$4.plist" \
             --identifier "$2" \
             --version "$version" \
             --install-location "$3" \
             --scripts "$here/scripts" \
             "$work/pkgs/$4" >/dev/null
}

mkdir -p "$work/pkgs"
component SnapTune.vst3      com.nicofernandez.snaptune.vst3 /Library/Audio/Plug-Ins/VST3       SnapTune-VST3.pkg
component SnapTune.component com.nicofernandez.snaptune.au   /Library/Audio/Plug-Ins/Components SnapTune-AU.pkg
component SnapTune.app       com.nicofernandez.snaptune.app  /Applications                      SnapTune-App.pkg

productbuild --distribution "$here/distribution.xml" \
             --package-path "$work/pkgs" \
             --resources "$here/resources" \
             "$output"
