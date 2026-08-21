import { TeacherHeader } from "@/components/teacher-header";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TeacherHeader />
      {children}
    </>
  );
}
