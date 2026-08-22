import { AdminTeacherDetail } from "@/components/admin-teacher-detail";
import { requireUser } from "@/lib/server-auth";

export default async function AdminTeacherPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  await requireUser("ADMIN");
  return <AdminTeacherDetail teacherId={(await params).teacherId} />;
}
