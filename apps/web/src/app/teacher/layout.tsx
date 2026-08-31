import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { TeacherHeader } from "@/components/teacher-header";
import { requireUser } from "@/lib/server-auth";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser("HOST");
  const session = await getServerSession(authOptions);
  return (
    <div className="teacher-shell">
      <TeacherHeader isAdmin={user.role === "ADMIN"} user={session?.user} />
      {children}
    </div>
  );
}
