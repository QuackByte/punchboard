const { contextBridge, ipcRenderer } = require(
  "electron",
) as typeof import("electron");

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
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
