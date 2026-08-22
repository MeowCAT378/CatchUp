"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";

export function AdminHeader() {
  const { t } = useTranslation();
  return (
    <header className="fixed left-0 right-0 top-0 z-20 border-b border-cyan-900/10 bg-cyan-950/90 px-5 py-3 text-white backdrop-blur-xl sm:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-3">
        <a href="/admin" className="rounded-lg bg-white/90 px-2">
          <Logo className="h-12 w-auto" />
        </a>
        <nav
          className="flex flex-wrap items-center justify-end gap-1 text-xs sm:gap-2 sm:text-sm"
          aria-label={t("admin.navigation")}
        >
          <Link
            href="/admin"
            className="rounded-full px-2 py-2 hover:bg-white/10 sm:px-3"
          >
            {t("admin.overview")}
          </Link>
          <Link
            href="/admin/teachers"
            className="rounded-full px-2 py-2 hover:bg-white/10 sm:px-3"
          >
            {t("admin.teachers")}
          </Link>
          <Link
            href="/admin/history"
            className="rounded-full px-2 py-2 hover:bg-white/10 sm:px-3"
          >
            {t("history.title")}
          </Link>
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full px-3 py-2 font-semibold hover:bg-white/10"
          >
            {t("teacher.logout")}
          </button>
        </nav>
      </div>
    </header>
  );
}
