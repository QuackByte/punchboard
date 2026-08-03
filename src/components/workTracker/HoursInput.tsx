import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatDurationOrBlank,
  parseHoursInput,
} from "./utils";

interface HoursInputProps {
  value: number;
  className: string;
  placeholder?: string;
  /** When true, a zero/empty value displays as a blank field instead of "00h". */
  blankWhenZero?: boolean;
  onCommit: (value: number) => void;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
}

export default function HoursInput({
  value,
  className,
  placeholder,
  blankWhenZero = false,
  onCommit,
  onClick,
}: HoursInputProps) {
  const formatValue = (next: number) =>
    blankWhenZero ? formatDurationOrBlank(next) : formatDuration(next);

  const [text, setText] = useState(() => formatValue(value));
  const [isFocused, setIsFocused] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);

  useEffect(() => {
    if (!isFocused && !isInvalid) {
      setText(formatValue(value));
    }
  }, [value, isFocused, isInvalid, blankWhenZero]);

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed && blankWhenZero) {
      setIsInvalid(false);
      onCommit(0);
      return;
    }

    const parsed = parseHoursInput(trimmed);
    if (parsed === null) {
      setIsInvalid(true);
      return;
    }

    setIsInvalid(false);
    onCommit(parsed);
  };

  return (
    <Input
      type="text"
      inputMode="text"
      autoComplete="off"
      className={cn(
        className,
        isInvalid &&
          "border-rose-500 text-rose-600 focus-visible:ring-rose-500 dark:text-rose-400",
      )}
      placeholder={placeholder}
      value={text}
      onClick={onClick}
      onChange={(event) => {
        setText(event.target.value);
        setIsInvalid(false);
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setText(formatValue(value));
          setIsInvalid(false);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
