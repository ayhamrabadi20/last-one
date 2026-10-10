import { currentSession } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { HeaderNav } from "@/components/header-nav";
export async function SiteHeader({ compact = false }: { compact?: boolean }) {
  void compact;
  const session = await currentSession();
  let name = "حسابي";
  let isAdmin = false;
  if (session) { try { const profile = await getProfile(session.sub); name = profile?.name || name; isAdmin = profile?.role === "admin"; } catch { /* Account page reports database errors. */ } }
  return <HeaderNav name={name} isAdmin={isAdmin} />;
}
