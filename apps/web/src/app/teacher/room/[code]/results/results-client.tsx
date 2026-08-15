"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
import { api, ApiError } from "@/lib/api";

type Results = {
  room: { code: string; quizTitle: string; phase: string };
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
  }[];
  participants: {
    name: string;
    score: number;
    rank: number;
    answeredCount: number;
    correctCount: number;
    incorrectCount: number;
  }[];
};

export default function ResultsClient({
  token,
  code,
}: {
  token: string;
  code: string;
}) {
  const { t } = useTranslation();
  const [results, setResults] = useState<Results>();
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const message = (e: unknown) =>
    t(`errors.${e instanceof ApiError ? e.code : "REQUEST_FAILED"}`);
  const load = async () => {
    setError("");
    try {
      setResults(await api<Results>(`/rooms/${code}/results`, {}, token));
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    void load();
  }, [code, token]);
  async function download(format: "csv" | "xlsx") {
    if (downloading) return;
    setDownloading(format);
    setError("");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/rooms/${code}/results/export.${format}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new ApiError(body?.error?.code ?? "REQUEST_FAILED");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `catchup-${code}-results.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(message(e));
    } finally {
      setDownloading("");
    }
  }
  if (error && !results)
    return (
      <main className="page-shell">
        <div className="page-content">
          <BackButton href={`/teacher/room/${code}`} />
          <p role="alert" className="alert-error mt-4">
            {error}
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
          <BackButton href={`/teacher/room/${code}`} />
          <p className="mt-4">{t("results.loading")}</p>
        </div>
      </main>
    );
  const cards = [
    [t("results.participants"), results.summary.totalParticipants],
    [t("results.answers"), results.summary.totalSubmittedAnswers],
    [t("results.completion"), `${results.summary.completionRate}%`],
    [t("results.averageScore"), results.summary.averageScore],
    [
      t("results.highLow"),
      `${results.summary.highestScore} / ${results.summary.lowestScore}`,
    ],
  ];
  return (
    <main className="page-shell">
      <div className="page-content max-w-6xl">
        <BackButton href={`/teacher/room/${code}`} />
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
        {error && (
          <p role="alert" className="alert-error mt-3">
            {error}
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
                  {question.correctCount} {t("results.correct")} ·{" "}
                  {question.incorrectCount} {t("results.incorrect")} ·{" "}
                  {question.unansweredCount} {t("results.unanswered")} ·{" "}
                  {t("results.correctPercentage")}: {question.correctPercentage}
                  %
                </p>
                <h4 className="mt-4 font-medium">
                  {t("results.answerDistribution")}
                </h4>
                <div className="mt-2 grid gap-2">
                  {question.distribution.map((choice) => (
                    <div key={choice.choiceId}>
                      <div className="flex justify-between text-sm">
                        <span
                          className={
                            choice.isCorrect ? "font-bold text-emerald-700" : ""
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
                  <th>{t("results.score")}</th>
                  <th>{t("results.answered")}</th>
                  <th>{t("results.correct")}</th>
                  <th>{t("results.incorrect")}</th>
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
                    <td>{participant.score}</td>
                    <td>{participant.answeredCount}</td>
                    <td>{participant.correctCount}</td>
                    <td>{participant.incorrectCount}</td>
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
