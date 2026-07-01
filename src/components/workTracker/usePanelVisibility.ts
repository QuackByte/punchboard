import { useState } from "react";

const STORAGE_KEY = "work-tracker-config-panel-visible";

function getStoredVisibility(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true" || stored === "false") {
      return stored === "true";
    }
  } catch {
    // ignore storage errors
  }
  return true;
}

export function usePanelVisibility() {
  const [showConfig, setShowConfigState] = useState<boolean>(
    getStoredVisibility,
  );

  const setShowConfig = (next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore storage errors
    }
    setShowConfigState(next);
  };

  return { showConfig, setShowConfig };
}
