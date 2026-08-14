"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
import { ActivityTypeBadge } from "@/components/activity-type-badge";
import { api, ApiError } from "@/lib/api";

type Quiz = {
  title: string;
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
  const [text, setText] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const load = async () => {
    try {
      setQuiz(await api<Quiz>(`/quizzes/${quizId}`, {}, token));
    } catch (e) {
      setError(
        t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`),
      );
    }
  };
  useEffect(() => {
    void load();
  }, [quizId, token]);
  async function add() {
    const needsChoices = quiz?.type !== "WORD_CLOUD";
    if (!text.trim() || (needsChoices && choices.some((choice) => !choice.trim())) || saving)
      return;
    setSaving(true);
    setError("");
    try {
      await api(
        `/quizzes/${quizId}/questions`,
        {
          method: "POST",
          body: JSON.stringify({
            text,
            choices: needsChoices ? choices.map((choice, index) => ({
              text: choice,
              isCorrect: quiz?.type === "QUIZ" && index === correctIndex,
            })) : [],
          }),
        },
        token,
      );
      setText("");
      setChoices(["", "", "", ""]);
      setCorrectIndex(0);
      await load();
    } catch (e) {
      setError(
        t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`),
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove(questionId: string) {
    if (deleting) return;
    setDeleting(questionId);
    setError("");
    try {
      await api(`/quizzes/questions/${questionId}`, { method: "DELETE" }, token);
      await load();
      setConfirming(undefined);
    } catch (e) {
      setError(t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`));
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
        {quiz && <div className="mt-3"><ActivityTypeBadge type={quiz.type} /></div>}
        <section className="panel mt-6">
          <h2 className="text-xl font-semibold">{t("quiz.addQuestion")}</h2>
          <label
            className="mt-4 block text-sm font-semibold"
            htmlFor="question-text"
          >
            {t("quiz.questionText")}
          </label>
          <input
            id="question-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("quiz.questionText")}
            className="form-input"
          />
          {choices.map((choice, index) => (
            quiz?.type !== "WORD_CLOUD" &&
            <div key={index} className="mt-3 flex items-center gap-3">
              {quiz?.type === "QUIZ" && <input
                aria-label={t("quiz.markCorrect")}
                checked={correctIndex === index}
                onChange={() => setCorrectIndex(index)}
                type="radio"
                name="correct-choice"
                className="size-5 accent-emerald-600"
              />}
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
                placeholder={t("quiz.choiceNumber", { number: index + 1 })}
                className="form-input mt-0"
              />
            </div>
          ))}
          {quiz?.type === "QUIZ" && <p className="mt-3 flex items-center gap-1 text-sm text-neutral-500">
            <CheckIcon className="h-4 w-4" aria-hidden="true" />
            {t("quiz.markCorrect")}
          </p>}
          <button
            onClick={add}
            disabled={
              saving || !text.trim() || (quiz?.type !== "WORD_CLOUD" && choices.some((choice) => !choice.trim()))
            }
            className="btn-primary mt-5"
          >
            <PlusIcon className="h-5 w-5" aria-hidden="true" />
            {saving ? t("quiz.saving") : t("quiz.addQuestion")}
          </button>
          {error && (
            <p role="alert" className="alert-error mt-4">
              {error}
            </p>
          )}
        </section>
        {!quiz ? (
          <p className="mt-6">{t("common.loading")}</p>
        ) : (
          <ol className="mt-6 grid gap-4">
            {quiz.questions.length ? (
              quiz.questions.map((question) => (
                <li key={question.id} className="soft-card">
                  <div className="flex items-start justify-between gap-3"><strong className="text-lg font-semibold text-[#1d1d1f]">{question.text}</strong><button type="button" disabled={Boolean(deleting)} onClick={() => setConfirming(question.id)} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><TrashIcon className="h-5 w-5" aria-hidden="true" />{t("quiz.deleteQuestion")}</button></div>
                  {quiz.type !== "WORD_CLOUD" && <ul className="mt-3 grid gap-2">
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
                        {quiz.type === "QUIZ" && choice.isCorrect ? ` (${t("quiz.correct")})` : ""}
                      </li>
                    ))}
                  </ul>}
                </li>
              ))
            ) : (
              <li className="panel text-slate-500">
                {t("quiz.questionEmpty")}
              </li>
            )}
          </ol>
        )}
        {confirming && <div role="dialog" aria-modal="true" className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-4"><div className="panel max-w-sm"><p className="font-semibold text-slate-900">{t("teacher.deleteQuestionConfirm")}</p><p className="mt-2 text-sm text-slate-600">{t("teacher.deleteQuestionWarning")}</p><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setConfirming(undefined)} className="btn-secondary">{t("common.cancel")}</button><button type="button" disabled={Boolean(deleting)} onClick={() => { void remove(confirming); }} className="inline-flex min-h-11 items-center rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"><TrashIcon className="h-5 w-5" aria-hidden="true" />{t("quiz.deleteQuestion")}</button></div></div></div>}
      </div>
    </main>
  );
}
