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
; The privacy notice, then the usage-data box on the Tasks page. SignPath Foundation's terms ask for
; both in the installer of any program that sends data (https://signpath.org/terms).
InfoBeforeFile=privacy.txt
; The usage-data choice is a file in the data folder of the user running the installer (Code below).
UsedUserAreasWarning=no

[Types]
Name: "full"; Description: "VST3 plugin and standalone app"
Name: "custom"; Description: "Custom"; Flags: iscustom

[Components]
Name: "vst3"; Description: "VST3 plugin (Common Files\VST3)"; Types: full custom
Name: "standalone"; Description: "Standalone app, for trying it with a microphone and headphones"; Types: full

[Tasks]
Name: "usagedata"; Description: "Send anonymous usage data (version, system and DAW, never your audio) and check for updates"

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

[Code]
// The plugin stays quiet while %APPDATA%\SnapTune\no-telemetry exists (Source/Telemetry.h). The box
// starts unticked when that file is already there, so reinstalling never turns usage data back on.
function OptOutFile: String;
begin
  Result := ExpandConstant('{userappdata}\SnapTune\no-telemetry');
end;

procedure InitializeWizard;
begin
  if FileExists(OptOutFile) then
    WizardSelectTasks('!usagedata');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep <> ssPostInstall then
    Exit;

  if WizardIsTaskSelected('usagedata') then
    DeleteFile(OptOutFile)
  else if ForceDirectories(ExtractFileDir(OptOutFile)) then
    SaveStringToFile(OptOutFile, '', False);
end;
