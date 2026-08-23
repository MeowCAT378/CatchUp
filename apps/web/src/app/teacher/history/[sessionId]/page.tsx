import ResultsClient from "@/app/teacher/room/[code]/results/results-client";
import { requireUser } from "@/lib/server-auth";

export default async function TeacherHistoryDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireUser("HOST");
  return (
    <ResultsClient
      sessionId={(await params).sessionId}
      backHref="/teacher/history"
    />
  );
}
