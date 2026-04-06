import { Theme } from "./useTheme";

interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const options: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ThemeToggle({
  theme,
  onThemeChange,
}: ThemeToggleProps) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onThemeChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            theme === option.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
