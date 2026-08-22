import { AdminHeader } from "@/components/admin-header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <AdminHeader />
      {children}
    </div>
  );
}
