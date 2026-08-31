import { io, type Socket } from "socket.io-client";
import { socketBaseUrl } from "@/lib/api";
export const RoomEvents = {
  join: "room:join",
  leave: "room:leave",
  quizStart: "quiz:start",
  answerSubmit: "answer:submit",
  wordCloudSubmit: "wordcloud:submit",
  wordCloudVote: "wordcloud:vote",
  questionReveal: "question:reveal",
  questionNext: "question:next",
  quizComplete: "quiz:complete",
  state: "room:state",
  quizStarted: "quiz:started",
  questionStarted: "question:started",
  questionRevealed: "question:revealed",
  leaderboardUpdated: "leaderboard:updated",
  wordCloudUpdated: "wordcloud:updated",
  dashboardUpdated: "dashboard:updated",
  quizCompleted: "quiz:completed",
  error: "room:error",
} as const;
export const roomSocket = (token?: string): Socket =>
  io(`${socketBaseUrl}/rooms`, {
    auth: token ? { token } : undefined,
    transports: ["websocket"],
  });
