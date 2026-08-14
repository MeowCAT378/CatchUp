"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChartBarIcon, CheckIcon, HeartIcon } from "@heroicons/react/24/outline";
import { api, type ApiErrorCode } from "@/lib/api";
import { clearParticipant, participantFor } from "@/lib/participant";
import { RoomEvents, roomSocket } from "@/lib/room-socket";
import { WordCloudResults } from "@/components/word-cloud-results";
type State = {
  phase: string;
  activityType: "QUIZ" | "POLL" | "WORD_CLOUD";
  question: null | {
    text: string;
    position: number;
    total: number;
    choices: { id: string; text: string }[];
    entries: { id: string; text: string; votes: number; voted: boolean; rank: number }[];
    totalVotes: number;
  };
  answerSubmitted: boolean;
};
type Result = {
  leaderboard: { rank: number; displayName: string; score: number }[];
};
export default function Play({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const socket = useRef<ReturnType<typeof roomSocket> | null>(null);
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>();
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [word, setWord] = useState("");
  useEffect(() => {
    params.then(async ({ code }) => {
      const participant = participantFor(code);
      if (!participant) return router.replace(`/join?code=${code}`);
      setCode(code);
      try {
        setState(
          await api<State>(
            `/rooms/${code}?participantId=${participant.id}&participantToken=${participant.token}`,
          ),
        );
      } catch {
        clearParticipant(code);
        return router.replace(`/join?code=${code}`);
      }
      socket.current = roomSocket();
      socket.current.on("connect", () =>
        socket.current?.emit(RoomEvents.join, {
          code,
          participantId: participant.id,
          participantToken: participant.token,
        }),
      );
      socket.current.on(RoomEvents.state, (next: State) => {
        setState(next);
        setSubmitting(false);
      });
      socket.current.on(RoomEvents.questionStarted, setState);
      socket.current.on(RoomEvents.quizStarted, setState);
      socket.current.on(RoomEvents.questionRevealed, setState);
      socket.current.on(RoomEvents.wordCloudUpdated, (next: State) => {
        setState(next);
        setSubmitting(false);
      });
      socket.current.on(RoomEvents.leaderboardUpdated, setResult);
      socket.current.on(RoomEvents.quizCompleted, setResult);
      socket.current.on(RoomEvents.error, (x: { code?: ApiErrorCode }) => {
        const errorCode = x.code ?? "REQUEST_FAILED";
        setError(t(`errors.${errorCode}`));
        setSubmitting(false);
        if (errorCode === "PARTICIPANT_NOT_FOUND") {
          clearParticipant(code);
          router.replace(`/join?code=${code}`);
        }
      });
    });
    return () => {
      socket.current?.disconnect();
    };
  }, [router, t]);
  const answer = (choiceId: string) => {
    const participant = participantFor(code);
    if (!participant || submitting) return;
    setSubmitting(true);
    socket.current?.emit(RoomEvents.answerSubmit, {
      code,
      participantId: participant.id,
      participantToken: participant.token,
      choiceId,
    });
  };
  const wordAction = (event: string, value: Record<string, string>) => {
    const participant = participantFor(code);
    if (!participant || submitting) return;
    setSubmitting(true);
    socket.current?.emit(event, { code, participantId: participant.id, participantToken: participant.token, ...value });
    if (event === RoomEvents.wordCloudSubmit) setWord("");
  };
  return (
    <main className="page-shell">
      <div className="page-content max-w-3xl">
        <p className="badge">
          {t("common.roomCode")} {code}
        </p>
        {state?.phase === "WAITING" && (
          <section className="panel mt-6 text-center text-xl font-semibold text-slate-700">
            {t("player.waitingForHost")}
          </section>
        )}
        {state?.question && state.phase === "COMPLETED" && state.activityType === "WORD_CLOUD" ? (
          <section className="panel mt-6">
            <h1 className="text-center text-3xl font-black text-slate-900 sm:text-5xl">{t("wordCloud.results")}</h1>
            <p className="mt-3 text-center text-lg font-semibold text-slate-700">{state.question.text}</p>
            <WordCloudResults entries={state.question.entries} totalVotes={state.question.totalVotes} emptyLabel={t("wordCloud.noEntries")} votesLabel={t("wordCloud.votes")} totalVotesLabel={t("wordCloud.totalVotes")} className="mt-6" />
          </section>
        ) : state?.question && (
          <section className="panel mt-6">
            <p className="font-semibold text-sky-700">
              {state.question.position} / {state.question.total}
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900 sm:text-5xl">
              {state.question.text}
            </h1>
            {state.phase === "ACTIVE" && state.activityType !== "WORD_CLOUD" && (
              <div className="mt-7 grid gap-3">
                {state.question.choices.map((choice) => (
                  <button
                    disabled={state.answerSubmitted || submitting}
                    key={choice.id}
                    onClick={() => answer(choice.id)}
                    className="min-h-16 rounded-2xl border border-sky-200 bg-white p-5 text-left text-lg font-bold shadow-sm transition hover:border-sky-400 hover:bg-sky-50 disabled:opacity-50"
                  >
                    {choice.text}
                  </button>
                ))}
              </div>
            )}
            {state.phase === "ACTIVE" && state.activityType === "WORD_CLOUD" && (
              <div className="mt-7">
                <div className="flex gap-3">
                  <input value={word} maxLength={30} onChange={(e) => setWord(e.target.value)} className="form-input mt-0 flex-1" placeholder={t("wordCloud.addResponse")} />
                  <button disabled={!word.trim() || submitting} onClick={() => wordAction(RoomEvents.wordCloudSubmit, { text: word })} className="btn-primary">{t("wordCloud.addResponse")}</button>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {state.question.entries.map((entry) => (
                    <button key={entry.id} disabled={entry.voted || submitting} onClick={() => wordAction(RoomEvents.wordCloudVote, { entryId: entry.id })} style={{ fontSize: `${18 + (46 * entry.votes) / Math.max(1, ...state.question!.entries.map((x) => x.votes))}px` }} className="rounded-2xl bg-sky-50 px-4 py-3 font-bold text-slate-900 disabled:opacity-50">
                      {entry.text} <HeartIcon className="inline h-5 w-5" aria-hidden="true" /> {entry.votes}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {state.answerSubmitted && (
              <p className="mt-5 rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">
                <CheckIcon className="mr-1 inline h-5 w-5" aria-hidden="true" />
                {t("player.answerRecorded")}
              </p>
            )}
          </section>
        )}
        {result && state?.activityType !== "WORD_CLOUD" && (
          <section className="panel mt-6">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <ChartBarIcon
                className="h-6 w-6 text-sky-700"
                aria-hidden="true"
              />
              {t("room.leaderboard")}
            </h2>
            <ol className="mt-4 grid gap-2">
              {result.leaderboard.map((x) => (
                <li
                  key={x.rank}
                  className="rounded-xl bg-sky-50 p-3 font-semibold"
                >
                  {x.rank}. {x.displayName}: {x.score}
                </li>
              ))}
            </ol>
          </section>
        )}
        {error && (
          <p role="alert" className="alert-error mt-5">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
