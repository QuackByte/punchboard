import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
} from "electron";
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

type TrayStatus = {
  ready: boolean;
  canPunchIn: boolean;
  canPunchOut: boolean;
  hasStaleSession: boolean;
  sessionStart: string | null;
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let trayStatus: TrayStatus = {
  ready: false,
  canPunchIn: false,
  canPunchOut: false,
  hasStaleSession: false,
  sessionStart: null,
};

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

function canConfigureLoginItem() {
  return (
    app.isPackaged &&
    (process.platform === "darwin" || process.platform === "win32")
  );
}

function getStartupConfig() {
  return {
    available: canConfigureLoginItem(),
    openAtLogin: canConfigureLoginItem()
      ? app.getLoginItemSettings().openAtLogin
      : false,
  };
}

function setOpenAtLogin(enabled: boolean) {
  if (!canConfigureLoginItem()) {
    return {
      success: false,
      openAtLogin: false,
      message: "Open at login is available in the installed desktop app.",
    };
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      ...(process.platform === "darwin"
        ? { openAsHidden: enabled }
        : { args: enabled ? ["--hidden"] : [] }),
    });
    const openAtLogin = app.getLoginItemSettings().openAtLogin;
    updateTrayMenu();
    mainWindow?.webContents.send("startup:changed", openAtLogin);
    return { success: openAtLogin === enabled, openAtLogin };
  } catch (error) {
    return {
      success: false,
      openAtLogin: app.getLoginItemSettings().openAtLogin,
      message:
        error instanceof Error ? error.message : "Could not update login settings.",
    };
  }
}

function showMainWindow() {
  const window =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : createMainWindow(true);
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function sendTrayPunchToggle() {
  if (
    !trayStatus.ready ||
    trayStatus.hasStaleSession ||
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    showMainWindow();
    return;
  }
  mainWindow.webContents.send("tray:punch-toggle");
}

function updateTrayMenu() {
  if (!tray) return;

  const canPunch = trayStatus.canPunchIn || trayStatus.canPunchOut;
  const punchLabel = trayStatus.hasStaleSession
    ? "Open Punchboard to resolve open session"
    : trayStatus.canPunchOut
      ? `Punch out${trayStatus.sessionStart ? ` · since ${trayStatus.sessionStart}` : ""}`
      : trayStatus.canPunchIn
        ? "Punch in"
        : "Punch clock unavailable";

  tray.setToolTip(
    trayStatus.canPunchOut
      ? `Punchboard · On the clock since ${trayStatus.sessionStart ?? "now"}`
      : "Punchboard",
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: punchLabel,
        enabled: canPunch,
        click: sendTrayPunchToggle,
      },
      { type: "separator" },
      { label: "Open Punchboard", click: showMainWindow },
      {
        label: "Open at Login",
        type: "checkbox",
        checked: getStartupConfig().openAtLogin,
        enabled: canConfigureLoginItem(),
        click: (item) => {
          setOpenAtLogin(item.checked);
        },
      },
      { type: "separator" },
      {
        label: "Quit Punchboard",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function createTray() {
  if (tray) return;

  try {
    const trayIcon =
      process.platform === "darwin"
        ? nativeImage
            .createFromDataURL(
              `data:image/svg+xml;base64,${Buffer.from(
                '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="#000" stroke-width="1.7"/><path d="M9 4.5v4.8l3.1 1.8" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"/></svg>',
              ).toString("base64")}`,
            )
            .resize({ width: 18, height: 18 })
        : loadAppIcon(getAppIconPath()).resize({ width: 16, height: 16 });
    if (process.platform === "darwin") trayIcon.setTemplateImage(true);
    tray = new Tray(trayIcon);
    tray.on("double-click", showMainWindow);
    updateTrayMenu();
  } catch (error) {
    console.error("Could not create the Punchboard tray icon", error);
  }
}

function registerTrayIpcHandlers() {
  ipcMain.on("tray:update-status", (event, status: TrayStatus) => {
    if (event.sender !== mainWindow?.webContents) return;
    trayStatus = status;
    updateTrayMenu();
  });

  ipcMain.on("window:show", showMainWindow);
  ipcMain.handle("startup:get-config", getStartupConfig);
  ipcMain.handle("startup:set-open-at-login", (_event, enabled: unknown) =>
    setOpenAtLogin(enabled === true),
  );
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

function createMainWindow(showOnReady = true) {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  const iconPath = getAppIconPath();
  const iconImage = loadAppIcon(iconPath);

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    backgroundColor: "#e2e8f0",
    title: "Punchboard",
    icon: iconImage,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = window;

  window.on("close", (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.once("ready-to-show", () => {
    if (showOnReady) window.show();
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    window.loadURL(rendererUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return window;
  }

  window.loadFile(path.join(__dirname, "../dist/index.html"));
  return window;
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
  registerTrayIpcHandlers();

  const iconPath = getAppIconPath();

  if (process.platform === "darwin") {
    app.dock?.setIcon(loadAppIcon(iconPath));
  }

  createTray();
  setupAutoUpdates();
  const wasOpenedAtLogin = canConfigureLoginItem()
    ? app.getLoginItemSettings().wasOpenedAtLogin
    : false;
  const shouldStartHidden =
    tray !== null &&
    (process.argv.includes("--hidden") || wasOpenedAtLogin);
  createMainWindow(!shouldStartHidden);

  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (tray && !isQuitting) return;
  if (process.platform !== "darwin") {
    app.quit();
  }
});
