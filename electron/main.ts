import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
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

type TimeEntry = { start: string; end: string | null };

type TrayStatus = {
  ready: boolean;
  canPunchIn: boolean;
  canPunchOut: boolean;
  hasStaleSession: boolean;
  sessionStart: string | null;
  /** Today's sessions and schedule, so the tray popover can mirror the punch clock. */
  todayKey: string;
  todayEntries: TimeEntry[];
  targetHours: number;
  openSession: { key: string; entry: TimeEntry } | null;
};

const TRAY_WINDOW_WIDTH = 340;
const PUNCH_SHORTCUT = "CommandOrControl+Alt+P";
/** How long after the start time the punch-in nudge may still fire. */
const START_NUDGE_WINDOW_MINUTES = 120;

let mainWindow: BrowserWindow | null = null;
let trayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayTitleTimer: NodeJS.Timeout | null = null;
let isQuitting = false;
let reminderTimer: NodeJS.Timeout | null = null;
/** Reminders already shown, as "kind:dayKey", so each fires once a day. */
const firedReminders = new Set<string>();
let shortcutRegistered = false;
let trayStatus: TrayStatus = {
  ready: false,
  canPunchIn: false,
  canPunchOut: false,
  hasStaleSession: false,
  sessionStart: null,
  todayKey: "",
  todayEntries: [],
  targetHours: 0,
  openSession: null,
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

type ReminderConfig = {
  /** "Still on the clock?" once today's scheduled hours are done. */
  overtime: boolean;
  /** "HH:MM" to nudge a punch-in on workdays, or null for off. */
  startTime: string | null;
};

type AppConfig = {
  dataFilePath?: string;
  /** Whether the menu bar / tray icon is shown. Defaults to on. */
  showTray?: boolean;
  reminders?: Partial<ReminderConfig>;
  /** Global ⌥⌘P / Ctrl+Alt+P punch shortcut. Defaults to on. */
  globalShortcut?: boolean;
};

type DesktopPreferences = {
  reminders: ReminderConfig;
  globalShortcut: boolean;
  /** False when another app already owns the shortcut. */
  globalShortcutActive: boolean;
  notificationsSupported: boolean;
};

function readAppConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(APP_CONFIG_PATH, "utf8");
    return JSON.parse(raw) as AppConfig;
  } catch {
    return {};
  }
}

function isTrayEnabled() {
  return readAppConfig().showTray !== false;
}

function getReminderConfig(config = readAppConfig()): ReminderConfig {
  const startTime = config.reminders?.startTime;
  return {
    overtime: config.reminders?.overtime !== false,
    startTime:
      typeof startTime === "string" && /^\d{2}:\d{2}$/.test(startTime)
        ? startTime
        : null,
  };
}

function getDesktopPreferences(): DesktopPreferences {
  const config = readAppConfig();
  return {
    reminders: getReminderConfig(config),
    globalShortcut: config.globalShortcut !== false,
    globalShortcutActive: shortcutRegistered,
    notificationsSupported: Notification.isSupported(),
  };
}

function setDesktopPreferences(patch: {
  reminders?: Partial<ReminderConfig>;
  globalShortcut?: boolean;
}) {
  const config = readAppConfig();
  const next: AppConfig = { ...config };
  if (patch.reminders) {
    next.reminders = {
      ...getReminderConfig(config),
      ...(typeof patch.reminders.overtime === "boolean"
        ? { overtime: patch.reminders.overtime }
        : {}),
      ...("startTime" in patch.reminders
        ? { startTime: patch.reminders.startTime ?? null }
        : {}),
    };
  }
  if (typeof patch.globalShortcut === "boolean") {
    next.globalShortcut = patch.globalShortcut;
  }
  writeAppConfig(next);
  applyGlobalShortcut();
  checkReminders();
  return getDesktopPreferences();
}

function writeAppConfig(config: AppConfig) {
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
    showTray: isTrayEnabled(),
  };
}

function applyLoginItemSettings(enabled: boolean) {
  // Starting hidden only makes sense when the tray icon is there to reopen
  // the window from.
  const startHidden = enabled && isTrayEnabled();
  app.setLoginItemSettings({
    openAtLogin: enabled,
    ...(process.platform === "darwin"
      ? { openAsHidden: startHidden }
      : { args: startHidden ? ["--hidden"] : [] }),
  });
}

function setShowTray(enabled: boolean) {
  writeAppConfig({ ...readAppConfig(), showTray: enabled });
  if (enabled) {
    createTray();
  } else {
    destroyTray();
  }
  if (canConfigureLoginItem() && app.getLoginItemSettings().openAtLogin) {
    applyLoginItemSettings(true);
  }
  return { showTray: enabled };
}

function openSettings() {
  showMainWindow();
  mainWindow?.webContents.send("settings:open");
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
    applyLoginItemSettings(enabled);
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
    trayWindow?.hide();
    showMainWindow();
    return;
  }
  mainWindow.webContents.send("tray:punch-toggle");
}

function buildTrayMenu() {
  const canPunch = trayStatus.canPunchIn || trayStatus.canPunchOut;
  const punchLabel = trayStatus.hasStaleSession
    ? "Open Punchboard to resolve open session"
    : trayStatus.canPunchOut
      ? `Punch out${trayStatus.sessionStart ? ` · since ${trayStatus.sessionStart}` : ""}`
      : trayStatus.canPunchIn
        ? "Punch in"
        : "Punch clock unavailable";

  return Menu.buildFromTemplate([
    {
      label: punchLabel,
      enabled: canPunch,
      click: sendTrayPunchToggle,
    },
    { type: "separator" },
    { label: "Open Punchboard", click: showMainWindow },
    { label: "Settings…", click: openSettings },
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
  ]);
}

/** Minutes elapsed since an "HH:MM" start today (wrapping past midnight). */
function minutesSince(start: string) {
  const [hours, minutes] = start.split(":").map(Number);
  const now = new Date();
  const elapsed =
    now.getHours() * 60 + now.getMinutes() - (hours * 60 + minutes);
  return elapsed >= 0 ? elapsed : elapsed + 1440;
}

/**
 * On macOS the elapsed time of a running session sits next to the menu bar
 * icon, like a stopwatch. Other platforms show it in the tooltip.
 */
function updateTrayTitle() {
  if (!tray) return;

  const running = trayStatus.canPunchOut && trayStatus.sessionStart;
  const elapsed = running ? minutesSince(trayStatus.sessionStart!) : 0;
  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  if (process.platform === "darwin") {
    tray.setTitle(running ? ` ${elapsedLabel}` : "", {
      fontType: "monospacedDigit",
    });
  }
  tray.setToolTip(
    running
      ? `Punchboard · On the clock since ${trayStatus.sessionStart} (${elapsedLabel})`
      : "Punchboard",
  );
}

function updateTrayMenu() {
  if (!tray) return;

  // macOS and Windows open the popover on click and the menu on right-click;
  // Linux trays don't reliably report clicks, so they keep a plain menu.
  if (process.platform === "linux") {
    tray.setContextMenu(buildTrayMenu());
  }

  updateTrayTitle();
  if (trayStatus.canPunchOut && !trayTitleTimer) {
    trayTitleTimer = setInterval(updateTrayTitle, 15_000);
  } else if (!trayStatus.canPunchOut && trayTitleTimer) {
    clearInterval(trayTitleTimer);
    trayTitleTimer = null;
  }

  if (trayWindow && !trayWindow.isDestroyed()) {
    trayWindow.webContents.send("tray:status", trayStatus);
  }
}

function getTrayIconPath(fileName: string) {
  return app.isPackaged
    ? path.join(__dirname, "../public/tray", fileName)
    : path.join(process.cwd(), "public/tray", fileName);
}

function loadTrayIcon() {
  if (process.platform === "darwin") {
    // Template images are tinted by macOS, so they match light and dark
    // menu bars (and the highlighted state) automatically.
    const icon = nativeImage.createFromPath(
      getTrayIconPath("trayTemplate.png"),
    );
    icon.setTemplateImage(true);
    return icon;
  }

  const icon = nativeImage.createEmpty();
  for (const [scaleFactor, fileName] of [
    [1, "tray.png"],
    [2, "tray@2x.png"],
    [3, "tray@3x.png"],
  ] as const) {
    icon.addRepresentation({
      scaleFactor,
      buffer: fs.readFileSync(getTrayIconPath(fileName)),
    });
  }
  return icon;
}

function createTrayWindow() {
  if (trayWindow && !trayWindow.isDestroyed()) return trayWindow;

  const window = new BrowserWindow({
    width: TRAY_WINDOW_WIDTH,
    height: 360,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  trayWindow = window;

  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.on("blur", () => window.hide());
  window.on("closed", () => {
    if (trayWindow === window) trayWindow = null;
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    window.loadURL(`${rendererUrl}#tray`);
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"), {
      hash: "tray",
    });
  }
  return window;
}

/** Places the popover under the menu bar icon (or above a bottom taskbar). */
function positionTrayWindow(window: BrowserWindow) {
  if (!tray) return;

  const trayBounds = tray.getBounds();
  const windowBounds = window.getBounds();
  const { workArea } = screen.getDisplayNearestPoint({
    x: Math.round(trayBounds.x + trayBounds.width / 2),
    y: Math.round(trayBounds.y + trayBounds.height / 2),
  });

  const trayIsAtBottom = trayBounds.y > workArea.y + workArea.height / 2;
  const x = Math.round(
    Math.min(
      Math.max(
        trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2,
        workArea.x + 8,
      ),
      workArea.x + workArea.width - windowBounds.width - 8,
    ),
  );
  const y = trayIsAtBottom
    ? Math.round(trayBounds.y - windowBounds.height - 6)
    : Math.round(Math.max(trayBounds.y + trayBounds.height + 6, workArea.y + 6));

  window.setPosition(x, y, false);
}

function toggleTrayWindow() {
  const window = createTrayWindow();
  if (window.isVisible()) {
    window.hide();
    return;
  }

  const show = () => {
    positionTrayWindow(window);
    window.show();
    window.focus();
    window.webContents.send("tray:status", trayStatus);
  };
  if (window.webContents.isLoading()) {
    window.webContents.once("did-finish-load", show);
  } else {
    show();
  }
}

function destroyTray() {
  if (trayTitleTimer) {
    clearInterval(trayTitleTimer);
    trayTitleTimer = null;
  }
  if (trayWindow && !trayWindow.isDestroyed()) trayWindow.destroy();
  trayWindow = null;
  tray?.destroy();
  tray = null;
}

function clockMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutes on the clock today, counting a running session up to now. */
function todayClockedMinutes() {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return trayStatus.todayEntries.reduce((total, entry) => {
    const start = clockMinutes(entry.start);
    const end = entry.end === null ? nowMinutes : clockMinutes(entry.end);
    return total + (end >= start ? end - start : end + 1440 - start);
  }, 0);
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, "0")}m`;
}

function notify(options: {
  title: string;
  body: string;
  action?: { label: string; onAction: () => void };
}) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: options.title,
    body: options.body,
    silent: false,
    // Action buttons only exist on macOS; elsewhere a click does the same.
    actions: options.action
      ? [{ type: "button", text: options.action.label }]
      : [],
  });
  notification.on("action", () => options.action?.onAction());
  notification.on("click", () => {
    if (options.action && process.platform !== "darwin") {
      options.action.onAction();
    } else {
      showMainWindow();
    }
  });
  notification.show();
}

/**
 * Runs every minute against the status the main window last reported:
 * a nudge to punch in at the configured start time on workdays, and a
 * "still on the clock?" once today's scheduled hours are done.
 */
function checkReminders() {
  if (!trayStatus.ready || !trayStatus.todayKey) return;

  const reminders = getReminderConfig();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dayKey = trayStatus.todayKey;
  const isWorkday = trayStatus.targetHours > 0;

  if (reminders.startTime && isWorkday) {
    const firedKey = `start:${dayKey}`;
    const sinceStart = nowMinutes - clockMinutes(reminders.startTime);
    if (
      !firedReminders.has(firedKey) &&
      sinceStart >= 0 &&
      sinceStart <= START_NUDGE_WINDOW_MINUTES &&
      trayStatus.todayEntries.length === 0 &&
      trayStatus.canPunchIn
    ) {
      firedReminders.add(firedKey);
      notify({
        title: "Time to punch in?",
        body: `It's past ${reminders.startTime} and today's card is empty.`,
        action: { label: "Punch in", onAction: sendTrayPunchToggle },
      });
    }
  }

  if (reminders.overtime && trayStatus.canPunchOut && isWorkday) {
    const firedKey = `overtime:${dayKey}`;
    const clocked = todayClockedMinutes();
    if (
      !firedReminders.has(firedKey) &&
      clocked >= trayStatus.targetHours * 60
    ) {
      firedReminders.add(firedKey);
      notify({
        title: "Still on the clock?",
        body: `You've clocked ${formatMinutes(clocked)} today, past the scheduled ${formatMinutes(Math.round(trayStatus.targetHours * 60))}. Punched in since ${trayStatus.sessionStart}.`,
        action: { label: "Punch out", onAction: sendTrayPunchToggle },
      });
    }
  }
}

function startReminderTimer() {
  if (reminderTimer) return;
  reminderTimer = setInterval(checkReminders, 60_000);
  reminderTimer.unref();
}

/** Toggles the punch clock from anywhere and confirms with a notification. */
function globalPunch() {
  if (!trayStatus.ready || trayStatus.hasStaleSession) {
    showMainWindow();
    return;
  }
  const wasRunning = trayStatus.canPunchOut;
  const clocked = todayClockedMinutes();
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  sendTrayPunchToggle();
  notify({
    title: wasRunning ? `Punched out at ${time}` : `Punched in at ${time}`,
    body: wasRunning
      ? `${formatMinutes(clocked)} on the clock today.`
      : "The clock is running. Press the shortcut again to punch out.",
  });
}

function applyGlobalShortcut() {
  const wanted = readAppConfig().globalShortcut !== false;
  if (wanted && !shortcutRegistered) {
    try {
      shortcutRegistered = globalShortcut.register(PUNCH_SHORTCUT, globalPunch);
    } catch (error) {
      console.error("Could not register the punch shortcut", error);
      shortcutRegistered = false;
    }
  } else if (!wanted && shortcutRegistered) {
    globalShortcut.unregister(PUNCH_SHORTCUT);
    shortcutRegistered = false;
  }
}

/** macOS app menu, so Punchboard gets the standard ⌘, for Settings. */
function setupApplicationMenu() {
  if (process.platform !== "darwin") return;

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          {
            label: "Settings…",
            accelerator: "CmdOrCtrl+,",
            click: openSettings,
          },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
}

function createTray() {
  if (tray) return;

  try {
    tray = new Tray(loadTrayIcon());
    tray.setIgnoreDoubleClickEvents(true);
    if (process.platform !== "linux") {
      tray.on("click", toggleTrayWindow);
      tray.on("right-click", () => {
        trayWindow?.hide();
        tray?.popUpContextMenu(buildTrayMenu());
      });
      // Load the popover up front so the first click opens instantly.
      createTrayWindow();
    }
    updateTrayMenu();

    if (!app.isPackaged) {
      // Lets automated checks open the popover without a real tray click.
      (globalThis as { __punchboardToggleTray?: () => void }).__punchboardToggleTray =
        toggleTrayWindow;
    }
  } catch (error) {
    console.error("Could not create the Punchboard tray icon", error);
  }
}

function registerTrayIpcHandlers() {
  ipcMain.on("tray:update-status", (event, status: TrayStatus) => {
    if (event.sender !== mainWindow?.webContents) return;
    trayStatus = status;
    updateTrayMenu();
    checkReminders();
  });

  ipcMain.handle("tray:get-status", () => trayStatus);
  ipcMain.on("tray:punch", (event) => {
    if (event.sender !== trayWindow?.webContents) return;
    sendTrayPunchToggle();
  });
  ipcMain.on("tray:open-main", () => {
    trayWindow?.hide();
    showMainWindow();
  });
  ipcMain.on("tray:show-menu", () => {
    trayWindow?.hide();
    tray?.popUpContextMenu(buildTrayMenu());
  });
  ipcMain.on("tray:resize", (event, height: unknown) => {
    if (event.sender !== trayWindow?.webContents) return;
    if (typeof height !== "number" || !Number.isFinite(height)) return;
    const nextHeight = Math.min(Math.max(Math.ceil(height), 200), 640);
    trayWindow.setSize(TRAY_WINDOW_WIDTH, nextHeight, false);
    if (trayWindow.isVisible()) positionTrayWindow(trayWindow);
  });

  ipcMain.on("window:show", showMainWindow);
  ipcMain.handle("startup:get-config", getStartupConfig);
  ipcMain.handle("desktop:get-preferences", getDesktopPreferences);
  ipcMain.handle("desktop:set-preferences", (_event, patch: unknown) =>
    setDesktopPreferences(
      typeof patch === "object" && patch !== null
        ? (patch as Parameters<typeof setDesktopPreferences>[0])
        : {},
    ),
  );
  ipcMain.handle("tray:set-enabled", (_event, enabled: unknown) =>
    setShowTray(enabled === true),
  );
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

  setupApplicationMenu();
  if (isTrayEnabled()) createTray();
  applyGlobalShortcut();
  startReminderTimer();
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

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (tray && !isQuitting) return;
  if (process.platform !== "darwin") {
    app.quit();
  }
});
