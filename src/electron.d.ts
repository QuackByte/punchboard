export interface FileAPI {
  isElectron: true;
  getRememberedPath(): Promise<string | null>;
  setRememberedPath(filePath: string): Promise<void>;
  openDialog(): Promise<string | null>;
  saveDialog(): Promise<string | null>;
  readFile(): Promise<string | null>;
  writeFile(data: string): Promise<boolean>;
}

export type UpdateCheckResult =
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string }
  | { status: "available"; version: string }
  | { status: "not-available"; version: string };

export interface UpdateAPI {
  isElectron: true;
  check(): Promise<UpdateCheckResult>;
}

declare global {
  interface Window {
    fileAPI?: FileAPI;
    updateAPI?: UpdateAPI;
  }
}
