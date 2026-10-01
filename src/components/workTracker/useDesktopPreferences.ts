import { useCallback, useEffect, useState } from "react";
import type { DesktopPreferences, ReminderPreferences } from "@/electron.d";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * Desktop-only preferences that live in the app's config.json rather than
 * the data file: the tray icon, open at login, reminders and the global
 * punch shortcut. Everything is a no-op in the browser.
 */
export function useDesktopPreferences() {
  const [startupAvailable, setStartupAvailable] = useState(false);
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [showTray, setShowTray] = useState(true);
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(
    null,
  );
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop?.isElectron) return;
    let active = true;
    const unsubscribe = desktop.onOpenAtLoginChanged(setOpenAtLogin);
    void Promise.all([desktop.getStartupConfig(), desktop.getDesktopPreferences()])
      .then(([config, nextPreferences]) => {
        if (!active) return;
        setStartupAvailable(config.available);
        setOpenAtLogin(config.openAtLogin);
        setShowTray(config.showTray);
        setPreferences(nextPreferences);
      })
      .catch((error: unknown) => {
        if (active) {
          setStartupError(errorMessage(error, "Could not load desktop settings."));
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const changeOpenAtLogin = useCallback(async (enabled: boolean) => {
    if (!window.desktop?.isElectron) return;
    setStartupError(null);
    try {
      const result = await window.desktop.setOpenAtLogin(enabled);
      setOpenAtLogin(result.openAtLogin);
      setStartupError(result.message ?? null);
    } catch (error) {
      setStartupError(errorMessage(error, "Could not update startup setting."));
    }
  }, []);

  const changeShowTray = useCallback(async (enabled: boolean) => {
    if (!window.desktop?.isElectron) return;
    setStartupError(null);
    try {
      const result = await window.desktop.setShowTray(enabled);
      setShowTray(result.showTray);
    } catch (error) {
      setStartupError(errorMessage(error, "Could not update the tray setting."));
    }
  }, []);

  const changeDesktopPreferences = useCallback(
    async (patch: {
      reminders?: Partial<ReminderPreferences>;
      globalShortcut?: boolean;
    }) => {
      if (!window.desktop?.isElectron) return;
      setStartupError(null);
      try {
        setPreferences(await window.desktop.setDesktopPreferences(patch));
      } catch (error) {
        setStartupError(errorMessage(error, "Could not update desktop settings."));
      }
    },
    [],
  );

  return {
    startupAvailable,
    openAtLogin,
    showTray,
    preferences,
    startupError,
    changeOpenAtLogin,
    changeShowTray,
    changeDesktopPreferences,
  };
}
