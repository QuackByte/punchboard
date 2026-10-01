const DATABASE_NAME = "punchboard-browser-files";
const DATABASE_VERSION = 1;
const STORE_NAME = "handles";
const DATA_FILE_HANDLE_KEY = "data-file";

export interface BrowserDataFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
    abort?(): Promise<void>;
  }>;
  queryPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
}

interface BrowserFilePickerWindow extends Window {
  showOpenFilePicker?: (options: {
    multiple?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<BrowserDataFileHandle[]>;
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<BrowserDataFileHandle>;
}

const dataFileType = {
  description: "Punchboard data file",
  accept: { "application/json": [".json"] },
};

export function supportsBrowserDataFiles() {
  if (!globalThis.isSecureContext || typeof indexedDB === "undefined") {
    return false;
  }

  const pickerWindow = window as BrowserFilePickerWindow;
  return (
    typeof pickerWindow.showOpenFilePicker === "function" &&
    typeof pickerWindow.showSaveFilePicker === "function"
  );
}

export async function chooseExistingDataFile() {
  const pickerWindow = window as BrowserFilePickerWindow;
  if (!pickerWindow.showOpenFilePicker) {
    throw new Error("Opening shared files is not supported in this browser.");
  }

  const [handle] = await pickerWindow.showOpenFilePicker({
    multiple: false,
    types: [dataFileType],
  });
  return handle ?? null;
}

export async function chooseNewOrExistingDataFile() {
  const pickerWindow = window as BrowserFilePickerWindow;
  if (!pickerWindow.showSaveFilePicker) {
    throw new Error("Saving shared files is not supported in this browser.");
  }

  return pickerWindow.showSaveFilePicker({
    suggestedName: "punchboard.json",
    types: [dataFileType],
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open browser storage."));
  });
}

export async function getRememberedDataFile() {
  const database = await openDatabase();
  try {
    return await new Promise<BrowserDataFileHandle | null>((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(DATA_FILE_HANDLE_KEY);
      request.onsuccess = () =>
        resolve((request.result as BrowserDataFileHandle | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Could not load the remembered file."));
    });
  } finally {
    database.close();
  }
}

export async function rememberDataFile(handle: BrowserDataFileHandle) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(handle, DATA_FILE_HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not remember the selected file."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not remember the selected file."));
    });
  } finally {
    database.close();
  }
}

export async function forgetDataFile() {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(DATA_FILE_HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not disconnect the selected file."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not disconnect the selected file."));
    });
  } finally {
    database.close();
  }
}

export async function hasDataFilePermission(
  handle: BrowserDataFileHandle,
  request = false,
) {
  if (!handle.queryPermission || !handle.requestPermission) {
    return true;
  }

  const descriptor = { mode: "readwrite" as const };
  if ((await handle.queryPermission(descriptor)) === "granted") {
    return true;
  }

  return request && (await handle.requestPermission(descriptor)) === "granted";
}

export async function readDataFile(handle: BrowserDataFileHandle) {
  return (await handle.getFile()).text();
}

export async function writeDataFile(handle: BrowserDataFileHandle, contents: string) {
  const writable = await handle.createWritable();
  try {
    await writable.write(contents);
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
}
