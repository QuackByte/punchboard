interface FilePickerScreenProps {
  onChooseExisting: () => void;
  onCreateNew: () => void;
}

export default function FilePickerScreen({
  onChooseExisting,
  onCreateNew,
}: FilePickerScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Work Hours Tracker
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Choose where to store your data. The file can live in Dropbox, iCloud,
          or any folder you prefer.
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onCreateNew}
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-500"
          >
            Create new data file
          </button>
          <button
            type="button"
            onClick={onChooseExisting}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
          >
            Open existing data file
          </button>
        </div>
      </div>
    </div>
  );
}
