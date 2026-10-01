import { useCallback, useEffect, useRef, useState } from "react";

export interface UndoOffer {
  id: number;
  message: string;
}

const UNDO_TIMEOUT_MS = 7000;

/**
 * Keeps the most recent undoable change. Callers pass a function that puts
 * things back; it's offered in a toast for a few seconds, then forgotten.
 */
export function useUndo() {
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const nextId = useRef(1);

  const dismissUndo = useCallback(() => {
    restoreRef.current = null;
    setOffer(null);
  }, []);

  const offerUndo = useCallback((message: string, restore: () => void) => {
    restoreRef.current = restore;
    setOffer({ id: nextId.current++, message });
  }, []);

  const undo = useCallback(() => {
    const restore = restoreRef.current;
    if (!restore) return false;
    restore();
    dismissUndo();
    return true;
  }, [dismissUndo]);

  useEffect(() => {
    if (!offer) return;
    const timer = window.setTimeout(dismissUndo, UNDO_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [offer, dismissUndo]);

  return { undoOffer: offer, offerUndo, undo, dismissUndo };
}
