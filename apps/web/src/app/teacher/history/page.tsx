import { HistoryList } from "@/components/history-list";
import { requireUser } from "@/lib/server-auth";

export default async function TeacherHistoryPage() {
  await requireUser("HOST");
  return <HistoryList basePath="/teacher/history" />;
}
