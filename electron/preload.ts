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
  updateTrayStatus: (status: unknown) => {
    ipcRenderer.send("tray:update-status", status);
  },
  showMainWindow: () => {
    ipcRenderer.send("window:show");
  },
  getStartupConfig: () => ipcRenderer.invoke("startup:get-config"),
  setOpenAtLogin: (enabled: boolean) =>
    ipcRenderer.invoke("startup:set-open-at-login", enabled),
});
