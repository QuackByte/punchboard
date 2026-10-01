import { RotateCcw, X } from "lucide-react";
import { UndoOffer } from "./useUndo";

const undoShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘Z" : "Ctrl+Z";

export default function UndoToast({
  offer,
  onUndo,
  onDismiss,
}: {
  offer: UndoOffer | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 print:hidden"
    >
      {offer ? (
        <div
          key={offer.id}
          role="status"
          className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-foreground py-1.5 pl-4 pr-1.5 text-sm text-background shadow-lg animate-in fade-in slide-in-from-bottom-2"
        >
          <span className="mr-2">{offer.message}</span>
          <button
            type="button"
            onClick={onUndo}
            className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 font-medium text-background transition-colors hover:bg-background/15"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
            <kbd className="ml-0.5 font-mono text-[10.5px] opacity-60">
              {undoShortcut}
            </kbd>
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="grid h-7 w-7 place-items-center rounded-lg opacity-60 transition hover:bg-background/15 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
