Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APP_NAME "QESTIMA"
!define APP_VERSION "0.14.0"
!define APP_PUBLISHER "QESTIMA"
!define APP_REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\QESTIMA"

; The release builder overrides this with -DQESTIMA_OUTFILE.  The default is
; deliberately labelled as an unsigned preview so an unsigned binary can
; never be mistaken for a commercially signed distribution.
!ifndef QESTIMA_OUTFILE
  !define QESTIMA_OUTFILE "..\release\QESTIMA-Setup-0.14.0-win-x64-Preview-Unsigned.exe"
!endif

Name "${APP_NAME} ${APP_VERSION}"
Caption "QESTIMA Professional Workspace — MEP Estimating System"
OutFile "${QESTIMA_OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\QESTIMA"
InstallDirRegKey HKCU "${APP_REGKEY}" "InstallLocation"
Icon "icon.ico"
UninstallIcon "icon.ico"
BrandingText "QESTIMA · Professional MEP Estimating"
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "0.14.0.0"
VIAddVersionKey /LANG=1033 "ProductName" "QESTIMA Professional Workspace"
VIAddVersionKey /LANG=1033 "CompanyName" "QESTIMA"
VIAddVersionKey /LANG=1033 "FileDescription" "QESTIMA Universal Windows Installer"
VIAddVersionKey /LANG=1033 "FileVersion" "0.14.0"
VIAddVersionKey /LANG=1033 "ProductVersion" "0.14.0"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright 2026 QESTIMA"

!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\QESTIMA.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Run QESTIMA"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "Arabic"
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
FunctionEnd

Section "QESTIMA" SEC_MAIN
  SectionIn RO
  SetOutPath "$INSTDIR"
  ; prepare-runtime.cjs must run first. It stages the official Electron
  ; runtime, the QESTIMA app, and optional PDF/CAD tools in this folder.
  File /r "runtime-staging\*.*"

  WriteUninstaller "$INSTDIR\Uninstall QESTIMA.exe"
  Delete "$DESKTOP\QESTIMA.lnk"
  Delete "$SMPROGRAMS\QESTIMA\QESTIMA.lnk"
  CreateDirectory "$SMPROGRAMS\QESTIMA"
  CreateShortcut "$SMPROGRAMS\QESTIMA\QESTIMA.lnk" "$INSTDIR\QESTIMA.exe" "" "$INSTDIR\icon.ico" 0 SW_SHOWNORMAL
  CreateShortcut "$DESKTOP\QESTIMA.lnk" "$INSTDIR\QESTIMA.exe" "" "$INSTDIR\icon.ico" 0 SW_SHOWNORMAL

  WriteRegStr HKCU "${APP_REGKEY}" "DisplayName" "QESTIMA"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${APP_REGKEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${APP_REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${APP_REGKEY}" "UninstallString" "$\"$INSTDIR\Uninstall QESTIMA.exe$\""
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${APP_REGKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\QESTIMA.lnk"
  Delete "$SMPROGRAMS\QESTIMA\QESTIMA.lnk"
  RMDir "$SMPROGRAMS\QESTIMA"
  DeleteRegKey HKCU "${APP_REGKEY}"
  RMDir /r "$INSTDIR"
SectionEnd
