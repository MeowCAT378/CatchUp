"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ActivityTypeBadge } from "@/components/activity-type-badge";
import { Dialog } from "@/components/dialog";
import { apiErrorCode, secureApi, type ApiErrorCode } from "@/lib/api";
import { SkeletonActivityCard, SkeletonText } from "@/components/skeleton";

type Teacher = {
  id: string;
  name: string | null;
  email: string;
  role: "HOST" | "ADMIN";
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
        <div className="page-content max-w-6xl" aria-busy="true">
          <SkeletonText className="w-1/2" />
          <div className="panel mt-6">
            <SkeletonText className="w-1/3" />
            <SkeletonText className="mt-6" />
            <SkeletonText className="mt-4" />
          </div>
          <div className="mt-7 grid gap-4">
            <SkeletonActivityCard />
            <SkeletonActivityCard />
          </div>
        </div>
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
            <h1 className="page-title">{teacher.name ?? teacher.email}</h1>
            <p className="mt-1 text-slate-500">{teacher.id}</p>
          </div>
          <span
            className={`badge ${teacher.isDisabled ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
          >
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
            className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-800"
            role="status"
          >
            {message}
          </p>
        )}
        <section className="panel mt-6">
          <h2 className="section-title">
            {t(
              teacher.role === "HOST"
                ? "admin.editTeacher"
                : "admin.accountDetails",
            )}
          </h2>
          {teacher.role === "HOST" && (
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
                    teacher.isDisabled ? "btn-secondary" : "btn-danger"
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
          )}
          {teacher.role === "ADMIN" && (
            <a
              href={`/admin/history?teacherId=${teacher.id}`}
              className="btn-secondary mt-4"
            >
              {t("history.title")}
            </a>
          )}
          <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">{t("admin.role")}</dt>
              <dd>
                {t(
                  teacher.role === "ADMIN"
                    ? "admin.adminRole"
                    : "admin.teacherRole",
                )}
              </dd>
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
          <h2 className="section-title">{t("admin.activities")}</h2>
          {teacher.activities.length ? (
            <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 bg-white/55">
              {teacher.activities.map((activity) => (
                <article key={activity.id} className="px-1 py-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold">{activity.title}</h3>
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
                      className="mt-4 border-t border-neutral-200 pt-4"
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
            <p className="empty-state mt-4">{t("admin.noActivities")}</p>
          )}
        </section>
        {confirming && (
          <Dialog
            labelledBy="status-title"
            onClose={() => setConfirming(false)}
          >
            <div className="panel">
              <h2 id="status-title" className="section-title">
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
                  autoFocus
                  onClick={() => setConfirming(false)}
                  className="btn-secondary"
                >
                  {t("common.cancel")}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void changeStatus()}
                  className={teacher.isDisabled ? "btn-primary" : "btn-danger"}
                >
                  {t(teacher.isDisabled ? "admin.enable" : "admin.disable")}
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </main>
  );
}
