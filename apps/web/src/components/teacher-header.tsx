"use client";

import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";
import { useTranslation } from "react-i18next";

export function TeacherHeader() {
  const { t } = useTranslation();
  return <header className="fixed left-0 right-0 top-0 z-20 border-b border-black/[0.05] bg-white/80 px-5 py-3 backdrop-blur-xl sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between"><a href="/teacher" className="text-lg font-semibold tracking-tight text-[#1d1d1f]">CatchUp</a><button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="btn-secondary min-h-9 px-4 py-1.5 text-xs"><ArrowRightStartOnRectangleIcon className="h-4 w-4" aria-hidden="true" />{t("teacher.logout")}</button></div></header>;
}
