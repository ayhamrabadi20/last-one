export const metadata = { title: "ملفي الشخصي | Mustanad Jo" };
import { requirePageSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { ProfileView } from "@/components/profile-view";
export default async function ProfilePage() {
  await requirePageSession();
  return <main className="min-h-screen"><SiteHeader/><div id="main-content" tabIndex={-1}><ProfileView/></div></main>;
}
