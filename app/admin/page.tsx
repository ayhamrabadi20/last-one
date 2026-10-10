export const metadata = { title: "لوحة الإدارة | Mustanad Jo" };
import { requireAdminPage } from "@/lib/admin-auth";
import { AdminDashboard } from "@/components/admin-dashboard";
export default async function AdminPage() {
  const profile=await requireAdminPage();
  return <AdminDashboard name={profile.name}/>;
}
