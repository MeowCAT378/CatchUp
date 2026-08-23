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
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-700">
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
        <span className={value ? "text-slate-900" : "text-slate-600"}>{formattedValue}</span>
        <CalendarDaysIcon className="size-4 shrink-0 text-slate-600" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 z-30 mt-2 w-[calc(100vw-2.5rem)] rounded-lg border border-neutral-200 bg-white p-3 shadow-md sm:w-[19rem]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="rounded-md p-1 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" onClick={() => changeMonth(-1)} aria-label={previousMonthLabel}>
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </button>
            <strong className="text-sm font-semibold text-[#1d1d1f]">{monthLabel}</strong>
            <button type="button" className="rounded-md p-1 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" onClick={() => changeMonth(1)} aria-label={nextMonthLabel}>
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {weekdays.map((weekday) => <span key={weekday} className="py-1 font-medium text-slate-500">{weekday}</span>)}
            {days.map((day) => {
              const date = toIsoDate(day);
              const selected = date === value;
              const outsideMonth = day.getMonth() !== month.getMonth();
              const disabled = isDisabled(date);
              const dayClassName = selected
                ? "bg-sky-700 font-semibold text-white hover:bg-sky-800"
                : disabled
                  ? "cursor-not-allowed text-slate-300"
                  : outsideMonth
                    ? "text-slate-400 hover:bg-slate-100"
                    : date === today
                      ? "font-semibold text-sky-700 ring-1 ring-sky-300 hover:bg-sky-50"
                      : "text-[#1d1d1f] hover:bg-slate-100";
              return (
                <button
                  key={date}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(day)}
                  onClick={() => selectDate(date)}
                  className={`aspect-square rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${dayClassName}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm font-medium">
            <button type="button" className="text-slate-600 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" onClick={() => selectDate("")}>{clearLabel}</button>
            <button type="button" disabled={isDisabled(today)} className="text-sky-700 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:text-slate-300" onClick={() => selectDate(today)}>{todayLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
