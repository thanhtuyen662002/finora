"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  displayToIsoDate,
  isoToDisplayDate,
  maskDisplayDateInput,
} from "@/lib/dates/display-date";

export interface DateInputProps {
  id?: string;
  /** Stored value: ISO calendar date "yyyy-MM-dd", or "" when empty. */
  value: string;
  /** Receives the ISO value ("" when cleared), shaped like an input change event. */
  onChange: (event: { target: { value: string } }) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  "aria-describedby"?: string;
}

const INVALID_MESSAGE = "Nhập ngày theo dạng dd/MM/yyyy, ví dụ 09/11/2026.";

/**
 * Date field that always shows and accepts dd/MM/yyyy, independent of the
 * browser language, while keeping the yyyy-MM-dd value the app stores.
 * The calendar button opens the browser's native date picker.
 */
export function DateInput({
  id,
  value,
  onChange,
  required,
  disabled,
  min,
  max,
  className,
  "aria-describedby": ariaDescribedBy,
}: DateInputProps) {
  const [text, setText] = React.useState(() => isoToDisplayDate(value));
  const [syncedValue, setSyncedValue] = React.useState(value);
  const textRef = React.useRef<HTMLInputElement>(null);
  const pickerRef = React.useRef<HTMLInputElement>(null);

  // Follow external value changes (form reset, AI draft fill, edit dialogs)
  // by adjusting state during render, as recommended over an effect.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (displayToIsoDate(text) !== (value || null)) {
      setText(isoToDisplayDate(value));
    }
  }

  const setValidity = (message: string) => {
    textRef.current?.setCustomValidity(message);
  };

  const emit = (iso: string) => onChange({ target: { value: iso } });

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDisplayDateInput(event.target.value);
    setText(masked);

    if (masked === "") {
      setValidity("");
      emit("");
      return;
    }

    const iso = displayToIsoDate(masked);
    if (!iso) {
      setValidity(INVALID_MESSAGE);
      return;
    }
    if ((min && iso < min) || (max && iso > max)) {
      setValidity(`Ngày phải nằm trong khoảng ${isoToDisplayDate(min) || "…"} – ${isoToDisplayDate(max) || "…"}.`);
      return;
    }
    setValidity("");
    emit(iso);
  };

  const handleBlur = () => {
    // Incomplete typing falls back to the last valid date instead of lingering.
    if (text !== "" && !displayToIsoDate(text)) {
      setText(isoToDisplayDate(value));
      setValidity("");
    }
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker || disabled) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  };

  const handlePickerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const iso = event.target.value;
    setText(isoToDisplayDate(iso));
    setValidity("");
    emit(iso);
  };

  return (
    <div className={cn("relative", className)}>
      <input
        ref={textRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/MM/yyyy"
        maxLength={10}
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        className="flex h-10 w-full rounded-md border border-input bg-background py-2 pl-3 pr-10 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Chọn ngày từ lịch"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      {/* Native picker kept off-screen; only its calendar popup is used. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ""}
        min={min}
        max={max}
        onChange={handlePickerChange}
        disabled={disabled}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}
