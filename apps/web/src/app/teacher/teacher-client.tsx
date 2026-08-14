"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PencilSquareIcon,
  PlayIcon,
  PlusIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { api, ApiError } from "@/lib/api";
import { ActivityTypeBadge } from "@/components/activity-type-badge";
type ActivityType = "QUIZ" | "POLL" | "WORD_CLOUD";
type Quiz = { id: string; title: string; type: ActivityType; _count: { questions: number } };
export default function TeacherClient({ token }: { token: string }) {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>();
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Quiz>();
  const [deletingId, setDeletingId] = useState<string>();
  const creating = useRef(false);
  const load = () =>
    api<Quiz[]>("/quizzes", {}, token)
      .then(setQuizzes)
      .catch((e) =>
        setError(
          t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`),
        ),
      );
  useEffect(() => {
    load();
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quizTitle = title.trim();
    if (!quizTitle || !type) {
      setError(t("errors.VALIDATION_ERROR"));
      return;
    }
    if (creating.current || busy) return;
    creating.current = true;
    setBusy(true);
    setError("");
    try {
      await api<Quiz>(
        "/quizzes",
        { method: "POST", body: JSON.stringify({ title: quizTitle, type }) },
        token,
      );
      setTitle("");
      setType(undefined);
      await load();
    } catch (e) {
      setError(
        t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`),
      );
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }
  async function start(quizId: string) {
    if (busy) return;
    setBusy(true);
    try {
      setRoom(
        (
          await api<{ code: string }>(
            "/rooms",
            { method: "POST", body: JSON.stringify({ quizId }) },
            token,
          )
        ).code,
      );
    } catch (e) {
      setError(
        t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`),
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirming || deletingId) return;
    setDeletingId(confirming.id);
    setError("");
    try {
      await api(`/quizzes/${confirming.id}`, { method: "DELETE" }, token);
      setQuizzes((items) => items.filter((quiz) => quiz.id !== confirming.id));
      setConfirming(undefined);
    } catch (e) {
      setError(t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`));
    } finally {
      setDeletingId(undefined);
    }
  }
  return (
    <main className="page-shell">
      <div className="page-content max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mt-3 text-4xl font-black text-slate-900">
              {t("quiz.myQuizzes")}
            </h1>
          </div>
        </div>
        <section className="panel mt-7">
          {!type ? <div className="grid gap-3 sm:grid-cols-3">
            {([
              ["QUIZ", QuestionMarkCircleIcon],
              ["POLL", ChartBarIcon],
              ["WORD_CLOUD", ChatBubbleLeftRightIcon],
            ] as const).map(([activityType, Icon]) => (
              <button key={activityType} type="button" onClick={() => setType(activityType)} className="soft-card text-left transition hover:border-sky-400 hover:bg-sky-50">
                <Icon className="h-7 w-7 text-sky-700" aria-hidden="true" />
                <strong className="mt-3 block text-lg text-slate-900">{t(`activity.${activityType}.name`)}</strong>
                <span className="mt-1 block text-sm text-slate-600">{t(`activity.${activityType}.description`)}</span>
              </button>
            ))}
          </div> : <form className="flex flex-col gap-3 sm:flex-row" onSubmit={create} noValidate>
            <label className="sr-only" htmlFor="quiz-title">
              {t("activity.title", { type: t(`activity.${type}.name`) })}
            </label>
            <input
              id="quiz-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("activity.title", { type: t(`activity.${type}.name`) })}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "create-quiz-error" : undefined}
              className="form-input mt-0 flex-1"
            />
            <button type="submit" disabled={busy} className="btn-primary">
              <PlusIcon className="h-5 w-5" aria-hidden="true" />
              {busy ? t("common.loading") : t("common.create")}
            </button>
            <button type="button" onClick={() => setType(undefined)} className="btn-secondary">{t("common.back")}</button>
          </form>}
          {room && (
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">
              {t("common.roomCode")}: <strong>{room}</strong>{" "}
              <a
                className="ml-2 font-semibold underline"
                href={`/teacher/room/${room}`}
              >
                {t("quiz.hostControls")}
              </a>
            </p>
          )}
          {error && (
            <p id="create-quiz-error" role="alert" className="alert-error mt-4">
              {error}
            </p>
          )}
        </section>
        <ul className="mt-6 grid gap-4">
          {quizzes.length ? (
            quizzes.map((quiz) => (
              <li
                key={quiz.id}
                className="soft-card flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
              >
                <span className="text-lg font-bold text-slate-900">
                  {quiz.title}{" "}
                  <span className="font-medium text-slate-500">
                    ({quiz._count.questions} {t("quiz.questions")})
                  </span>
                  <ActivityTypeBadge type={quiz.type} />
                </span>
                <span className="flex flex-wrap gap-2">
                  <a
                    href={`/teacher/quiz/${quiz.id}`}
                    className="btn-secondary"
                  >
                    <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                    {t("common.edit")}
                  </a>
                  <button
                    disabled={busy || Boolean(deletingId)}
                    onClick={() => start(quiz.id)}
                    className="btn-primary"
                  >
                    <PlayIcon className="h-5 w-5" aria-hidden="true" />
                    {t("quiz.openRoom")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || Boolean(deletingId)}
                    onClick={() => setConfirming(quiz)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="h-5 w-5" aria-hidden="true" />
                    {t("common.delete")}
                  </button>
                </span>
              </li>
            ))
          ) : (
            <li className="panel text-center text-slate-500">
              {t("quiz.quizEmpty")}
            </li>
          )}
        </ul>
        {confirming && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-activity-title"
            aria-describedby="delete-activity-message"
            className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-4"
          >
            <div className="panel max-w-md">
              <h2 id="delete-activity-title" className="text-xl font-bold text-slate-900">
                {t("teacher.deleteActivityTitle")}
              </h2>
              <p id="delete-activity-message" className="mt-2 text-slate-600">
                {t("teacher.deleteActivityWarning")}
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={() => setConfirming(undefined)}
                  className="btn-secondary"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={() => void remove()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <TrashIcon className="h-5 w-5" aria-hidden="true" />
                  {deletingId ? t("teacher.deletingActivity") : t("teacher.deleteActivity")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
