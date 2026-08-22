import { AdminOverview } from "@/components/admin-overview";
import { requireUser } from "@/lib/server-auth";

export default async function AdminPage() {
  await requireUser("ADMIN");
  return <AdminOverview />;
}
