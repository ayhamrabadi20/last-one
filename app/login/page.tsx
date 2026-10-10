export const metadata = { title: "تسجيل الدخول | Mustanad Jo" };
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
export default async function LoginPage() {
  if (await currentSession()) redirect("/");
  return <AuthShell compact title="أهلًا بعودتك" description="سجّل دخولك لتبدأ مشروعك وتتابع خطواتك."><AuthForm mode="login" /></AuthShell>;
}
