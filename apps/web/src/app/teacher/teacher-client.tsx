"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  PencilSquareIcon,
  DocumentDuplicateIcon,
  PlayIcon,
  PlusIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { api, apiErrorCode, type ApiErrorCode } from "@/lib/api";
import { ActivityTypeBadge } from "@/components/activity-type-badge";
import { Dialog } from "@/components/dialog";
import { SkeletonActivityCard } from "@/components/skeleton";
type ActivityType = "QUIZ" | "POLL" | "WORD_CLOUD";
type Quiz = {
  id: string;
  title: string;
  type: ActivityType;
  _count: { questions: number };
};
export default function TeacherClient({ token }: { token: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>();
  const [errorCode, setErrorCode] = useState<ApiErrorCode | "">("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Quiz>();
  const [deletingId, setDeletingId] = useState<string>();
  const creating = useRef(false);
  const load = () =>
    api<Quiz[]>("/quizzes", {}, token)
      .then(setQuizzes)
      .catch((error) => setErrorCode(apiErrorCode(error)));
  useEffect(() => {
    api<Quiz[]>("/quizzes", {}, token)
      .then(setQuizzes)
      .catch((error) => setErrorCode(apiErrorCode(error)));
  }, [token]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quizTitle = title.trim();
    if (!quizTitle || !type) {
      setErrorCode("VALIDATION_ERROR");
      return;
    }
    if (creating.current || busy) return;
    creating.current = true;
    setBusy(true);
    setErrorCode("");
    try {
      await api<Quiz>(
        "/quizzes",
        { method: "POST", body: JSON.stringify({ title: quizTitle, type }) },
        token,
      );
      setTitle("");
      setType(undefined);
      await load();
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }
  async function start(quizId: string) {
    if (busy) return;
    setBusy(true);
    setErrorCode("");
    try {
      const created = await api<{ code: string }>(
        "/rooms",
        { method: "POST", body: JSON.stringify({ quizId }) },
        token,
      );
      router.push(`/teacher/room/${created.code}`);
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    } finally {
      setBusy(false);
    }
  }
  async function duplicate(quizId: string) {
    if (busy) return;
    setBusy(true);
    setErrorCode("");
    try {
      await api(
        `/quizzes/${quizId}/duplicate`,
        { method: "POST", body: JSON.stringify({}) },
        token,
      );
      await load();
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirming || deletingId) return;
    setDeletingId(confirming.id);
    setErrorCode("");
    try {
      await api(`/quizzes/${confirming.id}`, { method: "DELETE" }, token);
      setQuizzes((items) => items?.filter((quiz) => quiz.id !== confirming.id) ?? []);
      setConfirming(undefined);
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    } finally {
      setDeletingId(undefined);
    }
  }
  return (
    <main className="page-shell">
      <div className="page-content max-w-6xl">
        <h1 className="page-title">{t("quiz.myQuizzes")}</h1>
        <section className="filter-bar">
          {!type ? (
            <div className="grid divide-y divide-neutral-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {(
                [
                  ["QUIZ", QuestionMarkCircleIcon],
                  ["POLL", ChartBarIcon],
                  ["WORD_CLOUD", ChatBubbleLeftRightIcon],
                ] as const
              ).map(([activityType, Icon]) => (
                <button
                  key={activityType}
                  type="button"
                  onClick={() => setType(activityType)}
                  className="px-3 py-4 text-left transition-colors first:pl-0 hover:bg-white/60 sm:px-5 sm:first:pl-3"
                >
                  <Icon
                    className="h-7 w-7 text-neutral-700"
                    aria-hidden="true"
                  />
                  <strong className="mt-2 block text-base text-[#1d1d1f]">
                    {t(`activity.${activityType}.name`)}
                  </strong>
                  <span className="mt-1 block text-sm text-neutral-500">
                    {t(`activity.${activityType}.description`)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={create}
              noValidate
            >
              <label className="sr-only" htmlFor="quiz-title">
                {t("activity.title", { type: t(`activity.${type}.name`) })}
              </label>
              <input
                id="quiz-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("activity.title", {
                  type: t(`activity.${type}.name`),
                })}
                aria-invalid={errorCode === "VALIDATION_ERROR"}
                aria-describedby={
                  errorCode === "VALIDATION_ERROR"
                    ? "create-quiz-error"
                    : undefined
                }
                className="form-input mt-0 flex-1"
              />
              <button type="submit" disabled={busy} className="btn-primary">
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
                {busy ? t("common.loading") : t("common.create")}
              </button>
              <button
                type="button"
                onClick={() => setType(undefined)}
                className="btn-secondary"
              >
                {t("common.back")}
              </button>
            </form>
          )}
          {errorCode && (
            <p id="create-quiz-error" role="alert" className="alert-error mt-4">
              {t(`errors.${errorCode}`)}
            </p>
          )}
        </section>
        <ul className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200 bg-white/55">
          {!quizzes ? (
            <>
              <li className="py-5"><SkeletonActivityCard /></li>
              <li className="py-5"><SkeletonActivityCard /></li>
            </>
          ) : quizzes.length ? (
            quizzes.map((quiz) => (
              <li
                key={quiz.id}
                className="flex flex-col gap-4 px-1 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg font-semibold text-[#1d1d1f]">
                      {quiz.title}
                    </strong>
                    <ActivityTypeBadge type={quiz.type} />
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    {quiz.type === "WORD_CLOUD"
                      ? quiz._count.questions
                        ? t("wordCloud.prompts")
                        : t("wordCloud.promptNotConfigured")
                      : `${quiz._count.questions} ${t("quiz.questions")}`}
                  </span>
                  {!quiz._count.questions && (
                    <span
                      id={`open-room-hint-${quiz.id}`}
                      className="mt-1 block text-sm text-amber-800"
                    >
                      {quiz.type === "WORD_CLOUD"
                        ? t("wordCloud.promptNotConfigured")
                        : t("quiz.addQuestionBeforeRoom")}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={`/teacher/quiz/${quiz.id}`}
                    className="btn-secondary"
                  >
                    <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                    {t("common.edit")}
                  </a>
                  <button
                    disabled={
                      busy || Boolean(deletingId) || !quiz._count.questions
                    }
                    aria-describedby={
                      !quiz._count.questions
                        ? `open-room-hint-${quiz.id}`
                        : undefined
                    }
                    onClick={() => start(quiz.id)}
                    className="btn-primary"
                  >
                    <PlayIcon className="h-5 w-5" aria-hidden="true" />
                    {t("quiz.openRoom")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || Boolean(deletingId)}
                    onClick={() => void duplicate(quiz.id)}
                    className="btn-secondary"
                  >
                    <DocumentDuplicateIcon
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                    {t("common.duplicate")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || Boolean(deletingId)}
                    onClick={() => setConfirming(quiz)}
                    className="btn-danger-ghost"
                  >
                    <TrashIcon className="h-5 w-5" aria-hidden="true" />
                    {t("common.delete")}
                  </button>
                </span>
              </li>
            ))
          ) : (
            <li className="empty-state border-x-0 border-t-0">
              {t("quiz.quizEmpty")}
            </li>
          )}
        </ul>
        {confirming && (
          <Dialog
            labelledBy="delete-activity-title"
            describedBy="delete-activity-message"
            onClose={() => setConfirming(undefined)}
          >
            <div className="panel">
              <h2
                id="delete-activity-title"
                className="section-title"
              >
                {t("teacher.deleteActivityTitle")}
              </h2>
              <p id="delete-activity-message" className="mt-2 text-slate-600">
                {t("teacher.deleteActivityWarning")}
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  autoFocus
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
                  className="btn-danger"
                >
                  <TrashIcon className="h-5 w-5" aria-hidden="true" />
                  {deletingId
                    ? t("teacher.deletingActivity")
                    : t("teacher.deleteActivity")}
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </div>
    </main>
  );
}
