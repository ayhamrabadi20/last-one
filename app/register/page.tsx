export const metadata = { title: "إنشاء حساب | Mustanad Jo" };
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
export default async function RegisterPage() {
  if (await currentSession()) redirect("/profile");
  return <AuthShell compact registration title="ابدأ رحلتك معنا" description="حسابك لحفظ خطّتك ومتابعة طلباتك."><AuthForm mode="register" /></AuthShell>;
}
