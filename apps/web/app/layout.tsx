import "./globals.css";
import Providers from "@/components/Providers";

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
  return (
    <html lang="en">
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
