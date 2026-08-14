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
import { api } from "@/lib/api";
import { RoomEvents, roomSocket } from "@/lib/room-socket";
import { WordCloudResults } from "@/components/word-cloud-results";

type Dashboard = {
  state: {
    phase: "WAITING" | "ACTIVE" | "REVEALED" | "COMPLETED";
    activityType: "QUIZ" | "POLL" | "WORD_CLOUD";
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
  const [connection, setConnection] = useState("reconnecting");
  useEffect(() => {
    setJoinUrl(`${window.location.origin}/play/${code}`);
    api<Dashboard>(`/rooms/${code}/dashboard`, {}, token).then(setData);
    socket.current = roomSocket(token);
    socket.current.on("connect", () => {
      setConnection("connected");
      socket.current?.emit(RoomEvents.join, { code });
    });
    socket.current.on("disconnect", () => setConnection("reconnecting"));
    socket.current.on(RoomEvents.dashboardUpdated, setData);
    return () => {
      socket.current?.disconnect();
    };
  }, [code, token]);
  const phase = data?.state.phase ?? "WAITING";
  const emit = (event: string) => socket.current?.emit(event, { code });
  return (
    <main className="page-shell">
      <div className="page-content">
        <BackButton href="/teacher" />
        <header className="mt-4 grid gap-6 rounded-3xl bg-gradient-to-br from-sky-500 via-sky-400 to-emerald-400 p-6 text-white shadow-lg md:grid-cols-[1fr_auto] md:p-9">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-sky-50">
              {t("room.liveRoom")} · {t(`common.${connection}`)}
            </p>
            <h1 className="mt-2 text-5xl font-black tracking-wider sm:text-7xl">
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
          <div className="mx-auto rounded-2xl bg-white p-4 text-slate-900 shadow-md">
            <QRCodeSVG value={joinUrl || `/play/${code}`} size={190} />
            <p className="mt-2 text-center font-bold">
              {t("room.qrJoin")}: {code}
            </p>
          </div>
        </header>
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="panel">
            <h2 className="text-2xl font-black text-slate-900">
              {data?.state.question?.text ?? t("room.waitingToStart")}
            </h2>
            <p className="mt-3 badge">
              {data?.progress.submitted ?? 0} /{" "}
              {data?.progress.participants ?? 0} {t("common.answered")}
            </p>
            {!(phase === "COMPLETED" && data?.state.activityType === "WORD_CLOUD") && <div className="mt-6 flex flex-wrap gap-3">
              <button
                disabled={phase !== "WAITING"}
                onClick={() => emit(RoomEvents.quizStart)}
                className="btn-primary"
              >
                <PlayIcon className="h-5 w-5" aria-hidden="true" />
                {t("room.start")}
              </button>
              <button
                disabled={phase !== "ACTIVE"}
                onClick={() => emit(RoomEvents.questionReveal)}
                className="btn-secondary"
              >
                <EyeIcon className="h-5 w-5" aria-hidden="true" />
                {t("room.reveal")}
              </button>
              <button
                disabled={phase !== "REVEALED"}
                onClick={() => emit(RoomEvents.questionNext)}
                className="btn-secondary"
              >
                <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
                {t("room.next")}
              </button>
              <button
                disabled={phase === "COMPLETED"}
                onClick={() => emit(RoomEvents.quizComplete)}
                className="btn-secondary border-red-200 text-red-700 hover:bg-red-50"
              >
                <StopIcon className="h-5 w-5" aria-hidden="true" />
                {t("room.complete")}
              </button>
            </div>}
          </div>
          <div className="panel">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <UsersIcon className="h-5 w-5 text-sky-700" aria-hidden="true" />
              {t("common.participants")}
            </h2>
            <div className="mt-4 grid gap-2">
              {data?.participants.map((p) => (
                <p
                  key={p.id}
                  className="flex justify-between rounded-xl bg-sky-50 px-3 py-2"
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
              {data?.state.activityType === "WORD_CLOUD" ? <div className="mt-3 flex flex-wrap gap-3">{data.entries.map((entry) => (
                <span key={entry.id} style={{ fontSize: `${18 + (46 * entry.votes) / Math.max(1, ...data.entries.map((x) => x.votes))}px` }} className="rounded-xl bg-sky-50 px-3 py-2 font-bold">{entry.text} {entry.votes}</span>
              ))}</div> : data?.distribution.map((x) => (
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
            <div className="panel">
              <h2 className="text-xl font-bold">{t("room.leaderboard")}</h2>
              {data?.leaderboard.map((x) => (
                <p
                  key={x.rank}
                  className="mt-3 rounded-xl bg-sky-50 p-3 font-semibold"
                >
                  {x.rank}. {x.displayName}: {x.score}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
