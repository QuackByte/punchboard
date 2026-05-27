import { app, BrowserWindow, dialog, ipcMain, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

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
      defaultPath: "work-hours-tracker.json",
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
    ? path.join(__dirname, "../public/work_hours_tracker_icon.svg")
    : path.join(process.cwd(), "public/work_hours_tracker_icon.svg");
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
    title: "Work Hours Tracker",
    icon: iconImage,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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

app.whenReady().then(() => {
  registerFileIpcHandlers();

  const iconPath = getAppIconPath();

  if (process.platform === "darwin") {
    app.dock?.setIcon(loadAppIcon(iconPath));
  }

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
