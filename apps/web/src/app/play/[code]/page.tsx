"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChartBarIcon, CheckIcon, HeartIcon } from "@heroicons/react/24/outline";
import { api, apiErrorCode, type ApiErrorCode } from "@/lib/api";
import { clearParticipant, participantFor, participantHeaders } from "@/lib/participant";
import { RoomEvents, roomSocket } from "@/lib/room-socket";
import { WordCloudResults, wordCloudFontSize } from "@/components/word-cloud-results";

type ActivityType = "QUIZ" | "POLL" | "WORD_CLOUD";
type Connection = "connected" | "reconnecting" | "disconnected";
type State = {
  phase: "WAITING" | "ACTIVE" | "REVEALED" | "COMPLETED";
  correctChoiceId?: string | null;
  selectedChoiceId?: string | null;
  wordSubmitted: boolean;
  activityType: ActivityType;
  question: null | {
    id: string;
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
  activityType?: ActivityType;
  leaderboard: { rank: number; displayName: string; score: number; isYou?: boolean }[];
  poll?: null | {
    questionId: string;
    text: string;
    responseCount: number;
    distribution: { id: string; text: string; count: number }[];
  };
};

const terminalParticipantError = (code: ApiErrorCode) =>
  code === "PARTICIPANT_NOT_FOUND" || code === "ROOM_NOT_FOUND";

function mergeWordCloudUpdate(current: State | undefined, next: State) {
  const merged = mergePrivateState(current, next);
  if (!current?.question || !merged.question || current.question.id !== merged.question.id)
    return merged;
  const voted = new Map(current.question.entries.map((entry) => [entry.id, entry.voted]));
  return {
    ...merged,
    question: {
      ...merged.question,
      entries: merged.question.entries.map((entry) => ({
        ...entry,
        voted: entry.voted || voted.get(entry.id) || false,
      })),
    },
  };
}

function mergePrivateState(current: State | undefined, next: State) {
  if (!current) return next;
  const sameQuestion = Boolean(
    current.question?.id && current.question.id === next.question?.id,
  );
  const completesCurrentQuestion = Boolean(
    next.phase === "COMPLETED" &&
      current.question?.id &&
      (!next.question || current.question.id === next.question.id),
  );
  if (!sameQuestion && !completesCurrentQuestion)
    return next;
  return {
    ...next,
    answerSubmitted: next.answerSubmitted || current.answerSubmitted,
    selectedChoiceId: next.selectedChoiceId ?? current.selectedChoiceId,
    wordSubmitted: next.wordSubmitted || current.wordSubmitted,
  };
}

function mergeParticipantState(current: State | undefined, next: State) {
  return next.activityType === "WORD_CLOUD"
    ? mergeWordCloudUpdate(current, next)
    : mergePrivateState(current, next);
}

export default function Play({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const socket = useRef<ReturnType<typeof roomSocket> | null>(null);
  const pendingWord = useRef("");
  const [state, setState] = useState<State>();
  const [result, setResult] = useState<Result>();
  const [errorCode, setErrorCode] = useState<ApiErrorCode | "">("");
  const [connection, setConnection] = useState<Connection>("reconnecting");
  const [loading, setLoading] = useState(true);
  const [resultLoading, setResultLoading] = useState(false);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [word, setWord] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let liveSocket: ReturnType<typeof roomSocket> | null = null;
    let activeQuestionId: string | null = null;
    let resultRequest = 0;
    const participant = participantFor(code);
    if (!participant) {
      router.replace(`/join?code=${code}`);
      return;
    }
    const headers = participantHeaders(participant);
    const resetPending = (restoreWord = false) => {
      if (restoreWord && pendingWord.current) setWord(pendingWord.current);
      pendingWord.current = "";
      setSubmitting(false);
    };
    const handleTerminalError = (nextCode: ApiErrorCode) => {
      if (!terminalParticipantError(nextCode)) return false;
      clearParticipant(code);
      router.replace(`/join?code=${code}`);
      return true;
    };
    const clearResult = () => {
      resultRequest += 1;
      setResult(undefined);
      setResultLoading(false);
    };
    const loadResult = async (
      expectedQuestionId: string | null,
      activityType: ActivityType,
    ) => {
      if (!expectedQuestionId) {
        clearResult();
        return;
      }
      const request = ++resultRequest;
      setResultLoading(true);
      try {
        const next = await api<Result>(`/rooms/${code}/result`, { headers });
        if (
          cancelled ||
          request !== resultRequest ||
          activeQuestionId !== expectedQuestionId
        ) return;
        if (
          activityType === "POLL" &&
          next.poll?.questionId !== expectedQuestionId
        ) {
          setResult(undefined);
          return;
        }
        setResult(next);
        setErrorCode("");
      } catch (error) {
        if (
          cancelled ||
          request !== resultRequest ||
          activeQuestionId !== expectedQuestionId
        ) return;
        const nextCode = apiErrorCode(error);
        if (!handleTerminalError(nextCode)) setErrorCode(nextCode);
      } finally {
        if (!cancelled && request === resultRequest) setResultLoading(false);
      }
    };
    const start = async () => {
      setLoading(true);
      setBootstrapFailed(false);
      setErrorCode("");
      setConnection("reconnecting");
      let initial: State;
      try {
        initial = await api<State>(`/rooms/${code}`, { headers });
      } catch (error) {
        if (cancelled) return;
        const nextCode = apiErrorCode(error);
        if (!handleTerminalError(nextCode)) {
          setErrorCode(nextCode);
          setBootstrapFailed(true);
          setConnection("disconnected");
        }
        setLoading(false);
        return;
      }
      if (cancelled) return;
      activeQuestionId = initial.question?.id ?? null;
      setState(initial);
      setLoading(false);
      if (initial.phase === "REVEALED" || initial.phase === "COMPLETED")
        void loadResult(activeQuestionId, initial.activityType);

      liveSocket = roomSocket();
      socket.current = liveSocket;
      liveSocket.on("connect", () => {
        setConnection("reconnecting");
        liveSocket?.emit(RoomEvents.join, {
          code,
          participantId: participant.id,
          participantToken: participant.token,
        });
      });
      liveSocket.on("disconnect", () => {
        setConnection("reconnecting");
        resetPending(true);
      });
      liveSocket.on("connect_error", () => {
        setConnection("disconnected");
        resetPending(true);
      });
      liveSocket.on(RoomEvents.state, (next: State) => {
        activeQuestionId = next.question?.id ?? null;
        setState((current) => mergeParticipantState(current, next));
        if (next.wordSubmitted) setWord("");
        setErrorCode("");
        setConnection("connected");
        resetPending();
        if (next.phase === "REVEALED" || next.phase === "COMPLETED")
          void loadResult(activeQuestionId, next.activityType);
        else clearResult();
      });
      const nextQuestion = (next: State) => {
        activeQuestionId = next.question?.id ?? null;
        setState(next);
        clearResult();
        setErrorCode("");
        setConnection("connected");
        resetPending();
      };
      liveSocket.on(RoomEvents.questionStarted, nextQuestion);
      liveSocket.on(RoomEvents.quizStarted, nextQuestion);
      liveSocket.on(RoomEvents.questionRevealed, (next: State) => {
        activeQuestionId = next.question?.id ?? null;
        setState((current) => mergeParticipantState(current, next));
        setErrorCode("");
        resetPending();
        void loadResult(activeQuestionId, next.activityType);
      });
      liveSocket.on(RoomEvents.wordCloudUpdated, (next: State) => {
        setState((current) => mergeWordCloudUpdate(current, next));
        setErrorCode("");
      });
      liveSocket.on(RoomEvents.error, (payload: { code?: ApiErrorCode }) => {
        const nextCode = payload.code ?? "REQUEST_FAILED";
        if (!handleTerminalError(nextCode)) setErrorCode(nextCode);
        resetPending(true);
      });
    };
    void start();
    return () => {
      cancelled = true;
      resultRequest += 1;
      liveSocket?.disconnect();
      if (socket.current === liveSocket) socket.current = null;
    };
  }, [code, retryKey, router]);

  const answer = (choiceId: string) => {
    const participant = participantFor(code);
    if (!participant || submitting || connection !== "connected") return;
    setSubmitting(true);
    setErrorCode("");
    socket.current?.emit(RoomEvents.answerSubmit, {
      code,
      participantId: participant.id,
      participantToken: participant.token,
      choiceId,
    });
  };

  const wordAction = (event: string, value: Record<string, string>) => {
    const participant = participantFor(code);
    if (!participant || submitting || connection !== "connected") return;
    setSubmitting(true);
    setErrorCode("");
    socket.current?.emit(event, {
      code,
      participantId: participant.id,
      participantToken: participant.token,
      ...value,
    });
    if (event === RoomEvents.wordCloudSubmit) {
      pendingWord.current = word;
      setWord("");
    }
  };

  const entries = state?.question?.entries ?? [];
  const entryVotes = entries.map((entry) => entry.votes);
  const minVotes = entryVotes.length ? Math.min(...entryVotes) : 0;
  const maxVotes = entryVotes.length ? Math.max(...entryVotes) : 0;
  const connected = connection === "connected";
  const pollResult =
    state?.activityType === "POLL" &&
    result?.poll &&
    result.poll.questionId === state.question?.id
      ? result.poll
      : null;

  return (
    <main className="page-shell">
      <div className="page-content max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="badge text-xs">{t("common.roomCode")} {code}</p>
          <p role="status" aria-live="polite" className="badge text-xs">{t(`common.${connection}`)}</p>
        </div>

        {loading && !state && <section role="status" className="panel mt-8 text-center text-lg font-semibold text-slate-600">{t("player.loadingRoom")}</section>}
        {bootstrapFailed && !state && (
          <section className="panel mt-8 text-center">
            <p role="alert" className="alert-error">{t(`errors.${errorCode || "REQUEST_FAILED"}`)}</p>
            <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="btn-secondary mt-4">{t("common.retry")}</button>
          </section>
        )}
        {state?.phase === "WAITING" && <section className="panel mt-8 py-12 text-center text-xl font-semibold text-neutral-600">{t("player.waitingForHost")}</section>}

        {state?.question && state.phase === "COMPLETED" && state.activityType === "WORD_CLOUD" ? (
          <section className="panel mt-6">
            <h1 className="text-center text-3xl font-black text-slate-900 sm:text-5xl">{t("wordCloud.results")}</h1>
            <p className="mt-3 text-center text-lg font-semibold text-slate-700">{state.question.text}</p>
            <WordCloudResults entries={state.question.entries} totalVotes={state.question.totalVotes} emptyLabel={t("wordCloud.noEntries")} votesLabel={t("wordCloud.votes")} totalVotesLabel={t("wordCloud.totalVotes")} className="mt-6" />
          </section>
        ) : (state?.phase === "REVEALED" || state?.phase === "COMPLETED") && state.activityType === "POLL" ? (
          <section className="panel mt-6">
            <h1 className="text-center text-3xl font-black text-slate-900 sm:text-5xl">{t("player.pollResults")}</h1>
            {pollResult ? (
              <>
                <p className="mt-4 text-center text-xl font-semibold text-slate-700">{pollResult.text}</p>
                <div className="mt-6 grid gap-3">
                  {pollResult.distribution.map((choice) => (
                    <div
                      key={choice.id}
                      className={`rounded-2xl border p-4 ${choice.id === state.selectedChoiceId ? "border-sky-600 bg-sky-100" : "border-transparent bg-sky-50"}`}
                    >
                      <div className="flex justify-between gap-3 font-semibold">
                        <span className="break-words">
                          {choice.text}
                          {choice.id === state.selectedChoiceId && <span className="ml-2 text-sm text-sky-800">({t("player.yourAnswer")})</span>}
                        </span>
                        <span>{choice.count}</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-sky-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${pollResult.responseCount ? (choice.count / pollResult.responseCount) * 100 : 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p role="status" className="mt-5 text-center text-slate-600">{resultLoading ? t("common.loading") : t("results.noQuestions")}</p>}
          </section>
        ) : state?.question && state.phase !== "COMPLETED" && (
          <section className="panel mt-8 sm:p-10">
            <p className="font-semibold text-neutral-500">{state.question.position} / {state.question.total}</p>
            <h1 className="mt-3 break-words text-3xl font-semibold leading-tight tracking-tight text-[#1d1d1f] sm:text-5xl">{state.question.text}</h1>
            {(state.phase === "ACTIVE" || state.phase === "REVEALED") && state.activityType !== "WORD_CLOUD" && (
              <div className="mt-7 grid gap-3">
                {state.question.choices.map((choice) => {
                  const selected = choice.id === state.selectedChoiceId;
                  const correct = state.phase === "REVEALED" && choice.id === state.correctChoiceId;
                  const wrong = state.phase === "REVEALED" && selected && !correct;
                  return (
                    <button type="button" aria-pressed={selected} disabled={state.phase !== "ACTIVE" || state.answerSubmitted || submitting || !connected} key={choice.id} onClick={() => answer(choice.id)} className={`min-h-18 rounded-2xl border p-5 text-left text-lg font-semibold shadow-sm transition duration-200 ${correct ? "border-emerald-400 bg-emerald-50 text-emerald-950" : wrong ? "border-red-400 bg-red-50 text-red-950" : selected ? "border-sky-500 bg-sky-50 text-sky-950" : "border-black/[0.06] bg-white hover:-translate-y-0.5 hover:bg-neutral-50"} disabled:opacity-70`}>
                      <span className="break-words">{choice.text}</span>
                      {correct && <span className="mt-2 block text-sm">{t("player.correctAnswer")}</span>}
                      {selected && <span className="mt-1 block text-sm">{t("player.yourAnswer")}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {state.phase === "ACTIVE" && state.activityType === "WORD_CLOUD" && (
              <div className="mt-7">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label htmlFor="word-cloud-response" className="sr-only">{t("wordCloud.addResponse")}</label>
                  <input id="word-cloud-response" value={word} maxLength={30} disabled={state.wordSubmitted || submitting || !connected} onChange={(event) => setWord(event.target.value)} className="form-input mt-0 min-w-0 flex-1" placeholder={t("wordCloud.addResponse")} aria-describedby="word-cloud-response-hint" />
                  <button type="button" disabled={state.wordSubmitted || !word.trim() || submitting || !connected} onClick={() => wordAction(RoomEvents.wordCloudSubmit, { text: word.trim() })} className="btn-primary">{t("wordCloud.addResponse")}</button>
                </div>
                <p id="word-cloud-response-hint" className="mt-2 flex justify-between gap-3 text-sm text-slate-600"><span>{t("wordCloud.responseHint")}</span><span>{word.length}/30</span></p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {entries.map((entry) => {
                    const size = wordCloudFontSize(entry.votes, minVotes, maxVotes);
                    return <button key={entry.id} type="button" aria-pressed={entry.voted} disabled={entry.voted || submitting || !connected} onClick={() => wordAction(RoomEvents.wordCloudVote, { entryId: entry.id })} style={{ fontSize: `clamp(18px, ${size / 10}vw, ${size}px)` }} className="min-h-11 max-w-full break-words rounded-2xl bg-neutral-100 px-4 py-3 font-semibold text-[#1d1d1f] disabled:opacity-60">{entry.text} <HeartIcon className="inline h-5 w-5" aria-hidden="true" /> {entry.votes}{entry.voted && <span className="ml-2 text-sm">{t("wordCloud.voted")}</span>}</button>;
                  })}
                </div>
                {state.wordSubmitted && <p role="status" className="mt-5 rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-900"><CheckIcon className="mr-1 inline h-5 w-5" aria-hidden="true" />{t("wordCloud.responseAdded")}</p>}
              </div>
            )}
            {state.activityType !== "WORD_CLOUD" && state.phase === "ACTIVE" && state.answerSubmitted && <p role="status" className="mt-5 rounded-2xl bg-neutral-100 p-4 font-semibold text-[#1d1d1f]"><CheckIcon className="mr-1 inline h-5 w-5" aria-hidden="true" />{t("player.answerRecorded")}</p>}
            {state.activityType === "QUIZ" && state.phase === "REVEALED" && (
              <p role="status" className={`mt-5 rounded-2xl p-4 font-semibold ${!state.selectedChoiceId ? "bg-neutral-100 text-neutral-800" : state.selectedChoiceId === state.correctChoiceId ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
                {!state.selectedChoiceId ? t("player.noAnswer") : state.selectedChoiceId === state.correctChoiceId ? t("player.correctFeedback") : t("player.incorrectFeedback")}
              </p>
            )}
          </section>
        )}

        {state?.phase === "COMPLETED" && state.activityType === "QUIZ" && resultLoading && !result && <p role="status" className="panel mt-8 text-center">{t("common.loading")}</p>}
        {result && state?.activityType === "QUIZ" && (
          <section className="panel mt-8">
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><ChartBarIcon className="h-6 w-6 text-sky-700" aria-hidden="true" />{t("room.leaderboard")}</h2>
            <ol className="mt-4 grid gap-2">
              {result.leaderboard.map((entry) => <li key={`${entry.rank}-${entry.displayName}`} aria-current={entry.isYou ? "true" : undefined} className={`rounded-2xl p-4 font-semibold ${entry.isYou ? "border-2 border-sky-600 bg-sky-50" : "bg-neutral-100"}`}>{entry.rank}. {entry.displayName}: {entry.score}{entry.isYou && <span className="ml-2 text-sm text-sky-800">({t("player.you")})</span>}</li>)}
            </ol>
          </section>
        )}
        {errorCode && (!bootstrapFailed || state) && <p role="alert" className="alert-error mt-5">{t(`errors.${errorCode}`)}</p>}
      </div>
    </main>
  );
}
