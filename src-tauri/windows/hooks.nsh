!macro NSIS_HOOK_POSTINSTALL
  ; Tauri installs sidecars with the target triple suffix. Create a stable
  ; command name so MCP clients can launch `slatevault-mcp` from PATH.
  IfFileExists "$INSTDIR\slatevault-mcp-x86_64-pc-windows-msvc.exe" 0 +2
    CopyFiles /SILENT "$INSTDIR\slatevault-mcp-x86_64-pc-windows-msvc.exe" "$INSTDIR\slatevault-mcp.exe"

  ; Add install dir to user PATH directly via registry.
  ; Avoids PowerShell $-variable quoting issues by using NSIS registry ops only.
  ReadRegStr $R0 HKCU "Environment" "Path"
  ${StrLoc} $R1 $R0 "$INSTDIR" ">"
  StrCmp $R1 "" +1 +6          ; already present → skip to end
  StrLen $R2 $R0
  IntCmp $R2 0 +2 +1 +1        ; empty PATH → skip the semicolon prefix
  StrCpy $R0 "$R0;"
  WriteRegExpandStr HKCU "Environment" "Path" "$R0$INSTDIR"
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\slatevault-mcp.exe"

  ; Remove install dir from user PATH.
  ; Backtick NSIS string lets us use single quotes in the PowerShell script.
  ; $INSTDIR is the only NSIS variable here — NSIS expands it before execution.
  ; No PowerShell $-variables are used, avoiding NSIS expanding them to empty.
  nsExec::ExecToLog `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable('Path', ((([Environment]::GetEnvironmentVariable('Path', 'User') -split ';') -ne '$INSTDIR') -join ';'), 'User')"`
!macroend
