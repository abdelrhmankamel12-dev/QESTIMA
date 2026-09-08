Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APP_NAME "QESTIMA Universal"
!define APP_VERSION "0.3.1"
!define APP_PUBLISHER "QESTIMA"
!define APP_REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\QESTIMA Universal"

Name "${APP_NAME} ${APP_VERSION}"
Caption "QESTIMA Universal — MEP Estimating System"
OutFile "..\release\QESTIMA-Universal-Setup-0.3.1.exe"
InstallDir "$LOCALAPPDATA\Programs\QESTIMA Universal"
InstallDirRegKey HKCU "${APP_REGKEY}" "InstallLocation"
Icon "icon.ico"
UninstallIcon "icon.ico"
BrandingText "QESTIMA Universal · Professional MEP Estimating"
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "0.3.1.0"
VIAddVersionKey /LANG=1033 "ProductName" "QESTIMA Universal"
VIAddVersionKey /LANG=1033 "CompanyName" "QESTIMA"
VIAddVersionKey /LANG=1033 "FileDescription" "QESTIMA Universal Windows Installer"
VIAddVersionKey /LANG=1033 "FileVersion" "0.3.1"
VIAddVersionKey /LANG=1033 "ProductVersion" "0.3.1"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright 2026 QESTIMA"

!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_FINISHPAGE_RUN "$WINDIR\System32\wscript.exe"
!define MUI_FINISHPAGE_RUN_PARAMETERS "$\"$INSTDIR\launcher.vbs$\""
!define MUI_FINISHPAGE_RUN_TEXT "Run QESTIMA Universal"

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

Section "QESTIMA Universal" SEC_MAIN
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "universal-v031-src\launcher.vbs"
  File "icon.ico"
  SetOutPath "$INSTDIR\app"
  File /r "universal-v031-src\app\*.*"

  WriteUninstaller "$INSTDIR\Uninstall QESTIMA Universal.exe"

  ; Remove the broken preview shortcut while leaving its files and data recoverable.
  Delete "$DESKTOP\QESTIMA.lnk"
  Delete "$SMPROGRAMS\QESTIMA\QESTIMA.lnk"

  CreateDirectory "$SMPROGRAMS\QESTIMA Universal"
  CreateShortcut "$SMPROGRAMS\QESTIMA Universal\QESTIMA.lnk" "$WINDIR\System32\wscript.exe" "$\"$INSTDIR\launcher.vbs$\"" "$INSTDIR\icon.ico" 0 SW_SHOWNORMAL
  CreateShortcut "$DESKTOP\QESTIMA.lnk" "$WINDIR\System32\wscript.exe" "$\"$INSTDIR\launcher.vbs$\"" "$INSTDIR\icon.ico" 0 SW_SHOWNORMAL

  WriteRegStr HKCU "${APP_REGKEY}" "DisplayName" "QESTIMA Universal"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${APP_REGKEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${APP_REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${APP_REGKEY}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${APP_REGKEY}" "UninstallString" "$\"$INSTDIR\Uninstall QESTIMA Universal.exe$\""
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${APP_REGKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${APP_REGKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\QESTIMA.lnk"
  Delete "$SMPROGRAMS\QESTIMA Universal\QESTIMA.lnk"
  RMDir "$SMPROGRAMS\QESTIMA Universal"
  DeleteRegKey HKCU "${APP_REGKEY}"
  RMDir /r "$INSTDIR"
SectionEnd
