export const metadata = { title: "المصادر والأدلة | Mustanad Jo" };
import { SiteHeader } from "@/components/site-header";
import { SourcesView } from "@/components/sources-view";
import { requirePageSession } from "@/lib/auth";

export default async function SourcesPage() {
  await requirePageSession();
  return <main className="min-h-screen"><SiteHeader compact /><div id="main-content" tabIndex={-1}><SourcesView /></div></main>;
}
