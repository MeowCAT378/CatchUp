"use client";

import { useTranslation } from "react-i18next";
import {
  ArrowRightIcon,
  UserIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { Logo } from "@/components/logo";

export default function Home() {
  const { t } = useTranslation();
  return (
    <main className="page-shell page-shell-hero">
      <div className="page-content flex min-h-screen max-w-5xl items-center">
        <section className="w-full py-10 sm:py-16">
          <Logo className="h-28 w-auto sm:h-36" />
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-[#1d1d1f] sm:text-7xl">
            {t("room.landingTitle")}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-500">
            {t("room.landingSubtitle")}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="/login" className="btn-primary px-6">
              <UserIcon className="h-5 w-5" aria-hidden="true" />
              {t("room.teacherEntry")}
              <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
            </a>
            <a href="/join" className="btn-secondary px-6">
              <UsersIcon className="h-5 w-5" aria-hidden="true" />
              {t("room.playerEntry")}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
