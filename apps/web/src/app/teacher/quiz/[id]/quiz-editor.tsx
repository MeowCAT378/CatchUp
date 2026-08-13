"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
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
  return (
    <main className="page-shell">
      <div className="page-content max-w-3xl">
        <BackButton href="/teacher" />
        <h1 className="mt-4 text-4xl font-black text-slate-900">
          {quiz?.title ?? t("quiz.quizEditor")}
        </h1>
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">{t("quiz.addQuestion")}</h2>
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
          {quiz?.type === "QUIZ" && <p className="mt-3 flex items-center gap-1 text-sm text-emerald-700">
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
                  <strong className="text-lg text-slate-900">
                    {question.text}
                  </strong>
                  {quiz.type !== "WORD_CLOUD" && <ul className="mt-3 grid gap-2">
                    {question.choices.map((choice) => (
                      <li
                        key={choice.id}
                        className={
                          quiz.type === "QUIZ" && choice.isCorrect
                            ? "rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900"
                            : "rounded-xl bg-sky-50 px-3 py-2"
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
      </div>
    </main>
  );
}
