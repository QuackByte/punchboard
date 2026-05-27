export interface FileAPI {
  isElectron: true;
  getRememberedPath(): Promise<string | null>;
  setRememberedPath(filePath: string): Promise<void>;
  openDialog(): Promise<string | null>;
  saveDialog(): Promise<string | null>;
  readFile(): Promise<string | null>;
  writeFile(data: string): Promise<boolean>;
}

declare global {
  interface Window {
    fileAPI?: FileAPI;
  }
}
