"use client";

import { getCurrentWindow } from "@tauri-apps/api/window";

function MinimizeIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M3.5 8h9" strokeLinecap="round" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
      <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="m4.25 4.25 7.5 7.5M11.75 4.25l-7.5 7.5" strokeLinecap="round" />
    </svg>
  );
}

export function WindowControls() {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  if (isMac) return null;

  const appWindow = getCurrentWindow();

  return (
    <div className="window-controls">
      <button
        className="window-control-btn"
        onClick={() => void appWindow.minimize()}
        title="Minimize"
        aria-label="Minimize window"
      >
        <MinimizeIcon />
      </button>
      <button
        className="window-control-btn"
        onClick={() => void appWindow.toggleMaximize()}
        title="Maximize"
        aria-label="Maximize window"
      >
        <MaximizeIcon />
      </button>
      <button
        className="window-control-btn window-control-close"
        onClick={() => void appWindow.close()}
        title="Close"
        aria-label="Close window"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
