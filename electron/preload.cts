const { contextBridge, ipcRenderer } = require(
  "electron",
) as typeof import("electron");

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
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
  getStartupConfig: () => ipcRenderer.invoke("startup:get-config"),
  setOpenAtLogin: (enabled: boolean) =>
    ipcRenderer.invoke("startup:set-open-at-login", enabled),
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});

contextBridge.exposeInMainWorld("fileAPI", {
  isElectron: true,
  getRememberedPath: (): Promise<string | null> =>
    ipcRenderer.invoke("file:get-remembered-path"),
  setRememberedPath: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("file:set-remembered-path", filePath),
  openDialog: (): Promise<string | null> =>
    ipcRenderer.invoke("file:open-dialog"),
  saveDialog: (): Promise<string | null> =>
    ipcRenderer.invoke("file:save-dialog"),
  readFile: (): Promise<string | null> => ipcRenderer.invoke("file:read"),
  writeFile: (data: string): Promise<boolean> =>
    ipcRenderer.invoke("file:write", data),
});

contextBridge.exposeInMainWorld("updateAPI", {
  isElectron: true,
  check: () => ipcRenderer.invoke("updates:check"),
});
