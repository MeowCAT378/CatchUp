"use client";

import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";

type DateFilterPickerProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  locale: string;
  clearLabel: string;
  todayLabel: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
  min?: string;
  max?: string;
  className?: string;
};

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const fromIsoDate = (value: string) => new Date(`${value}T12:00:00`);

export function DateFilterPicker({
  id,
  label,
  placeholder,
  value,
  onChange,
  locale,
  clearLabel,
  todayLabel,
  previousMonthLabel,
  nextMonthLabel,
  min,
  max,
  className,
}: DateFilterPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedDate = value ? fromIsoDate(value) : undefined;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(
    () => selectedDate ?? new Date(),
  );
  const today = toIsoDate(new Date());
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(month);
  const formattedValue = value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(selectedDate)
    : placeholder;
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
          new Date(2024, 0, index + 1),
        ),
      ),
    [locale],
  );
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstMonday = new Date(first);
    firstMonday.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(firstMonday);
      day.setDate(firstMonday.getDate() + index);
      return day;
    });
  }, [month]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isDisabled = (date: string) => Boolean((min && date < min) || (max && date > max));
  const selectDate = (date: string) => {
    onChange(date);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const changeMonth = (offset: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  return (
    <div className={`relative ${className ?? ""}`} ref={pickerRef}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ui-text">
        {label}
      </label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMonth(selectedDate ?? new Date());
          setOpen((current) => !current);
        }}
        className="form-input mt-0 flex h-11 min-h-0 items-center justify-between text-left"
      >
        <span className={value ? "text-foreground" : "text-ui-muted"}>{formattedValue}</span>
        <CalendarDaysIcon className="size-4 shrink-0 text-ui-muted" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-1/2 z-30 mt-2 w-80 max-w-[calc(100vw-0.5rem)] translate-x-[calc(-50%+0.25rem)] rounded-ui-control border border-ui-border bg-ui-surface-solid py-1 shadow-ui-overlay"
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <button type="button" className="inline-flex size-11 items-center justify-center rounded-md text-ui-muted hover:bg-ui-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus" onClick={() => changeMonth(-1)} aria-label={previousMonthLabel}>
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </button>
            <strong className="text-sm font-semibold text-foreground">{monthLabel}</strong>
            <button type="button" className="inline-flex size-11 items-center justify-center rounded-md text-ui-muted hover:bg-ui-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus" onClick={() => changeMonth(1)} aria-label={nextMonthLabel}>
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs">
            {weekdays.map((weekday) => <span key={weekday} className="py-1 font-medium text-ui-muted">{weekday}</span>)}
            {days.map((day) => {
              const date = toIsoDate(day);
              const selected = date === value;
              const outsideMonth = day.getMonth() !== month.getMonth();
              const disabled = isDisabled(date);
              const dayClassName = selected
                ? "bg-ui-primary font-semibold text-white hover:bg-ui-primary-hover"
                : disabled
                  ? "cursor-not-allowed text-ui-muted/50"
                  : outsideMonth
                    ? "text-ui-muted/70 hover:bg-ui-surface-muted"
                    : date === today
                      ? "font-semibold text-ui-primary ring-1 ring-sky-300 hover:bg-ui-primary-soft"
                      : "text-foreground hover:bg-ui-surface-muted";
              return (
                <button
                  key={date}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(day)}
                  onClick={() => selectDate(date)}
                  className={`aspect-square min-h-11 rounded-md text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus ${dayClassName}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mx-2 mt-3 flex items-center justify-between border-t border-ui-border pt-2 text-sm font-medium">
            <button type="button" className="min-h-11 text-ui-muted hover:text-ui-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus" onClick={() => selectDate("")}>{clearLabel}</button>
            <button type="button" disabled={isDisabled(today)} className="min-h-11 text-ui-primary hover:text-ui-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus disabled:text-ui-muted/50" onClick={() => selectDate(today)}>{todayLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
