"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ActivityTypeBadge } from "@/components/activity-type-badge";
import { apiErrorCode, secureApi, type ApiErrorCode } from "@/lib/api";

type Teacher = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
  activities: {
    id: string;
    title: string;
    description: string | null;
    type: "QUIZ" | "POLL" | "WORD_CLOUD";
    createdAt: string;
    updatedAt: string;
    questionCount: number;
    sessionCount: number;
    lastUsedAt: string | null;
    questions: {
      id: string;
      text: string;
      position: number;
      choices: { id: string; text: string; isCorrect: boolean }[];
    }[];
  }[];
};

export function AdminTeacherDetail({ teacherId }: { teacherId: string }) {
  const { t, i18n } = useTranslation();
  const [teacher, setTeacher] = useState<Teacher>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<ApiErrorCode | "">("");
  const submitting = useRef(false);
  const load = useCallback(
    () =>
      secureApi<Teacher>(`/admin/teachers/${teacherId}`).then((value) => {
        setTeacher(value);
        setName(value.name ?? "");
        setEmail(value.email);
      }),
    [teacherId],
  );
  useEffect(() => {
    load().catch((value) => setError(apiErrorCode(value)));
  }, [load]);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await secureApi(`/admin/teachers/${teacherId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, email }),
      });
      await load();
      setMessage(t("admin.saved"));
    } catch (value) {
      setError(apiErrorCode(value));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function changeStatus() {
    if (!teacher || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await secureApi(`/admin/teachers/${teacherId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isDisabled: !teacher.isDisabled }),
      });
      await load();
      setConfirming(false);
      setMessage(t("admin.statusChanged"));
    } catch (value) {
      setError(apiErrorCode(value));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (!teacher && !error)
    return (
      <main className="page-shell">
        <p className="page-content">{t("common.loading")}</p>
      </main>
    );
  if (!teacher)
    return (
      <main className="page-shell">
        <p className="page-content alert-error" role="alert">
          {t(`errors.${error}`)}
        </p>
      </main>
    );
  return (
    <main className="page-shell">
      <div className="page-content max-w-6xl">
        <Link href="/admin/teachers" className="back-button">
          {t("common.back")}
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">
              {teacher.name ?? teacher.email}
            </h1>
            <p className="mt-1 text-slate-500">{teacher.id}</p>
          </div>
          <span className="badge">
            {t(teacher.isDisabled ? "admin.disabled" : "admin.active")}
          </span>
        </div>
        {error && (
          <p className="alert-error mt-5" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        {message && (
          <p
            className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800"
            role="status"
          >
            {message}
          </p>
        )}
        <section className="panel mt-6">
          <h2 className="text-2xl font-bold">{t("admin.editTeacher")}</h2>
          <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              {t("common.name")}
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="form-input"
              />
            </label>
            <label>
              {t("admin.email")}
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="form-input"
              />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button disabled={busy} className="btn-primary">
                {t("common.save")}
              </button>
              <button
                disabled={busy}
                type="button"
                onClick={() => setConfirming(true)}
                className={
                  teacher.isDisabled
                    ? "btn-secondary"
                    : "inline-flex min-h-11 items-center rounded-full bg-red-600 px-5 font-semibold text-white disabled:opacity-50"
                }
              >
                {t(teacher.isDisabled ? "admin.enable" : "admin.disable")}
              </button>
              <a
                href={`/admin/history?teacherId=${teacher.id}`}
                className="btn-secondary"
              >
                {t("history.title")}
              </a>
            </div>
          </form>
          <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">{t("admin.role")}</dt>
              <dd>{teacher.role}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("admin.createdAt")}</dt>
              <dd>{date(teacher.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("admin.updatedAt")}</dt>
              <dd>{date(teacher.updatedAt)}</dd>
            </div>
          </dl>
        </section>
        <section className="mt-7">
          <h2 className="text-2xl font-bold">{t("admin.activities")}</h2>
          {teacher.activities.length ? (
            <div className="mt-4 grid gap-4">
              {teacher.activities.map((activity) => (
                <article key={activity.id} className="panel">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-bold">{activity.title}</h3>
                    <ActivityTypeBadge type={activity.type} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {t("admin.questions")}: {activity.questionCount} ·{" "}
                    {t("admin.sessions")}: {activity.sessionCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("admin.createdAt")}: {date(activity.createdAt)} ·{" "}
                    {t("admin.updatedAt")}: {date(activity.updatedAt)} ·{" "}
                    {t("admin.lastActivity")}:{" "}
                    {activity.lastUsedAt ? date(activity.lastUsedAt) : "—"}
                  </p>
                  {activity.questions.map((question) => (
                    <div
                      key={question.id}
                      className="mt-4 rounded-2xl border border-sky-100 p-4"
                    >
                      <h4 className="font-semibold">
                        {question.position + 1}. {question.text}
                      </h4>
                      {question.choices.length > 0 && (
                        <ul className="mt-2 grid gap-1">
                          {question.choices.map((choice) => (
                            <li
                              key={choice.id}
                              className={
                                choice.isCorrect
                                  ? "font-semibold text-emerald-700"
                                  : "text-slate-600"
                              }
                            >
                              {choice.text}
                              {choice.isCorrect
                                ? ` — ${t("admin.correct")}`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          ) : (
            <p className="panel mt-4">{t("admin.noActivities")}</p>
          )}
        </section>
        {confirming && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-title"
            className="fixed inset-0 z-30 grid place-items-center bg-slate-950/40 p-4"
          >
            <div className="panel max-w-md">
              <h2 id="status-title" className="text-xl font-bold">
                {t(
                  teacher.isDisabled
                    ? "admin.enableTitle"
                    : "admin.disableTitle",
                  { name: teacher.name ?? teacher.email },
                )}
              </h2>
              {!teacher.isDisabled && (
                <p className="mt-3 text-slate-600">
                  {t("admin.disableWarning")}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="btn-secondary"
                >
                  {t("common.cancel")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void changeStatus()}
                  className={
                    teacher.isDisabled
                      ? "btn-primary"
                      : "inline-flex min-h-11 items-center rounded-full bg-red-600 px-5 font-semibold text-white disabled:opacity-50"
                  }
                >
                  {t(teacher.isDisabled ? "admin.enable" : "admin.disable")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
