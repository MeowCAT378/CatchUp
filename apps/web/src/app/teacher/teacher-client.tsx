"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PencilSquareIcon,
  PlayIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { api, ApiError } from "@/lib/api";
type Quiz = { id: string; title: string; _count: { questions: number } };
export default function TeacherClient({ token }: { token: string }) {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (!quizTitle) {
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
        { method: "POST", body: JSON.stringify({ title: quizTitle }) },
        token,
      );
      setTitle("");
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
  return (
    <main className="page-shell">
      <div className="page-content max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="badge">CatchUp</p>
            <h1 className="mt-3 text-4xl font-black text-slate-900">
              {t("quiz.myQuizzes")}
            </h1>
          </div>
        </div>
        <section className="panel mt-7">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={create} noValidate>
            <label className="sr-only" htmlFor="quiz-title">
              {t("quiz.newQuiz")}
            </label>
            <input
              id="quiz-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("quiz.newQuiz")}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "create-quiz-error" : undefined}
              className="form-input mt-0 flex-1"
            />
            <button type="submit" disabled={busy} className="btn-primary">
              <PlusIcon className="h-5 w-5" aria-hidden="true" />
              {busy ? t("common.loading") : t("common.create")}
            </button>
          </form>
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
                    disabled={busy}
                    onClick={() => start(quiz.id)}
                    className="btn-primary"
                  >
                    <PlayIcon className="h-5 w-5" aria-hidden="true" />
                    {t("quiz.openRoom")}
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
      </div>
    </main>
  );
}
