import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Theme } from "./useTheme";

interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

export default function ThemeToggle({
  theme,
  onThemeChange,
}: ThemeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center rounded-xl border bg-card/80 p-0.5 backdrop-blur"
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => onThemeChange(value)}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-[10px] text-muted-foreground transition-colors hover:text-foreground",
            theme === value && "bg-foreground text-background hover:text-background",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
