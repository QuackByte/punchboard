import { app, BrowserWindow, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
