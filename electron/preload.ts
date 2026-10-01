import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  onTrayPunchToggle: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on("tray:punch-toggle", handler);
    return () => ipcRenderer.removeListener("tray:punch-toggle", handler);
  },
  onOpenAtLoginChanged: (listener: (enabled: boolean) => void) => {
    const handler = (_event: unknown, enabled: boolean) => listener(enabled);
    ipcRenderer.on("startup:changed", handler);
    return () => ipcRenderer.removeListener("startup:changed", handler);
  },
  updateTrayStatus: (status: unknown) => {
    ipcRenderer.send("tray:update-status", status);
  },
  showMainWindow: () => {
    ipcRenderer.send("window:show");
  },
  getTrayStatus: () => ipcRenderer.invoke("tray:get-status"),
  onTrayStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown) => listener(status);
    ipcRenderer.on("tray:status", handler);
    return () => ipcRenderer.removeListener("tray:status", handler);
  },
  requestTrayPunch: () => {
    ipcRenderer.send("tray:punch");
  },
  openMainFromTray: () => {
    ipcRenderer.send("tray:open-main");
  },
  showTrayMenu: () => {
    ipcRenderer.send("tray:show-menu");
  },
  resizeTray: (height: number) => {
    ipcRenderer.send("tray:resize", height);
  },
  getDesktopPreferences: () => ipcRenderer.invoke("desktop:get-preferences"),
  setDesktopPreferences: (patch: unknown) =>
    ipcRenderer.invoke("desktop:set-preferences", patch),
  setShowTray: (enabled: boolean) =>
    ipcRenderer.invoke("tray:set-enabled", enabled),
  onOpenSettings: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on("settings:open", handler);
    return () => ipcRenderer.removeListener("settings:open", handler);
  },
  getStartupConfig: () => ipcRenderer.invoke("startup:get-config"),
  setOpenAtLogin: (enabled: boolean) =>
    ipcRenderer.invoke("startup:set-open-at-login", enabled),
});
