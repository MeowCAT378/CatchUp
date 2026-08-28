import { TeacherHeader } from "@/components/teacher-header";
import { requireUser } from "@/lib/server-auth";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser("HOST");
  return (
    <div className="teacher-shell">
      <TeacherHeader isAdmin={user.role === "ADMIN"} />
      {children}
    </div>
  );
}
