; Inno Setup script for SnapTune-<version>-Windows-Setup.exe, built in .github/workflows/build.yml:
;
;   ISCC /DAppVersion=1.2.0 /DAppNumber=1.2.0 /DStageDir=<folder with SnapTune.vst3 and SnapTune.exe> /O<output dir> SnapTune.iss
;
; AppVersion is the display name (1.2.0-dev.abc1234 for CI builds), AppNumber the numeric version.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef AppNumber
  #define AppNumber "0.0.0"
#endif
#ifndef StageDir
  #error Pass /DStageDir=<folder with SnapTune.vst3, SnapTune.exe and LICENSE.txt>
#endif

[Setup]
AppId={{4E77E89D-A2A8-4E87-B7C7-772943313933}
AppName=SnapTune
AppVersion={#AppVersion}
VersionInfoVersion={#AppNumber}
AppPublisher=Nico Fernandez
AppPublisherURL=https://getsnaptune.com
AppSupportURL=https://github.com/NicoFerni/snaptune/issues
DefaultDirName={autopf}\SnapTune
DisableProgramGroupPage=yes
DisableDirPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
OutputBaseFilename=SnapTune-{#AppVersion}-Windows-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=SnapTune

[Types]
Name: "full"; Description: "VST3 plugin and standalone app"
Name: "custom"; Description: "Custom"; Flags: iscustom

[Components]
Name: "vst3"; Description: "VST3 plugin (Common Files\VST3)"; Types: full custom
Name: "standalone"; Description: "Standalone app, for trying it with a microphone and headphones"; Types: full

[InstallDelete]
; Clear the old bundle first so files dropped from a newer version don't linger.
Type: filesandordirs; Name: "{commoncf64}\VST3\SnapTune.vst3"; Components: vst3

[Files]
Source: "{#StageDir}\SnapTune.vst3\*"; DestDir: "{commoncf64}\VST3\SnapTune.vst3"; Components: vst3; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#StageDir}\SnapTune.exe"; DestDir: "{app}"; Components: standalone; Flags: ignoreversion
Source: "{#StageDir}\LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\SnapTune"; Filename: "{app}\SnapTune.exe"; Components: standalone

[Messages]
FinishedLabel=SnapTune is installed.%n%nClose your DAW completely, open it again and rescan plugins (FL Studio: Options > Manage plugins > Find installed plugins).
