"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { apiErrorCode, secureApi, type ApiErrorCode } from "@/lib/api";
import { SkeletonStatCard } from "@/components/skeleton";

type Overview = {
  totalTeachers: number;
  activeTeachers: number;
  disabledTeachers: number;
  activities: number;
  todaySessions: number;
  completedSessions: number;
};

export function AdminOverview() {
  const { t } = useTranslation();
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState<ApiErrorCode | "">("");
  useEffect(() => {
    secureApi<Overview>("/admin/overview")
      .then(setData)
      .catch((value) => setError(apiErrorCode(value)));
  }, []);
  const cards: [string, number | undefined][] = [
    ["admin.totalTeachers", data?.totalTeachers],
    ["admin.activeTeachers", data?.activeTeachers],
    ["admin.disabledTeachers", data?.disabledTeachers],
    ["admin.totalActivities", data?.activities],
    ["admin.sessionsToday", data?.todaySessions],
    ["admin.completedSessions", data?.completedSessions],
  ];
  return (
    <main className="page-shell">
      <div className="page-content">
        <h1 className="page-title">{t("admin.overview")}</h1>
        {error && (
          <p role="alert" className="alert-error mt-5">
            {t(`errors.${error}`)}
          </p>
        )}
        <div
          className="mt-7 grid divide-y divide-neutral-200 border-y border-neutral-200 bg-white/55 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3"
          aria-busy={!data}
        >
          {!data && !error
            ? Array.from({ length: 6 }, (_, index) => (
                <SkeletonStatCard key={index} />
              ))
            : data &&
              cards.map(([label, value]) => (
                <div key={label} className="px-5 py-4">
                  <p className="text-sm text-slate-500">{t(label)}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
        </div>
        <div className="mt-7 flex gap-3">
          <Link href="/admin/teachers" className="btn-secondary">
            {t("admin.teachers")}
          </Link>
          <Link href="/admin/history" className="btn-secondary">
            {t("history.title")}
          </Link>
        </div>
      </div>
    </main>
  );
}
