"use client";

import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";

export function TeacherHeader({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  return (
    <header className="fixed left-0 right-0 top-0 z-20 border-b border-neutral-200 bg-white/95 px-5 py-3 backdrop-blur-md sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <a
          href="/teacher"
          aria-label="CatchUp"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          <Logo className="h-12 w-auto sm:h-14" />
        </a>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="min-h-11 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-neutral-100"
            >
              {t("admin.overview")}
            </Link>
          )}
          <Link
            href="/teacher/history"
            className={`min-h-11 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${pathname.startsWith("/teacher/history") ? "bg-sky-50 text-sky-800" : "hover:bg-neutral-100"}`}
          >
            {t("history.title")}
          </Link>
          <LanguageSwitcher />
          <button
            type="button"
            aria-label={t("teacher.logout")}
            onClick={() => signOut({ callbackUrl: "/" })}
            className="min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100"
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
