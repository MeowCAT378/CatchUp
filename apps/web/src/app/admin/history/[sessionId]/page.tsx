import ResultsClient from "@/app/teacher/room/[code]/results/results-client";
import { requireUser } from "@/lib/server-auth";

export default async function AdminHistoryDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireUser("ADMIN");
  return (
    <ResultsClient
      sessionId={(await params).sessionId}
      backHref="/admin/history"
    />
  );
}
