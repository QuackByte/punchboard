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

export interface TrayStatus {
  ready: boolean;
  canPunchIn: boolean;
  canPunchOut: boolean;
  hasStaleSession: boolean;
  sessionStart: string | null;
  todayKey: string;
  todayEntries: Array<{ start: string; end: string | null }>;
  /** Scheduled hours for today (0 when it isn't a workday). */
  targetHours: number;
  openSession: {
    key: string;
    entry: { start: string; end: string | null };
  } | null;
}

export interface DesktopAPI {
  isElectron: true;
  platform: string;
  onTrayPunchToggle(listener: () => void): () => void;
  onOpenAtLoginChanged(listener: (enabled: boolean) => void): () => void;
  updateTrayStatus(status: TrayStatus): void;
  showMainWindow(): void;
  getTrayStatus(): Promise<TrayStatus>;
  onTrayStatus(listener: (status: TrayStatus) => void): () => void;
  requestTrayPunch(): void;
  openMainFromTray(): void;
  showTrayMenu(): void;
  resizeTray(height: number): void;
  getStartupConfig(): Promise<{ available: boolean; openAtLogin: boolean }>;
  setOpenAtLogin(enabled: boolean): Promise<{
    success: boolean;
    openAtLogin: boolean;
    message?: string;
  }>;
}

declare global {
  interface Window {
    desktop?: DesktopAPI;
    fileAPI?: FileAPI;
    updateAPI?: UpdateAPI;
  }
}
