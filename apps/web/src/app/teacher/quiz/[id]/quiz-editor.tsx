"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
import { ActivityTypeBadge } from "@/components/activity-type-badge";
import { api, apiErrorCode, type ApiErrorCode } from "@/lib/api";
import { SkeletonText } from "@/components/skeleton";

type Quiz = {
  title: string;
  description?: string;
  type: "QUIZ" | "POLL" | "WORD_CLOUD";
  questions: {
    id: string;
    text: string;
    choices: { id: string; text: string; isCorrect: boolean }[];
  }[];
};

export default function QuizEditor({
  token,
  quizId,
}: {
  token: string;
  quizId: string;
}) {
  const { t } = useTranslation();
  const [quiz, setQuiz] = useState<Quiz>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [errorCode, setErrorCode] = useState<ApiErrorCode | "">("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const isWordCloud = quiz?.type === "WORD_CLOUD";
  const canAddPrompt =
    !isWordCloud || Boolean(editingId) || !quiz?.questions.length;
  const load = async () => {
    try {
      const loaded = await api<Quiz>(`/quizzes/${quizId}`, {}, token);
      setQuiz(loaded);
      setTitle(loaded.title);
      setDescription(loaded.description ?? "");
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    }
  };
  useEffect(() => {
    api<Quiz>(`/quizzes/${quizId}`, {}, token)
      .then((loaded) => {
        setQuiz(loaded);
        setTitle(loaded.title);
        setDescription(loaded.description ?? "");
      })
      .catch((error) => setErrorCode(apiErrorCode(error)));
  }, [quizId, token]);
  async function saveMetadata() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setErrorCode("");
    try {
      await api(
        `/quizzes/${quizId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
          }),
        },
        token,
      );
      setQuiz(
        (current) =>
          current && {
            ...current,
            title: title.trim(),
            description: description.trim(),
          },
      );
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    } finally {
      setSaving(false);
    }
  }
  async function saveQuestion() {
    const needsChoices = quiz?.type !== "WORD_CLOUD";
    if (
      !text.trim() ||
      (needsChoices && choices.some((choice) => !choice.trim())) ||
      saving
    )
      return;
    setSaving(true);
    setErrorCode("");
    try {
      await api(
        editingId
          ? `/quizzes/questions/${editingId}`
          : `/quizzes/${quizId}/questions`,
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({
            text,
            choices: needsChoices
              ? choices.map((choice, index) => ({
                  text: choice,
                  isCorrect: quiz?.type === "QUIZ" && index === correctIndex,
                }))
              : [],
          }),
        },
        token,
      );
      setText("");
      setChoices(["", "", "", ""]);
      setCorrectIndex(0);
      setEditingId(undefined);
      await load();
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    } finally {
      setSaving(false);
    }
  }
  function edit(question: Quiz["questions"][number]) {
    setEditingId(question.id);
    setText(question.text);
    setChoices(question.choices.map((choice) => choice.text));
    setCorrectIndex(
      Math.max(
        0,
        question.choices.findIndex((choice) => choice.isCorrect),
      ),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() {
    setEditingId(undefined);
    setText("");
    setChoices(["", "", "", ""]);
    setCorrectIndex(0);
  }
  async function remove(questionId: string) {
    if (deleting) return;
    setDeleting(questionId);
    setErrorCode("");
    try {
      await api(
        `/quizzes/questions/${questionId}`,
        { method: "DELETE" },
        token,
      );
      if (editingId === questionId) cancelEdit();
      await load();
      setConfirming(undefined);
    } catch (error) {
      setErrorCode(apiErrorCode(error));
      setConfirming(undefined);
    } finally {
      setDeleting(undefined);
    }
  }
  return (
    <main className="page-shell">
      <div className="page-content max-w-3xl">
        <BackButton href="/teacher" />
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-5xl">
          {quiz?.title ?? t("quiz.quizEditor")}
        </h1>
        {quiz && (
          <div className="mt-3">
            <ActivityTypeBadge type={quiz.type} />
          </div>
        )}
        {quiz && errorCode && (
          <p role="alert" className="alert-error mt-4">
            {t(`errors.${errorCode}`)}
          </p>
        )}
        {quiz && (
          <section className="panel mt-6">
            <label className="block text-sm font-semibold" htmlFor="quiz-title">
              {t("quiz.quizTitle")}
            </label>
            <input
              id="quiz-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="form-input"
            />
            <label
              className="mt-4 block text-sm font-semibold"
              htmlFor="quiz-description"
            >
              {t("quiz.description")}
            </label>
            <textarea
              id="quiz-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="form-input min-h-24"
            />
            <button
              type="button"
              onClick={() => void saveMetadata()}
              disabled={saving || !title.trim()}
              className="btn-primary mt-5"
            >
              <CheckIcon className="h-5 w-5" aria-hidden="true" />
              {saving ? t("quiz.saving") : t("common.save")}
            </button>
          </section>
        )}
        {quiz && canAddPrompt && (
          <section className="panel mt-6">
            <h2 className="text-xl font-semibold">
              {editingId
                ? t("common.edit")
                : isWordCloud
                  ? t("wordCloud.prompt")
                  : t("quiz.addQuestion")}
            </h2>
            <label
              className="mt-4 block text-sm font-semibold"
              htmlFor="question-text"
            >
              {isWordCloud ? t("wordCloud.prompt") : t("quiz.questionText")}
            </label>
            <input
              id="question-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                isWordCloud ? t("wordCloud.prompt") : t("quiz.questionText")
              }
              className="form-input"
            />
            {choices.map(
              (choice, index) =>
                quiz?.type !== "WORD_CLOUD" && (
                  <div key={index} className="mt-3 flex items-center gap-3">
                    {quiz?.type === "QUIZ" && (
                      <input
                        aria-label={t("quiz.markCorrect")}
                        checked={correctIndex === index}
                        onChange={() => setCorrectIndex(index)}
                        type="radio"
                        name="correct-choice"
                        className="size-5 accent-emerald-600"
                      />
                    )}
                    <label className="sr-only" htmlFor={`choice-${index}`}>
                      {t("quiz.choiceNumber", { number: index + 1 })}
                    </label>
                    <input
                      id={`choice-${index}`}
                      value={choice}
                      onChange={(e) =>
                        setChoices(
                          choices.map((item, i) =>
                            i === index ? e.target.value : item,
                          ),
                        )
                      }
                      placeholder={t("quiz.choiceNumber", {
                        number: index + 1,
                      })}
                      className="form-input mt-0"
                    />
                  </div>
                ),
            )}
            {quiz?.type === "QUIZ" && (
              <p className="mt-3 flex items-center gap-1 text-sm text-neutral-500">
                <CheckIcon className="h-4 w-4" aria-hidden="true" />
                {t("quiz.markCorrect")}
              </p>
            )}
            <button
              onClick={saveQuestion}
              disabled={
                saving ||
                !text.trim() ||
                (quiz?.type !== "WORD_CLOUD" &&
                  choices.some((choice) => !choice.trim()))
              }
              className="btn-primary mt-5"
            >
              <PlusIcon className="h-5 w-5" aria-hidden="true" />
              {saving
                ? t("quiz.saving")
                : editingId
                  ? t("common.save")
                  : isWordCloud
                    ? t("wordCloud.prompt")
                    : t("quiz.addQuestion")}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="btn-secondary mt-5 ml-3"
              >
                {t("common.cancel")}
              </button>
            )}
          </section>
        )}
        {!quiz ? (
          errorCode ? (
            <p role="alert" className="alert-error mt-6">
              {t(`errors.${errorCode}`)}
            </p>
          ) : (
            <div className="panel mt-6" aria-busy="true"><SkeletonText className="w-1/2" /><SkeletonText className="mt-5" /><SkeletonText className="mt-3 w-4/5" /></div>
          )
        ) : (
          <ol className="mt-6 grid gap-4">
            {quiz.questions.length ? (
              quiz.questions.map((question) => (
                <li key={question.id} className="soft-card">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-lg font-semibold text-[#1d1d1f]">
                      {question.text}
                    </strong>
                    <span className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={Boolean(deleting)}
                        onClick={() => edit(question)}
                        className="btn-secondary min-h-11 px-3 py-1 text-sm"
                      >
                        <PencilSquareIcon
                          className="h-5 w-5"
                          aria-hidden="true"
                        />
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(deleting)}
                        onClick={() => setConfirming(question.id)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <TrashIcon className="h-5 w-5" aria-hidden="true" />
                        {t("quiz.deleteQuestion")}
                      </button>
                    </span>
                  </div>
                  {quiz.type !== "WORD_CLOUD" && (
                    <ul className="mt-3 grid gap-2">
                      {question.choices.map((choice) => (
                        <li
                          key={choice.id}
                          className={
                            quiz.type === "QUIZ" && choice.isCorrect
                              ? "rounded-xl bg-neutral-200 px-3 py-2 text-[#1d1d1f]"
                              : "rounded-xl bg-neutral-100 px-3 py-2"
                          }
                        >
                          {choice.text}
                          {quiz.type === "QUIZ" && choice.isCorrect
                            ? ` (${t("quiz.correct")})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))
            ) : (
              <li className="panel text-slate-500">
                {isWordCloud
                  ? t("wordCloud.promptNotConfigured")
                  : t("quiz.questionEmpty")}
              </li>
            )}
          </ol>
        )}
        {confirming && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-4"
          >
            <div className="panel max-w-sm">
              <p className="font-semibold text-slate-900">
                {t("teacher.deleteQuestionConfirm")}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {t("teacher.deleteQuestionWarning")}
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(undefined)}
                  className="btn-secondary"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  disabled={Boolean(deleting)}
                  onClick={() => {
                    void remove(confirming);
                  }}
                  className="inline-flex min-h-11 items-center rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <TrashIcon className="h-5 w-5" aria-hidden="true" />
                  {t("quiz.deleteQuestion")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
