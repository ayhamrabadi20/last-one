export const metadata = { title: "كلمة مرور جديدة | Mustanad Jo" };
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthShell title="كلمة مرور جديدة" description="اختر كلمة مرور جديدة لحماية حسابك والعودة إلى رحلتك."><AuthForm mode="reset-password" token={typeof token === "string" ? token : ""} /></AuthShell>;
}
