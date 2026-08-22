"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiErrorCode, secureApi, type ApiErrorCode } from "@/lib/api";

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
        <h1 className="text-4xl font-bold">{t("admin.teachers")}</h1>
        <form onSubmit={submit} className="panel mt-6 flex flex-wrap gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("admin.searchTeachers")}
            className="form-input mt-0 flex-1"
          />
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            aria-label={t("admin.status")}
            className="form-input mt-0 w-auto"
          >
            <option value="">{t("admin.allStatuses")}</option>
            <option value="ACTIVE">{t("admin.active")}</option>
            <option value="DISABLED">{t("admin.disabled")}</option>
          </select>
          <button className="btn-primary">{t("history.search")}</button>
        </form>
        {error && (
          <p className="alert-error mt-5" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        {loading ? (
          <p className="panel mt-6">{t("common.loading")}</p>
        ) : result?.items.length ? (
          <div className="panel mt-6 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-3">{t("common.name")}</th>
                  <th className="p-3">{t("admin.status")}</th>
                  <th className="p-3">{t("admin.activities")}</th>
                  <th className="p-3">{t("admin.sessions")}</th>
                  <th className="p-3">{t("admin.dates")}</th>
                  <th className="p-3">{t("admin.lastActivity")}</th>
                  <th className="p-3">
                    <span className="sr-only">{t("admin.teacherDetails")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((teacher) => (
                  <tr key={teacher.id} className="border-b border-slate-200/70">
                    <td className="p-3">
                      <strong>{teacher.name ?? "—"}</strong>
                      <div className="text-sm text-slate-500">
                        {teacher.email}
                      </div>
                      <div className="text-xs text-slate-400">{teacher.id}</div>
                    </td>
                    <td className="p-3">
                      <span className="badge">
                        {t(
                          teacher.isDisabled
                            ? "admin.disabled"
                            : "admin.active",
                        )}
                      </span>
                    </td>
                    <td className="p-3">{teacher.activityCount}</td>
                    <td className="p-3">{teacher.sessionCount}</td>
                    <td className="p-3 text-sm">
                      {date(teacher.createdAt)}
                      <br />
                      {date(teacher.updatedAt)}
                    </td>
                    <td className="p-3">{date(teacher.lastActivityAt)}</td>
                    <td className="p-3">
                      <a
                        className="btn-secondary"
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
          <p className="panel mt-6 text-center">{t("admin.noTeachers")}</p>
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
