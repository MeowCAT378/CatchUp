"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";

export function AdminHeader() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const linkClass = (active: boolean) =>
    `inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-3 ${active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`;
  return (
    <header className="sticky top-0 z-20 border-b border-cyan-900/20 bg-cyan-950/95 px-5 py-3 text-white backdrop-blur-md sm:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 sm:grid-cols-[auto_1fr_auto]">
        <a
          href="/admin"
          aria-label="CatchUp"
          className="rounded-lg bg-white/90 px-2 focus-visible:outline-white"
        >
          <Logo className="h-12 w-auto" />
        </a>
        <nav
          className="order-3 col-span-2 grid w-full grid-cols-2 gap-1 sm:order-none sm:col-span-1 sm:flex sm:w-auto sm:items-center sm:justify-end sm:gap-2"
          aria-label={t("admin.navigation")}
        >
          <Link
            href="/teacher"
            className={linkClass(pathname.startsWith("/teacher"))}
          >
            {t("admin.activities")}
          </Link>
          <Link href="/admin" className={linkClass(pathname === "/admin")}>
            {t("admin.overview")}
          </Link>
          <Link
            href="/admin/teachers"
            className={linkClass(pathname.startsWith("/admin/teachers"))}
          >
            {t("admin.teachers")}
          </Link>
          <Link
            href="/admin/history"
            className={linkClass(pathname.startsWith("/admin/history"))}
          >
            {t("history.title")}
          </Link>
        </nav>
        <div className="flex items-center justify-end gap-1">
          <LanguageSwitcher />
          <button
            type="button"
            aria-label={t("teacher.logout")}
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowRightStartOnRectangleIcon
              className="h-5 w-5"
              aria-hidden="true"
            />
            <span className="hidden xl:inline">{t("teacher.logout")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
