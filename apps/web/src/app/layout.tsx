import type { Metadata } from "next";
import { Noto_Sans_Thai_Looped } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

const notoSansThaiLooped = Noto_Sans_Thai_Looped({
  variable: "--font-noto-sans-thai-looped",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CatchUp",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${notoSansThaiLooped.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <div className="fixed right-5 top-5 z-30">
            <LanguageSwitcher hideOnTeacher />
          </div>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
