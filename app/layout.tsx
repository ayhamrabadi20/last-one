import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Mustanad Jo | رحلتك لبدء المشروع",
  description: "نموذج إرشادي عربي يحول هدف تأسيس مشروع إلى رحلة واضحة ومسندة بالمصادر.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      {/* Browser security extensions may add attributes to body before React hydrates. */}
      <body suppressHydrationWarning><script dangerouslySetInnerHTML={{__html:themeInitScript}}/><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
