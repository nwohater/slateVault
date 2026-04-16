/**
 * Copies text to the clipboard.
 *
 * navigator.clipboard.writeText requires a secure context (HTTPS) that
 * Tauri's local webview doesn't provide on all platforms. Falls back to
 * the legacy execCommand approach which works inside Tauri webviews.
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}
