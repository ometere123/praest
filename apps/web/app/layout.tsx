import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-brand", display: "swap" });

export const metadata = {
  metadataBase: new URL(process.env.PRAEST_APP_URL || "http://localhost:3000"),
  title: "PRAEST — Accountability infrastructure",
  description: "Accountability and resolution infrastructure for digital services and autonomous commerce.",
  icons: {
    icon: "/brand/icon-transparent.png",
    apple: "/brand/icon-transparent.png",
  },
  openGraph: {
    title: "PRAEST — Accountability infrastructure",
    description: "Accountability and resolution infrastructure for digital services and autonomous commerce.",
    images: ["/brand/social-card.png"],
  },
};

const themeInit = `(function(){try{var t=localStorage.getItem('praest-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let initialAuth: any = undefined;
  try {
    const auth = await withAuth();
    const { accessToken, ...safe } = auth;
    initialAuth = safe;
  } catch {}

  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <AuthKitProvider initialAuth={initialAuth}>
          <Providers>{children}</Providers>
        </AuthKitProvider>
      </body>
    </html>
  );
}
