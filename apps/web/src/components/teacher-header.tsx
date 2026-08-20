"use client";

import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";

export function TeacherHeader() {
  const { t } = useTranslation();
  return (
    <header className="fixed left-0 right-0 top-0 z-20 border-b border-black/[0.05] bg-white/80 px-5 py-3 backdrop-blur-xl sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <a
          href="/teacher"
          aria-label="CatchUp"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          <Logo className="h-12 w-auto sm:h-14" />
        </a>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            aria-label={t("teacher.logout")}
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn-secondary px-3 py-1.5 text-xs sm:px-4"
          >
            <ArrowRightStartOnRectangleIcon
              className="h-5 w-5"
              aria-hidden="true"
            />
            <span className="hidden sm:inline">{t("teacher.logout")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
