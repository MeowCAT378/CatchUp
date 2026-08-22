"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityTypeBadge } from "@/components/activity-type-badge";
import { apiErrorCode, secureApi, type ApiErrorCode } from "@/lib/api";

type ActivityType = "QUIZ" | "POLL" | "WORD_CLOUD";
type Session = {
  id: string;
  code: string;
  activityTitle: string;
  activityType: ActivityType;
  status: "LOBBY" | "ACTIVE" | "FINISHED";
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  host: { id: string; name: string | null; email: string };
};
type Page = {
  items: Session[];
  page: number;
  totalPages: number;
  total: number;
};
type Teacher = { id: string; name: string | null; email: string };

export function HistoryList({
  basePath,
  admin = false,
  initialTeacherId = "",
}: {
  basePath: string;
  admin?: boolean;
  initialTeacherId?: string;
}) {
  const { t, i18n } = useTranslation();
  const [result, setResult] = useState<Page>();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [activityType, setActivityType] = useState("");
  const [status, setStatus] = useState("");
  const [teacherId, setTeacherId] = useState(initialTeacherId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loadedQuery, setLoadedQuery] = useState("");
  const [errorCode, setErrorCode] = useState<ApiErrorCode | "">("");
  const query = useMemo(() => {
    const value = new URLSearchParams({ page: String(page) });
    if (search) value.set("search", search);
    if (activityType) value.set("activityType", activityType);
    if (status) value.set("status", status);
    if (teacherId) value.set("teacherId", teacherId);
    if (from) value.set("from", from);
    if (to) value.set("to", to);
    return value.toString();
  }, [activityType, from, page, search, status, teacherId, to]);
  const loading = loadedQuery !== query;

  useEffect(() => {
    if (!admin) return;
    secureApi<{ items: Teacher[] }>("/admin/teachers?pageSize=50")
      .then((data) => setTeachers(data.items))
      .catch(() => undefined);
  }, [admin]);

  useEffect(() => {
    let active = true;
    secureApi<Page>(`/rooms/history?${query}`)
      .then((value) => {
        if (!active) return;
        setResult(value);
        setErrorCode("");
      })
      .catch((error) => active && setErrorCode(apiErrorCode(error)))
      .finally(() => active && setLoadedQuery(query));
    return () => {
      active = false;
    };
  }, [query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "—";
  const duration = (item: Session) => {
    if (!item.startedAt || !item.endedAt) return "—";
    return `${Math.max(0, Math.round((new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()) / 60_000))} min`;
  };
  return (
    <main className="page-shell">
      <div className="page-content max-w-7xl">
        <h1 className="text-4xl font-bold">{t("history.title")}</h1>
        <form
          onSubmit={submit}
          className="panel mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-6"
        >
          <label className="md:col-span-2">
            <span className="sr-only">{t("history.search")}</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("history.search")}
              className="form-input mt-0"
            />
          </label>
          <select
            aria-label={t("history.allTypes")}
            value={activityType}
            onChange={(event) => {
              setPage(1);
              setActivityType(event.target.value);
            }}
            className="form-input mt-0"
          >
            <option value="">{t("history.allTypes")}</option>
            <option value="QUIZ">{t("activity.QUIZ.name")}</option>
            <option value="POLL">{t("activity.POLL.name")}</option>
            <option value="WORD_CLOUD">{t("activity.WORD_CLOUD.name")}</option>
          </select>
          <select
            aria-label={t("history.allStatuses")}
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="form-input mt-0"
          >
            <option value="">{t("history.allStatuses")}</option>
            <option value="LOBBY">{t("history.lobby")}</option>
            <option value="ACTIVE">{t("history.active")}</option>
            <option value="FINISHED">{t("history.finished")}</option>
          </select>
          {admin && (
            <select
              aria-label={t("history.teacher")}
              value={teacherId}
              onChange={(event) => {
                setPage(1);
                setTeacherId(event.target.value);
              }}
              className="form-input mt-0"
            >
              <option value="">{t("admin.teachers")}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name ?? teacher.email}
                </option>
              ))}
            </select>
          )}
          <button className="btn-primary">{t("history.search")}</button>
          <label className="text-sm">
            {t("history.from")}
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
              className="form-input"
            />
          </label>
          <label className="text-sm">
            {t("history.to")}
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
              className="form-input"
            />
          </label>
        </form>
        {errorCode && (
          <p className="alert-error mt-5" role="alert">
            {t(`errors.${errorCode}`)}
          </p>
        )}
        {loading ? (
          <p className="panel mt-6">{t("common.loading")}</p>
        ) : result?.items.length ? (
          <div className="panel mt-6 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-3">{t("admin.activities")}</th>
                  {admin && <th className="p-3">{t("history.teacher")}</th>}
                  <th className="p-3">{t("history.startedAt")}</th>
                  <th className="p-3">{t("history.duration")}</th>
                  <th className="p-3">{t("results.participants")}</th>
                  <th className="p-3">{t("history.status")}</th>
                  <th className="p-3">
                    <span className="sr-only">{t("history.viewResults")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200/70">
                    <td className="p-3">
                      <strong>{item.activityTitle}</strong>
                      <div className="mt-1">
                        <ActivityTypeBadge type={item.activityType} />
                      </div>
                    </td>
                    {admin && (
                      <td className="p-3">
                        {item.host.name ?? item.host.email}
                      </td>
                    )}
                    <td className="p-3">
                      {date(item.startedAt ?? item.createdAt)}
                    </td>
                    <td className="p-3">{duration(item)}</td>
                    <td className="p-3">{item.participantCount}</td>
                    <td className="p-3">
                      <span className="badge">
                        {t(`history.${item.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="p-3">
                      <a
                        className="btn-secondary"
                        href={`${basePath}/${item.id}`}
                      >
                        {t("history.viewResults")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel mt-6 text-center">
            <h2 className="text-xl font-bold">{t("history.noHistory")}</h2>
            <p className="mt-2 text-slate-500">{t("history.noHistoryHint")}</p>
          </div>
        )}
        {result && result.totalPages > 1 && (
          <nav
            className="mt-5 flex items-center justify-center gap-3"
            aria-label={t("history.title")}
          >
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
