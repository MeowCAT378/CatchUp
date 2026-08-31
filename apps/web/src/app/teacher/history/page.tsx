import { HistoryList } from "@/components/history-list";
import { requireUser } from "@/lib/server-auth";

export default async function TeacherHistoryPage() {
  const { user } = await requireUser("HOST");
  return (
    <HistoryList
      basePath="/teacher/history"
      initialTeacherId={user.role === "ADMIN" ? user.sub : ""}
    />
  );
}
