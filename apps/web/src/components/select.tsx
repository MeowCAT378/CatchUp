"use client";

import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  id: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  labelId?: string;
  className?: string;
};

/**
 * Controlled: <Select value={value} onValueChange={setValue} options={options} />
 * Uncontrolled/form: add defaultValue and name. Use searchable for long lists,
 * disabled for read-only fields, and invalid for existing validation-error styling.
 */
export function Select({
  id,
  options,
  value,
  defaultValue = "",
  onValueChange,
  name,
  disabled = false,
  invalid = false,
  searchable = false,
  searchPlaceholder,
  emptyLabel = "—",
  labelId,
  className,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedValue = value ?? uncontrolledValue;
  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? options.filter((option) =>
          option.label.toLocaleLowerCase().includes(normalizedQuery),
        )
      : options;
  }, [options, query]);
  const listboxId = `${id}-listbox`;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const frame = requestAnimationFrame(() => {
      (searchable ? searchRef.current : listboxRef.current)?.focus();
    });
    document.addEventListener("pointerdown", dismiss);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [open, searchable]);

  const openMenu = (direction = 0) => {
    if (disabled) return;
    setQuery("");
    const selectedIndex = options.findIndex(
      (option) => option.value === selectedValue,
    );
    setActiveIndex(
      direction < 0
        ? selectedIndex > 0
          ? selectedIndex - 1
          : Math.max(0, options.length - 1)
        : Math.max(0, selectedIndex),
    );
    setOpen(true);
  };
  const select = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const moveActive = (offset: number) => {
    setActiveIndex((current) => {
      if (!visibleOptions.length) return 0;
      return (current + offset + visibleOptions.length) % visibleOptions.length;
    });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isSearchInput = event.target === searchRef.current;
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openMenu(event.key === "ArrowUp" ? -1 : 0);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close();
    } else if (isSearchInput && event.key === "ArrowDown") {
      event.preventDefault();
      listboxRef.current?.focus();
      moveActive(1);
    } else if (isSearchInput && event.key === "ArrowUp") {
      event.preventDefault();
      listboxRef.current?.focus();
      moveActive(-1);
    } else if (isSearchInput && event.key === "Enter") {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) select(option.value);
    } else if (!isSearchInput && event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (!isSearchInput && event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (!isSearchInput && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const option = visibleOptions[activeIndex];
      if (option) select(option.value);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`relative ${className ?? ""}`}
      onKeyDown={onKeyDown}
    >
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={labelId ? `${labelId} ${id}-value` : undefined}
        onClick={() => (open ? close() : openMenu())}
        className={`form-input mt-0 flex h-11 min-h-0 items-center justify-between gap-3 text-left ${invalid ? "border-red-500 focus:border-red-600 focus:ring-red-600/10" : ""} ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500" : ""}`}
      >
        <span id={`${id}-value`} className="truncate">
          {selectedOption?.label}
        </span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-slate-600 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={
            visibleOptions[activeIndex]
              ? `${id}-option-${visibleOptions[activeIndex].value}`
              : undefined
          }
          className="select-content absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-md outline-none"
        >
          {searchable && (
            <div className="p-1">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="form-input mt-0 h-9 min-h-0 px-2.5 text-sm"
              />
            </div>
          )}
          {visibleOptions.length ? (
            visibleOptions.map((option, index) => {
              const selected = option.value === selectedValue;
              const active = index === activeIndex;
              return (
                <button
                  key={option.value}
                  id={`${id}-option-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => select(option.value)}
                  className={`select-option ${selected ? "select-option-selected" : active ? "select-option-active" : ""}`}
                >
                  <CheckIcon
                    className={`size-4 shrink-0 ${selected ? "text-sky-700" : "invisible"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              );
            })
          ) : (
            <p className="px-2.5 py-2 text-sm text-slate-500">{emptyLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
