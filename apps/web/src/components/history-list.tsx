"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityTypeBadge } from "@/components/activity-type-badge";
import { DateFilterPicker } from "@/components/date-filter-picker";
import { Select, type SelectOption } from "@/components/select";
import { apiErrorCode, secureApi, type ApiErrorCode } from "@/lib/api";
import { SkeletonTable } from "@/components/skeleton";

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
  const filterControlClassName = "form-input mt-0 h-11 min-h-0";
  const activityOptions: SelectOption[] = [
    { value: "", label: t("history.allTypes") },
    { value: "QUIZ", label: t("activity.QUIZ.name") },
    { value: "POLL", label: t("activity.POLL.name") },
    { value: "WORD_CLOUD", label: t("activity.WORD_CLOUD.name") },
  ];
  const statusOptions: SelectOption[] = [
    { value: "", label: t("history.allStatuses") },
    { value: "LOBBY", label: t("history.lobby") },
    { value: "ACTIVE", label: t("history.active") },
    { value: "FINISHED", label: t("history.finished") },
  ];
  const statusClassName = {
    LOBBY: "border-slate-200 bg-slate-100 text-slate-700",
    ACTIVE: "border-sky-200 bg-sky-50 text-sky-800",
    FINISHED: "border-teal-200 bg-teal-50 text-teal-800",
  } as const;
  const dateRangeInvalid = Boolean(from && to && from > to);
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
    if (dateRangeInvalid) return;
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
    <main className="page-shell history-page">
      <div className="page-content max-w-7xl">
        <h1 className="page-title">{t("history.title")}</h1>
        <form
          onSubmit={submit}
          className="filter-bar grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(220px,1.5fr)_repeat(5,minmax(0,1fr))_auto]"
        >
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-700">{t("history.searchLabel")}</span>
            <input
              id="history-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("history.search")}
              className={filterControlClassName}
            />
          </label>
          <div>
            <label id="history-activity-type-label" htmlFor="history-activity-type" className="mb-1.5 block text-xs font-medium text-slate-700">{t("history.activityType")}</label>
            <Select id="history-activity-type" labelId="history-activity-type-label" value={activityType} onValueChange={(value) => { setPage(1); setActivityType(value); }} options={activityOptions} />
          </div>
          <div>
            <label id="history-status-label" htmlFor="history-status" className="mb-1.5 block text-xs font-medium text-slate-700">{t("history.status")}</label>
            <Select id="history-status" labelId="history-status-label" value={status} onValueChange={(value) => { setPage(1); setStatus(value); }} options={statusOptions} />
          </div>
          {admin && (
            <div>
              <label id="history-teacher-label" htmlFor="history-teacher" className="mb-1.5 block text-xs font-medium text-slate-700">{t("history.teacherFilter")}</label>
              <Select id="history-teacher" labelId="history-teacher-label" value={teacherId} onValueChange={(value) => { setPage(1); setTeacherId(value); }} options={[{ value: "", label: t("history.allTeachers") }, ...teachers.map((teacher) => ({ value: teacher.id, label: teacher.name ?? teacher.email }))]} searchable searchPlaceholder={t("history.searchTeachers")} emptyLabel={t("history.noMatchingTeachers")} />
            </div>
          )}
          <DateFilterPicker id="history-from" label={t("history.from")} placeholder={t("history.selectDate")} value={from} onChange={(value) => { setPage(1); setFrom(value); }} locale={i18n.language} clearLabel={t("history.clearDate")} todayLabel={t("history.today")} previousMonthLabel={t("history.previousMonth")} nextMonthLabel={t("history.nextMonth")} max={to} />
          <DateFilterPicker id="history-to" label={t("history.to")} placeholder={t("history.selectDate")} value={to} onChange={(value) => { setPage(1); setTo(value); }} locale={i18n.language} clearLabel={t("history.clearDate")} todayLabel={t("history.today")} previousMonthLabel={t("history.previousMonth")} nextMonthLabel={t("history.nextMonth")} min={from} />
          <button className="btn-primary h-11 min-h-0 self-end">{t("history.searchButton")}</button>
        </form>
        {dateRangeInvalid && <p className="mt-2 text-sm text-red-700" role="alert">{t("history.invalidDateRange")}</p>}
        {errorCode && (
          <p className="alert-error mt-5" role="alert">
            {t(`errors.${errorCode}`)}
          </p>
        )}
        {loading && !result ? (
          <div aria-busy="true"><SkeletonTable columns={admin ? 7 : 6} /></div>
        ) : result?.items.length ? (
          <div className="table-surface">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("admin.activities")}</th>
                  {admin && <th className="hidden md:table-cell">{t("history.teacher")}</th>}
                  <th className="hidden sm:table-cell">{t("history.startedAt")}</th>
                  <th className="hidden lg:table-cell">{t("history.duration")}</th>
                  <th className="hidden lg:table-cell">{t("results.participants")}</th>
                  <th>{t("history.status")}</th>
                  <th>
                    <span className="sr-only">{t("history.viewResults")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.activityTitle}</strong>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <ActivityTypeBadge type={item.activityType} />
                        <span className="text-xs text-slate-500 sm:hidden">
                          {date(item.startedAt ?? item.createdAt)}
                        </span>
                      </div>
                    </td>
                    {admin && (
                      <td className="hidden md:table-cell">
                        {item.host.name ?? item.host.email}
                      </td>
                    )}
                    <td className="hidden sm:table-cell">
                      {date(item.startedAt ?? item.createdAt)}
                    </td>
                    <td className="hidden lg:table-cell">{duration(item)}</td>
                    <td className="hidden tabular-nums lg:table-cell">{item.participantCount}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-medium ${statusClassName[item.status]}`}>
                        {t(`history.${item.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td>
                      <a
                        className="btn-secondary border-slate-300 px-3 text-slate-800 hover:border-slate-400"
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
          <div className="empty-state">
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
