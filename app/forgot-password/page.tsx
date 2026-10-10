export const metadata = { title: "استعادة كلمة المرور | Mustanad Jo" };
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";
export default function ForgotPasswordPage() {
  return <AuthShell title="نسيت كلمة المرور؟" description="أدخل البريد الإلكتروني المرتبط بحسابك لطلب رابط تعيين كلمة مرور جديدة."><AuthForm mode="forgot-password" /></AuthShell>;
}
