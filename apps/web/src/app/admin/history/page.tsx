import { HistoryList } from "@/components/history-list";
import { requireUser } from "@/lib/server-auth";

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string }>;
}) {
  await requireUser("ADMIN");
  return (
    <HistoryList
      basePath="/admin/history"
      admin
      initialTeacherId={(await searchParams).teacherId}
    />
  );
}
