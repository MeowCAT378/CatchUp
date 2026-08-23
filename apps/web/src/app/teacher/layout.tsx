import { TeacherHeader } from "@/components/teacher-header";
import { requireUser } from "@/lib/server-auth";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("HOST");
  return (
    <>
      <TeacherHeader />
      {children}
    </>
  );
}
