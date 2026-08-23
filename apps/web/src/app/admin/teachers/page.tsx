import { AdminTeachers } from "@/components/admin-teachers";
import { requireUser } from "@/lib/server-auth";

export default async function AdminTeachersPage() {
  await requireUser("ADMIN");
  return <AdminTeachers />;
}
