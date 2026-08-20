"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRightIcon,
  ChartBarIcon,
  EyeIcon,
  PlayIcon,
  StopIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { BackButton } from "@/components/back-button";
import { api, apiErrorCode, type ApiErrorCode } from "@/lib/api";
import { RoomEvents, roomSocket } from "@/lib/room-socket";
import { WordCloudResults, wordCloudFontSize } from "@/components/word-cloud-results";

type Dashboard = {
  state: {
    phase: "WAITING" | "ACTIVE" | "REVEALED" | "COMPLETED";
    activityType: "QUIZ" | "POLL" | "WORD_CLOUD";
    actions: { canStart: boolean; canReveal: boolean; canAdvance: boolean; canComplete: boolean };
    question: null | { text: string; entries: { id: string; text: string; votes: number; rank: number }[]; totalVotes: number };
  };
  participants: { id: string; name: string; status: string }[];
  progress: { submitted: number; participants: number };
  connected: number;
  distribution: {
    id: string;
    text: string;
    count: number;
    isCorrect: boolean;
  }[];
  leaderboard: { rank: number; displayName: string; score: number }[];
  entries: { id: string; text: string; votes: number }[];
};

export default function HostRoom({
  token,
  code,
}: {
  token: string;
  code: string;
}) {
  const { t } = useTranslation();
  const socket = useRef<ReturnType<typeof roomSocket> | null>(null);
  const [data, setData] = useState<Dashboard>();
  const [joinUrl, setJoinUrl] = useState("");
  const [connection, setConnection] = useState<"connected" | "reconnecting" | "disconnected">("reconnecting");
  const [errorCode, setErrorCode] = useState<ApiErrorCode | "">("");
  const [pending, setPending] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setJoinUrl(`${window.location.origin}/join?code=${code}`));
    api<Dashboard>(`/rooms/${code}/dashboard`, {}, token)
      .then(setData)
      .catch((error) => setErrorCode(apiErrorCode(error)));
    const liveSocket = roomSocket(token);
    socket.current = liveSocket;
    liveSocket.on("connect", () => {
      setConnection("reconnecting");
      liveSocket.emit(RoomEvents.join, { code });
    });
    liveSocket.on("disconnect", () => {
      setConnection("reconnecting");
      setPending("");
    });
    liveSocket.on("connect_error", () => {
      setConnection("disconnected");
      setPending("");
    });
    liveSocket.on(RoomEvents.state, () => setConnection("connected"));
    liveSocket.on(RoomEvents.dashboardUpdated, (next: Dashboard) => {
      setData(next);
      setErrorCode("");
      setConnection("connected");
      setPending("");
    });
    liveSocket.on(RoomEvents.error, (payload: { code?: ApiErrorCode }) => {
      setErrorCode(payload.code ?? "REQUEST_FAILED");
      setPending("");
    });
    return () => {
      liveSocket.disconnect();
      if (socket.current === liveSocket) socket.current = null;
    };
  }, [code, token]);
  const phase = data?.state.phase ?? "WAITING";
  const entryVotes = data?.entries.map((entry) => entry.votes) ?? [];
  const minVotes = entryVotes.length ? Math.min(...entryVotes) : 0;
  const maxVotes = entryVotes.length ? Math.max(...entryVotes) : 0;
  const emit = (event: string) => {
    if (connection !== "connected" || pending) return;
    setErrorCode("");
    setPending(event);
    socket.current?.emit(event, { code });
  };
  return (
    <main className="page-shell">
      <div className="page-content">
        <BackButton href="/teacher" />
        <header className="mt-6 grid gap-6 rounded-3xl bg-[#1d1d1f] p-6 text-white shadow-[0_8px_30px_rgba(0,0,0,0.16)] md:grid-cols-[1fr_auto] md:p-9">
          <div>
            <p role="status" aria-live="polite" className="text-sm font-semibold tracking-wide text-white/70">
              {t("room.liveRoom")} · {t(`common.${connection}`)}
            </p>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight sm:text-7xl">
              {code}
            </h1>
            <p className="mt-4 text-lg font-semibold">
              {t("room.phase")}: {t(`room.${phase}`)} · {data?.connected ?? 0}{" "}
              {t("common.connected")} / {data?.participants.length ?? 0}{" "}
              {t("common.participants")}
            </p>
            {phase === "COMPLETED" && data?.state.activityType !== "WORD_CLOUD" && (
              <a
                href={`/teacher/room/${code}/results`}
                className="btn-secondary mt-5 border-white bg-white text-sky-800"
              >
                <ChartBarIcon className="h-5 w-5" aria-hidden="true" />
                {t("room.viewResults")}
              </a>
            )}
          </div>
          <div className="mx-auto min-h-56 min-w-56 rounded-2xl bg-white p-4 text-[#1d1d1f] shadow-md lg:min-h-72 lg:min-w-72">
            {joinUrl ? <QRCodeSVG value={joinUrl} size={190} title={`${t("room.qrJoin")} ${code}`} className="mx-auto h-48 w-48 lg:h-64 lg:w-64" /> : <p className="grid h-48 place-items-center">{t("common.loading")}</p>}
            <p className="mt-2 text-center font-bold">
              {t("room.qrJoin")}: {code}
            </p>
          </div>
        </header>
        {errorCode && <p role="alert" className="alert-error mt-5">{t(`errors.${errorCode}`)}</p>}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="panel">
            <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
              {data?.state.question?.text ?? t("room.waitingToStart")}
            </h2>
            <p className="mt-3 badge">
              {data?.progress.submitted ?? 0} /{" "}
              {data?.progress.participants ?? 0} {data?.state.activityType === "WORD_CLOUD" ? t("wordCloud.addResponse") : t("common.answered")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {data?.state.actions.canStart && <button
                disabled={connection !== "connected" || Boolean(pending)}
                aria-busy={pending === RoomEvents.quizStart}
                onClick={() => emit(RoomEvents.quizStart)}
                className="btn-primary"
              >
                <PlayIcon className="h-5 w-5" aria-hidden="true" />
                {t("room.start")}
              </button>}
              {data?.state.actions.canReveal && <button
                disabled={connection !== "connected" || Boolean(pending)}
                aria-busy={pending === RoomEvents.questionReveal}
                onClick={() => emit(RoomEvents.questionReveal)}
                className="btn-secondary"
              >
                <EyeIcon className="h-5 w-5" aria-hidden="true" />
                {data?.state.activityType === "POLL" ? t("room.showResults") : t("room.reveal")}
              </button>}
              {data?.state.actions.canAdvance && <button
                disabled={connection !== "connected" || Boolean(pending)}
                aria-busy={pending === RoomEvents.questionNext}
                onClick={() => emit(RoomEvents.questionNext)}
                className="btn-secondary"
              >
                <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
                {t("room.next")}
              </button>}
              {data?.state.actions.canComplete && <button
                disabled={connection !== "connected" || Boolean(pending)}
                onClick={() => setConfirmComplete(true)}
                className="btn-secondary border-red-200 text-red-700 hover:bg-red-50"
              >
                <StopIcon className="h-5 w-5" aria-hidden="true" />
                {t("room.complete")}
              </button>}
            </div>
          </div>
          <div className="panel">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <UsersIcon className="h-5 w-5 text-neutral-600" aria-hidden="true" />
              {t("common.participants")}
            </h2>
            <div className="mt-4 grid gap-2">
              {data?.participants.map((p) => (
                <p
                  key={p.id}
                  className="flex justify-between rounded-xl bg-neutral-100 px-3 py-2"
                >
                  <span className="font-medium">{p.name}</span>
                  <span
                    className={
                      p.status === "answered"
                        ? "font-semibold text-emerald-700"
                        : "text-amber-700"
                    }
                  >
                    {p.status === "answered"
                      ? t("common.answered")
                      : t("common.waiting")}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </section>
        {data?.state.activityType === "WORD_CLOUD" && phase === "COMPLETED" ? (
          <section className="panel mt-6">
            <h2 className="text-center text-3xl font-black text-slate-900 sm:text-5xl">{t("wordCloud.results")}</h2>
            <p className="mt-3 text-center text-lg font-semibold text-slate-700">{data.state.question?.text}</p>
            <WordCloudResults entries={data.state.question?.entries ?? data.entries} totalVotes={data.state.question?.totalVotes ?? data.entries.reduce((total, entry) => total + entry.votes, 0)} emptyLabel={t("wordCloud.noEntries")} votesLabel={t("wordCloud.votes")} totalVotesLabel={t("wordCloud.totalVotes")} className="mt-6" />
          </section>
        ) : (data?.state.activityType === "WORD_CLOUD" || phase === "REVEALED" || phase === "COMPLETED") && (
          <section className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="panel">
              <h2 className="text-xl font-bold">{t("room.distribution")}</h2>
              {data?.state.activityType === "WORD_CLOUD" ? <div className="mt-3 flex flex-wrap gap-3">{data.entries.map((entry) => {
                const size = wordCloudFontSize(entry.votes, minVotes, maxVotes);
                return <span key={entry.id} style={{ fontSize: `clamp(18px, ${size / 10}vw, ${size}px)` }} className="max-w-full break-words rounded-xl bg-sky-50 px-3 py-2 font-bold">{entry.text} {entry.votes}</span>;
              })}</div> : data?.distribution.map((x) => (
                <p
                  key={x.id}
                  className={
                    x.isCorrect
                      ? "mt-3 rounded-xl bg-emerald-50 p-3 font-bold text-emerald-800"
                      : "mt-3 rounded-xl bg-sky-50 p-3"
                  }
                >
                  {x.text}: {x.count}
                  {data?.state.activityType === "POLL" && ` (${data.progress.submitted ? Math.round((x.count / data.progress.submitted) * 100) : 0}%)`}
                </p>
              ))}
            </div>
            {data?.state.activityType === "QUIZ" && <div className="panel">
              <h2 className="text-xl font-bold">{t("room.leaderboard")}</h2>
              {data?.leaderboard.map((x) => (
                <p
                  key={`${x.rank}-${x.displayName}`}
                  className="mt-3 rounded-xl bg-sky-50 p-3 font-semibold"
                >
                  {x.rank}. {x.displayName}: {x.score}
                </p>
              ))}
            </div>}
          </section>
        )}
        {confirmComplete && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-room-title"
            className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4"
            onKeyDown={(event) => {
              if (event.key === "Escape") setConfirmComplete(false);
            }}
          >
            <div className="panel max-w-md">
              <h2 id="complete-room-title" className="text-xl font-bold text-slate-900">
                {t("room.completeConfirmTitle")}
              </h2>
              <p className="mt-2 text-slate-600">{t("room.completeConfirmMessage")}</p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" autoFocus onClick={() => setConfirmComplete(false)} className="btn-secondary">
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmComplete(false);
                    emit(RoomEvents.quizComplete);
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 font-semibold text-white hover:bg-red-800"
                >
                  <StopIcon className="h-5 w-5" aria-hidden="true" />
                  {t("room.complete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
