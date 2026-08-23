"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiErrorCode, secureApi, type ApiErrorCode } from "@/lib/api";
import { SkeletonTable } from "@/components/skeleton";
import { Select, type SelectOption } from "@/components/select";

type Teacher = {
  id: string;
  name: string | null;
  email: string;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
  activityCount: number;
  sessionCount: number;
  lastActivityAt: string | null;
};
type Result = { items: Teacher[]; page: number; totalPages: number };

export function AdminTeachers() {
  const { t, i18n } = useTranslation();
  const [result, setResult] = useState<Result>();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loadedQuery, setLoadedQuery] = useState("");
  const [error, setError] = useState<ApiErrorCode | "">("");
  const statusOptions: SelectOption[] = [
    { value: "", label: t("admin.allStatuses") },
    { value: "ACTIVE", label: t("admin.active") },
    { value: "DISABLED", label: t("admin.disabled") },
  ];
  const query = useMemo(() => {
    const value = new URLSearchParams({ page: String(page) });
    if (search) value.set("search", search);
    if (status) value.set("status", status);
    return value.toString();
  }, [page, search, status]);
  const loading = loadedQuery !== query;
  useEffect(() => {
    let active = true;
    secureApi<Result>(`/admin/teachers?${query}`)
      .then((value) => {
        if (!active) return;
        setResult(value);
        setError("");
      })
      .catch((value) => active && setError(apiErrorCode(value)))
      .finally(() => active && setLoadedQuery(query));
    return () => {
      active = false;
    };
  }, [query]);
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "—";
  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(input.trim());
  }
  return (
    <main className="page-shell">
      <div className="page-content max-w-7xl">
        <h1 className="page-title">{t("admin.teachers")}</h1>
        <form
          onSubmit={submit}
          className="filter-bar grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_180px]"
        >
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-700">
              {t("admin.search")}
            </span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("admin.searchTeachers")}
              className="form-input mt-0 h-11 min-h-0"
            />
          </label>
          <div>
            <label id="admin-teacher-status-label" htmlFor="admin-teacher-status" className="mb-1.5 block text-xs font-medium text-slate-700">{t("admin.status")}</label>
            <Select id="admin-teacher-status" labelId="admin-teacher-status-label" value={status} onValueChange={(value) => { setPage(1); setStatus(value); }} options={statusOptions} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="block text-xs font-medium" aria-hidden="true">&nbsp;</span>
            <button className="btn-primary h-11 min-h-0 w-full">{t("admin.search")}</button>
          </div>
        </form>
        {error && (
          <p className="alert-error mt-5" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        {loading && !result ? (
          <div aria-busy="true"><SkeletonTable columns={7} /></div>
        ) : result?.items.length ? (
          <div className="table-surface">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("admin.status")}</th>
                  <th className="hidden sm:table-cell">{t("admin.activities")}</th>
                  <th className="hidden sm:table-cell">{t("admin.sessions")}</th>
                  <th className="hidden lg:table-cell">{t("admin.dates")}</th>
                  <th className="hidden lg:table-cell">{t("admin.lastActivity")}</th>
                  <th>
                    <span className="sr-only">{t("admin.teacherDetails")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>
                      <strong>{teacher.name ?? "—"}</strong>
                      <div className="break-all text-sm text-slate-500">
                        {teacher.email}
                      </div>
                      <div className="hidden text-xs text-slate-400 sm:block">{teacher.id}</div>
                    </td>
                    <td>
                      <span className={`badge ${teacher.isDisabled ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
                        {t(
                          teacher.isDisabled
                            ? "admin.disabled"
                            : "admin.active",
                        )}
                      </span>
                    </td>
                    <td className="hidden tabular-nums sm:table-cell">{teacher.activityCount}</td>
                    <td className="hidden tabular-nums sm:table-cell">{teacher.sessionCount}</td>
                    <td className="hidden text-sm lg:table-cell">
                      {date(teacher.createdAt)}
                      <br />
                      {date(teacher.updatedAt)}
                    </td>
                    <td className="hidden lg:table-cell">{date(teacher.lastActivityAt)}</td>
                    <td>
                      <a
                        className="btn-secondary px-3"
                        href={`/admin/teachers/${teacher.id}`}
                      >
                        {t("admin.teacherDetails")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">{t("admin.noTeachers")}</p>
        )}
        {result && result.totalPages > 1 && (
          <nav className="mt-5 flex items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="btn-secondary"
            >
              {t("history.previous")}
            </button>
            <span>
              {t("history.page", {
                page: result.page,
                total: result.totalPages,
              })}
            </span>
            <button
              disabled={page >= result.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="btn-secondary"
            >
              {t("history.next")}
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
