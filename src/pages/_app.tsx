import { type AppType } from "next/app";
import { Geist, Noto_Sans_Arabic } from "next/font/google";

import { api } from "@/utils/api";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

import "@/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-arabic",
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <div className={`${geist.variable} ${notoArabic.variable} ${geist.className}`}>
            <Component {...pageProps} />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
};

export default api.withTRPC(MyApp);
