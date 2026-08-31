"use client";

import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/dialog";
import { LanguageSwitcher } from "@/components/language-switcher";

export function MobileNavigation({
  children,
  profile,
}: {
  children: ReactNode;
  profile?: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const id = useId();
  const close = () => setClosing(true);

  useEffect(() => {
    if (!closing) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 200;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) {
        setOpen(false);
        setClosing(false);
      }
    };
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return (
    <div className="ml-auto min-w-0 lg:hidden">
      <button
        type="button"
        aria-label={t("common.openMenu")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(true)}
        className="app-nav-action"
      >
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>
      {open && (
        <Dialog
          labelledBy={`${id}-title`}
          onClose={close}
          className={`navigation-drawer m-0 ml-auto h-dvh max-h-none w-[min(24rem,calc(100vw-1rem))] max-w-none overflow-hidden lg:hidden ${closing ? "navigation-drawer-closing" : ""}`}
        >
          <div
            id={id}
            className="flex h-full min-w-0 flex-col overflow-y-auto overscroll-contain bg-ui-surface-solid px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 text-ui-text sm:px-6"
          >
            <div className="mb-6 flex shrink-0 items-center justify-between gap-3">
              <h2
                id={`${id}-title`}
                className="min-w-0 truncate text-lg font-semibold text-foreground"
              >
                {t("common.navigation")}
              </h2>
              <button
                type="button"
                aria-label={t("common.closeMenu")}
                onClick={close}
                className="app-nav-action"
              >
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <nav
              aria-label={t("common.navigation")}
              className="flex min-w-0 shrink-0 flex-col gap-2"
              onClick={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest("a")
                )
                  close();
              }}
            >
              {children}
            </nav>
            <div className="mt-auto min-w-0 shrink-0 pt-8">
              <div className="space-y-5 border-t border-ui-border pt-5">
                {profile}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ui-muted">
                    {t("common.language")}
                  </span>
                  <LanguageSwitcher variant="navigation" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  close();
                  void signOut({ callbackUrl: "/" });
                }}
                className="app-nav-action mt-4 w-full justify-start gap-3 px-3"
              >
                <ArrowRightStartOnRectangleIcon
                  className="h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">{t("teacher.logout")}</span>
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
