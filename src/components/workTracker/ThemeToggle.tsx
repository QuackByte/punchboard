import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Tabs
      value={theme}
      onValueChange={(value) => onThemeChange(value as Theme)}
    >
      <TabsList className="h-8 p-0.5">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="px-2.5 py-1 text-xs"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
