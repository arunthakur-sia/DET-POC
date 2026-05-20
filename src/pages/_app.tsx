import { type AppType } from "next/app";
import { Geist } from "next/font/google";

import { api } from "@/utils/api";
import { AuthProvider } from "@/contexts/AuthContext";

import "@/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <AuthProvider>
      <div className={geist.className}>
        <Component {...pageProps} />
      </div>
    </AuthProvider>
  );
};

export default api.withTRPC(MyApp);
