import { app, BrowserWindow, dialog, ipcMain, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { AppUpdater } from "electron-updater";

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type AutoUpdaterEvents = {
  on(event: "error", listener: (error: Error, message?: string) => void): void;
  on(event: "update-downloaded", listener: () => void): void;
};

type UpdateCheckResult =
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string }
  | { status: "available"; version: string }
  | { status: "not-available"; version: string };

function loadAutoUpdater(): AppUpdater | null {
  try {
    return (require("electron-updater") as typeof import("electron-updater"))
      .autoUpdater;
  } catch (error) {
    console.error("Auto-update module failed to load", error);
    return null;
  }
}

function readAppConfig(): { dataFilePath?: string } {
  try {
    const raw = fs.readFileSync(APP_CONFIG_PATH, "utf8");
    return JSON.parse(raw) as { dataFilePath?: string };
  } catch {
    return {};
  }
}

function writeAppConfig(config: { dataFilePath?: string }) {
  try {
    fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  } catch {
    // ignore write errors
  }
}

function registerFileIpcHandlers() {
  ipcMain.handle("file:get-remembered-path", () => {
    const config = readAppConfig();
    return config.dataFilePath ?? null;
  });

  ipcMain.handle("file:set-remembered-path", (_event, filePath: string) => {
    const config = readAppConfig();
    config.dataFilePath = filePath;
    writeAppConfig(config);
  });

  ipcMain.handle("file:open-dialog", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open data file",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    return result.canceled || result.filePaths.length === 0
      ? null
      : result.filePaths[0];
  });

  ipcMain.handle("file:save-dialog", async () => {
    const result = await dialog.showSaveDialog({
      title: "Create new data file",
      defaultPath: "punchboard.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    return result.canceled || !result.filePath ? null : result.filePath;
  });

  ipcMain.handle("file:read", () => {
    const config = readAppConfig();
    if (!config.dataFilePath) return null;
    try {
      return fs.readFileSync(config.dataFilePath, "utf8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("file:write", (_event, data: string) => {
    const config = readAppConfig();
    if (!config.dataFilePath) return false;
    try {
      fs.writeFileSync(config.dataFilePath, data, "utf8");
      return true;
    } catch {
      return false;
    }
  });
}

function registerUpdateIpcHandlers() {
  ipcMain.handle("updates:check", async (): Promise<UpdateCheckResult> => {
    if (!app.isPackaged) {
      return {
        status: "unsupported",
        message: "Updates only run in the packaged app.",
      };
    }

    const autoUpdater = loadAutoUpdater();
    if (!autoUpdater) {
      return { status: "error", message: "Updater unavailable." };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      const latestVersion = result?.updateInfo?.version;

      if (latestVersion && latestVersion !== app.getVersion()) {
        return { status: "available", version: latestVersion };
      }
      return { status: "not-available", version: app.getVersion() };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error ? error.message : "Update check failed.",
      };
    }
  });
}

function loadAppIcon(iconPath: string) {
  if (path.extname(iconPath).toLowerCase() !== ".svg") {
    return nativeImage.createFromPath(iconPath);
  }

  const iconSvg = fs.readFileSync(iconPath, "utf8");
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString("base64")}`,
  );
}

function getAppIconPath() {
  return app.isPackaged
    ? path.join(__dirname, "../public/punchboard_icon.svg")
    : path.join(process.cwd(), "public/punchboard_icon.svg");
}

function createMainWindow() {
  const iconPath = getAppIconPath();
  const iconImage = loadAppIcon(iconPath);

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#e2e8f0",
    title: "Punchboard",
    icon: iconImage,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    window.loadURL(rendererUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  window.loadFile(path.join(__dirname, "../dist/index.html"));
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  const autoUpdater = loadAutoUpdater();
  if (!autoUpdater) return;

  const updaterEvents = autoUpdater as typeof autoUpdater & AutoUpdaterEvents;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  updaterEvents.on("error", (error) => {
    console.error("Auto-update failed", error);
  });

  updaterEvents.on("update-downloaded", async () => {
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Update ready",
      message: "A new version has been downloaded.",
      detail:
        "Restart now to apply it, or continue working and it will install after you close the app.",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  void autoUpdater.checkForUpdatesAndNotify();
  const timer = setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  }, UPDATE_CHECK_INTERVAL_MS);
  timer.unref();
}

app.whenReady().then(() => {
  registerFileIpcHandlers();
  registerUpdateIpcHandlers();

  const iconPath = getAppIconPath();

  if (process.platform === "darwin") {
    app.dock?.setIcon(loadAppIcon(iconPath));
  }

  setupAutoUpdates();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
