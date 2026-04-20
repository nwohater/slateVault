!macro NSIS_HOOK_POSTINSTALL
  ; Tauri installs sidecars with the target triple suffix. Create a stable
  ; command name so MCP clients can launch `slatevault-mcp` from PATH.
  IfFileExists "$INSTDIR\slatevault-mcp-x86_64-pc-windows-msvc.exe" 0 +2
    CopyFiles /SILENT "$INSTDIR\slatevault-mcp-x86_64-pc-windows-msvc.exe" "$INSTDIR\slatevault-mcp.exe"

  ; Add the install dir to the current user's PATH if it is not already there.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$installDir = ''$INSTDIR''; $path = [Environment]::GetEnvironmentVariable(''Path'', ''User''); if (-not $path) { $path = '''' }; $parts = @($path -split '';'' | Where-Object { $_ }); if ($parts -notcontains $installDir) { $newPath = @($parts + $installDir) -join '';''; [Environment]::SetEnvironmentVariable(''Path'', $newPath, ''User'') }"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\slatevault-mcp.exe"

  ; Remove the install dir from the current user's PATH on uninstall.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$installDir = ''$INSTDIR''; $path = [Environment]::GetEnvironmentVariable(''Path'', ''User''); if ($path) { $parts = @($path -split '';'' | Where-Object { $_ -and $_ -ne $installDir }); [Environment]::SetEnvironmentVariable(''Path'', ($parts -join '';''), ''User'') }"'
!macroend
