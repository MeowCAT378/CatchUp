import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { AdminHeader } from "@/components/admin-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  return (
    <div className="admin-shell">
      <AdminHeader user={session?.user} />
      {children}
    </div>
  );
}
