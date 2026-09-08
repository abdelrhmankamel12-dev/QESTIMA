Option Explicit

Dim shell, fileSystem, installDirectory, indexFile, runtimeExecutable, appUrl, profileDirectory, appVersion
Dim browserCandidates, browserPath, candidate, command

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

installDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
indexFile = fileSystem.BuildPath(installDirectory, "app\index.html")
appVersion = "0.12.0"
profileDirectory = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\QESTIMA Universal\Browser Profile")

' Production packages contain an official Electron runtime renamed to
' QESTIMA.exe.  Prefer it so every supported Windows machine uses the same
' Chromium/Node runtime and no browser installation is required.
runtimeExecutable = fileSystem.BuildPath(installDirectory, "QESTIMA.exe")
If fileSystem.FileExists(runtimeExecutable) Then
  shell.Run Chr(34) & runtimeExecutable & Chr(34), 1, False
  WScript.Quit 0
End If

If Not fileSystem.FileExists(indexFile) Then
  MsgBox "QESTIMA runtime and files are missing. Please reinstall the application.", 16, "QESTIMA"
  WScript.Quit 2
End If

' Force the browser to load the current release after an in-place update.
appUrl = "file:///" & Replace(indexFile, "\", "/") & "?v=" & appVersion
browserCandidates = Array( _
  shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"), _
  shell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"), _
  shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"), _
  shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"), _
  shell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe"), _
  shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe") _
)

browserPath = ""
For Each candidate In browserCandidates
  If fileSystem.FileExists(candidate) Then
    browserPath = candidate
    Exit For
  End If
Next

If browserPath <> "" Then
  command = Chr(34) & browserPath & Chr(34) & _
    " --app=" & Chr(34) & appUrl & Chr(34) & _
    " --user-data-dir=" & Chr(34) & profileDirectory & Chr(34) & _
    " --disable-http-cache" & _
    " --start-maximized"
  shell.Run command, 1, False
Else
  MsgBox "An embedded QESTIMA runtime was not found and no supported browser is installed. Install the signed desktop package before continuing.", 16, "QESTIMA"
  WScript.Quit 3
End If
