import { create } from "zustand";
import { getBundleType, getVersion, type BundleType } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "installing"
  | "installed"
  | "error";

interface AppState {
  initialized: boolean;
  version: string | null;
  bundleType: BundleType | null;
  channel: string;
  updateState: UpdateState;
  updateVersion: string | null;
  updateBody: string | null;
  updateError: string | null;
  updateDownloadedBytes: number;
  updateTotalBytes: number | null;
  updateProgress: number | null;
  lastCheckedAt: string | null;
  pendingUpdate: Update | null;
  initialize: () => Promise<void>;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
}

function deriveChannel(version: string | null): string {
  if (!version) return "stable";
  const match = version.match(/-([a-zA-Z]+)(?:[.-]|$)/);
  return match ? match[1].toLowerCase() : "stable";
}

function formatUpdaterError(error: unknown): string {
  const message = String(error);
  const lower = message.toLowerCase();

  if (process.env.NODE_ENV !== "production") {
    return "Update checks are only available in packaged SlateVault builds.";
  }

  if (
    lower.includes("pubkey") ||
    lower.includes("endpoint") ||
    lower.includes("updater") ||
    lower.includes("signature")
  ) {
    return "Updater is not configured yet. Add updater endpoints and signing keys in tauri.conf.json.";
  }

  return message;
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  version: null,
  bundleType: null,
  channel: "stable",
  updateState: "idle",
  updateVersion: null,
  updateBody: null,
  updateError: null,
  updateDownloadedBytes: 0,
  updateTotalBytes: null,
  updateProgress: null,
  lastCheckedAt: null,
  pendingUpdate: null,

  initialize: async () => {
    if (get().initialized) return;

    const [versionResult, bundleTypeResult] = await Promise.allSettled([
      getVersion(),
      getBundleType(),
    ]);

    const version = versionResult.status === "fulfilled" ? versionResult.value : null;
    const bundleType = bundleTypeResult.status === "fulfilled" ? bundleTypeResult.value : null;

    set({
      initialized: true,
      version,
      bundleType,
      channel: deriveChannel(version),
    });
  },

  checkForUpdates: async (manual = false) => {
    await get().initialize();

    if (process.env.NODE_ENV !== "production" && !manual) {
      return;
    }

    set({
      updateState: "checking",
      updateError: null,
    });

    try {
      const update = await check();

      if (!update) {
        set({
          pendingUpdate: null,
          updateVersion: null,
          updateBody: null,
          updateState: "up-to-date",
          updateError: null,
          updateDownloadedBytes: 0,
          updateTotalBytes: null,
          updateProgress: null,
          lastCheckedAt: new Date().toISOString(),
        });
        return;
      }

      set({
        pendingUpdate: update,
        updateVersion: update.version,
        updateBody: update.body ?? null,
        updateState: "available",
        updateError: null,
        updateDownloadedBytes: 0,
        updateTotalBytes: null,
        updateProgress: null,
        lastCheckedAt: new Date().toISOString(),
      });
    } catch (error) {
      set({
        pendingUpdate: null,
        updateState: "error",
        updateError: formatUpdaterError(error),
        updateDownloadedBytes: 0,
        updateTotalBytes: null,
        updateProgress: null,
        lastCheckedAt: new Date().toISOString(),
      });
    }
  },

  installUpdate: async () => {
    const pendingUpdate = get().pendingUpdate;
    if (!pendingUpdate) return;

    try {
      let downloadedBytes = 0;
      let totalBytes: number | null = null;

      set({
        updateState: "downloading",
        updateError: null,
        updateDownloadedBytes: 0,
        updateTotalBytes: null,
        updateProgress: null,
      });

      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          downloadedBytes = 0;
          totalBytes = event.data.contentLength ?? null;
          set({
            updateState: "downloading",
            updateDownloadedBytes: downloadedBytes,
            updateTotalBytes: totalBytes,
            updateProgress: totalBytes ? 0 : null,
          });
          return;
        }

        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const progress = totalBytes
            ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
            : null;
          set({
            updateDownloadedBytes: downloadedBytes,
            updateTotalBytes: totalBytes,
            updateProgress: progress,
          });
          return;
        }

        set({
          updateState: "installing",
          updateDownloadedBytes: downloadedBytes,
          updateTotalBytes: totalBytes,
          updateProgress: 100,
        });
      });
      set({
        updateState: "installed",
        updateProgress: 100,
        updateError: null,
      });
    } catch (error) {
      set({
        updateState: "error",
        updateError: formatUpdaterError(error),
      });
    }
  },
}));
