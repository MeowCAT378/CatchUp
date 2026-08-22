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
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-800">
          {t("admin.navigation")}
        </p>
        <h1 className="mt-2 text-4xl font-bold">{t("admin.overview")}</h1>
        {error && (
          <p role="alert" className="alert-error mt-5">
            {t(`errors.${error}`)}
          </p>
        )}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={!data}>
          {!data && !error ? Array.from({ length: 6 }, (_, index) => <SkeletonStatCard key={index} />) : data && cards.map(([label, value]) => (
            <div key={label} className="panel"><p className="text-sm text-slate-500">{t(label)}</p><p className="mt-2 text-4xl font-bold">{value}</p></div>
          ))}
        </div>
        <div className="mt-7 flex gap-3">
          <Link href="/admin/teachers" className="btn-primary">
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
