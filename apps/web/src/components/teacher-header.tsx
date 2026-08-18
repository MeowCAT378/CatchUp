"use client";

import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";

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
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="btn-secondary min-h-9 px-4 py-1.5 text-xs"
        >
          <ArrowRightStartOnRectangleIcon
            className="h-4 w-4"
            aria-hidden="true"
          />
          {t("teacher.logout")}
        </button>
      </div>
    </header>
  );
}
