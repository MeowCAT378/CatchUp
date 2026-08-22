"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
import { SkeletonResults } from "@/components/skeleton";
import {
  api,
  apiErrorCode,
  ApiError,
  secureApi,
  type ApiErrorCode,
} from "@/lib/api";

type Results = {
  room: {
    code: string;
    quizTitle: string;
    phase: string;
    activityType: "QUIZ" | "POLL" | "WORD_CLOUD";
    id: string;
    status: string;
    createdAt: string;
    startedAt: string | null;
    endedAt: string | null;
    teacher: { id: string; name: string | null; email: string };
  };
  summary: {
    totalParticipants: number;
    totalSubmittedAnswers: number;
    completionRate: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
  };
  questions: {
    id: string;
    text: string;
    responseCount: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    correctPercentage: number;
    distribution: {
      choiceId: string;
      text: string;
      count: number;
      isCorrect?: boolean;
    }[];
    words: { text: string; submissionCount: number; voteCount: number }[];
  }[];
  participants: {
    name: string;
    score: number;
    rank: number;
    answeredCount: number;
    correctCount: number;
    incorrectCount: number;
  }[];
  responses: {
    participant: string;
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    correct: boolean | null;
    scoreAwarded: number;
    submittedAt: string;
  }[];
};

export default function ResultsClient({
  token,
  code,
  sessionId,
  backHref,
}: {
  token?: string;
  code?: string;
  sessionId?: string;
  backHref?: string;
}) {
  const { t } = useTranslation();
  const [results, setResults] = useState<Results>();
  const [errorCode, setErrorCode] = useState<ApiErrorCode | "">("");
  const [downloading, setDownloading] = useState("");
  const path = sessionId
    ? `/rooms/history/${sessionId}`
    : `/rooms/${code}/results`;
  const getResults = useCallback(
    () =>
      sessionId ? secureApi<Results>(path) : api<Results>(path, {}, token),
    [path, sessionId, token],
  );
  const load = async () => {
    setErrorCode("");
    try {
      setResults(await getResults());
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    }
  };
  useEffect(() => {
    getResults()
      .then(setResults)
      .catch((error) => setErrorCode(apiErrorCode(error)));
  }, [getResults]);
  async function download(format: "csv" | "xlsx") {
    if (downloading) return;
    setDownloading(format);
    setErrorCode("");
    try {
      const response = await fetch(
        sessionId
          ? `/api/catchup/rooms/history/${sessionId}/export.${format}`
          : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/rooms/${code}/results/export.${format}`,
        sessionId ? {} : { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new ApiError(body?.error?.code ?? "REQUEST_FAILED");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = sessionId
        ? `catchup-session-${sessionId}.${format}`
        : `catchup-${code}-results.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorCode(apiErrorCode(error));
    } finally {
      setDownloading("");
    }
  }
  if (errorCode && !results)
    return (
      <main className="page-shell">
        <div className="page-content">
          <BackButton href={backHref ?? `/teacher/room/${code}`} />
          <p role="alert" className="alert-error mt-4">
            {t(`errors.${errorCode}`)}
          </p>
          <button onClick={() => void load()} className="btn-secondary mt-3">
            <ArrowPathIcon className="h-5 w-5" aria-hidden="true" />
            {t("common.retry")}
          </button>
        </div>
      </main>
    );
  if (!results)
    return (
      <main className="page-shell">
        <div className="page-content">
          <BackButton href={backHref ?? `/teacher/room/${code}`} />
          <div aria-busy="true"><SkeletonResults /></div>
        </div>
      </main>
    );
  const cards = [
    [t("results.participants"), results.summary.totalParticipants],
    [t("results.answers"), results.summary.totalSubmittedAnswers],
    [t("results.completion"), `${results.summary.completionRate}%`],
    ...(results.room.activityType === "QUIZ"
      ? [
          [t("results.averageScore"), results.summary.averageScore],
          [
            t("results.highLow"),
            `${results.summary.highestScore} / ${results.summary.lowestScore}`,
          ],
        ]
      : []),
  ];
  return (
    <main className="page-shell">
      <div className="page-content max-w-6xl">
        <BackButton href={backHref ?? `/teacher/room/${code}`} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">
            <ChartBarIcon
              className="mr-2 inline h-6 w-6 text-sky-700"
              aria-hidden="true"
            />
            {results.room.quizTitle} {t("results.results")}
          </h1>
          <span className="flex gap-2">
            <button
              disabled={!!downloading}
              onClick={() => void download("csv")}
              className="btn-secondary"
            >
              <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
              {downloading === "csv"
                ? t("results.preparing")
                : t("results.downloadCsv")}
            </button>
            <button
              disabled={!!downloading}
              onClick={() => void download("xlsx")}
              className="btn-primary"
            >
              <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
              {downloading === "xlsx"
                ? t("results.preparing")
                : t("results.downloadXlsx")}
            </button>
          </span>
        </div>
        {errorCode && (
          <p role="alert" className="alert-error mt-3">
            {t(`errors.${errorCode}`)}
          </p>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map(([label, value]) => (
            <div key={String(label)} className="soft-card">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        {sessionId && (
          <dl className="panel mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-500">{t("history.teacher")}</dt>
              <dd className="font-semibold">
                {results.room.teacher.name ?? results.room.teacher.email}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">
                {t("history.startedAt")}
              </dt>
              <dd>
                {results.room.startedAt
                  ? new Date(results.room.startedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">{t("history.endedAt")}</dt>
              <dd>
                {results.room.endedAt
                  ? new Date(results.room.endedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        )}
        <section className="panel mt-8">
          <h2 className="text-xl font-bold">
            {t("results.questionAnalytics")}
          </h2>
          {results.questions.length ? (
            results.questions.map((question, index) => (
              <article
                key={question.id}
                className="mt-4 rounded-xl border border-sky-100 p-5"
              >
                <h3 className="font-bold">
                  {t("results.questionNumber", { number: index + 1 })}:{" "}
                  {question.text}
                </h3>
                <p className="mt-2 text-sm">
                  {question.responseCount} {t("results.responses")} ·{" "}
                  {question.unansweredCount} {t("results.unanswered")}
                  {results.room.activityType === "QUIZ" && (
                    <>
                      {" "}
                      · {question.correctCount} {t("results.correct")} ·{" "}
                      {question.incorrectCount} {t("results.incorrect")} ·{" "}
                      {t("results.correctPercentage")}:{" "}
                      {question.correctPercentage}%
                    </>
                  )}
                </p>
                <h4 className="mt-4 font-medium">
                  {t(
                    results.room.activityType === "WORD_CLOUD"
                      ? "history.words"
                      : "results.answerDistribution",
                  )}
                </h4>
                <div className="mt-2 grid gap-2">
                  {results.room.activityType === "WORD_CLOUD"
                    ? question.words.map((word) => (
                        <div
                          key={word.text}
                          className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <span>{word.text}</span>
                          <span>
                            {word.submissionCount} {t("history.submissions")} ·{" "}
                            {word.voteCount} {t("history.votes")}
                          </span>
                        </div>
                      ))
                    : question.distribution.map((choice) => (
                        <div key={choice.choiceId}>
                          <div className="flex justify-between text-sm">
                            <span
                              className={
                                choice.isCorrect
                                  ? "font-bold text-emerald-700"
                                  : ""
                              }
                            >
                              {choice.text}
                            </span>
                            <span>{choice.count}</span>
                          </div>
                          <div className="h-2 rounded bg-slate-100">
                            <div
                              className="h-2 rounded bg-teal-500"
                              style={{
                                width: `${question.responseCount ? (choice.count / question.responseCount) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                </div>
              </article>
            ))
          ) : (
            <p className="mt-3 text-slate-500">{t("results.noQuestions")}</p>
          )}
        </section>
        {results.responses.length > 0 && (
          <section className="panel mt-8 overflow-x-auto">
            <h2 className="text-xl font-bold">{t("history.responses")}</h2>
            <table className="mt-3 min-w-full text-left">
              <thead>
                <tr className="border-b">
                  <th>{t("results.participant")}</th>
                  <th>{t("results.questionNumber", { number: "" })}</th>
                  <th>{t("results.answered")}</th>
                  {results.room.activityType === "QUIZ" && (
                    <th>{t("results.correct")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {results.responses.map((response, index) => (
                  <tr
                    key={`${response.participant}-${index}`}
                    className="border-b"
                  >
                    <td>{response.participant}</td>
                    <td>{response.question}</td>
                    <td>{response.selectedAnswer}</td>
                    {results.room.activityType === "QUIZ" && (
                      <td>
                        {response.correct
                          ? t("results.correct")
                          : t("results.incorrect")}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <section className="panel mt-8 overflow-x-auto">
          <h2 className="text-xl font-bold">
            {t("results.participantResults")}
          </h2>
          {results.participants.length ? (
            <table className="mt-3 min-w-full text-left">
              <thead>
                <tr className="border-b">
                  <th>{t("results.rank")}</th>
                  <th>{t("results.participant")}</th>
                  {results.room.activityType === "QUIZ" && (
                    <th>{t("results.score")}</th>
                  )}
                  <th>{t("results.answered")}</th>
                  {results.room.activityType === "QUIZ" && (
                    <th>{t("results.correct")}</th>
                  )}
                  {results.room.activityType === "QUIZ" && (
                    <th>{t("results.incorrect")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {results.participants.map((participant) => (
                  <tr
                    key={`${participant.rank}-${participant.name}`}
                    className="border-b"
                  >
                    <td>{participant.rank}</td>
                    <td>{participant.name}</td>
                    {results.room.activityType === "QUIZ" && (
                      <td>{participant.score}</td>
                    )}
                    <td>{participant.answeredCount}</td>
                    {results.room.activityType === "QUIZ" && (
                      <td>{participant.correctCount}</td>
                    )}
                    {results.room.activityType === "QUIZ" && (
                      <td>{participant.incorrectCount}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-3 text-slate-500">{t("results.noParticipants")}</p>
          )}
        </section>
      </div>
    </main>
  );
}
