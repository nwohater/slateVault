import { invoke } from "@tauri-apps/api/core";

/**
 * Copies text to the clipboard.
 *
 * Browser clipboard APIs are blocked in some Tauri/WebView contexts, so use
 * a native Tauri command first and keep textarea copy as a dev-browser fallback.
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await invoke("copy_to_clipboard", { text });
    return;
  } catch {
    // Fall through for browser-only development contexts where Tauri invoke is unavailable.
  }

  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
  document.body.appendChild(el);
  el.focus();
  el.select();
  el.setSelectionRange(0, el.value.length);

  try {
    const copied = document.execCommand("copy");
    if (copied) return;
  } finally {
    document.body.removeChild(el);
  }

  throw new Error("Clipboard copy was blocked by this WebView context.");
}
