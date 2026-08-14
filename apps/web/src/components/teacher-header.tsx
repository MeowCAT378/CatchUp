"use client";

import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";
import { useTranslation } from "react-i18next";

export function TeacherHeader() {
  const { t } = useTranslation();
  return <header className="absolute left-4 top-4 z-10"><span className="badge">CatchUp</span><button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="btn-secondary ml-3 min-h-10 px-3 py-2 text-sm"><ArrowRightStartOnRectangleIcon className="h-5 w-5" aria-hidden="true" />{t("teacher.logout")}</button></header>;
}
