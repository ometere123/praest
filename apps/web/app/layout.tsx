import "./globals.css";
import {AuthKitProvider} from "@workos-inc/authkit-nextjs/components";
import {withAuth} from "@workos-inc/authkit-nextjs";
import Providers from "@/components/Providers";
export const metadata={title:"PRAEST — Accountability infrastructure",description:"Accountability and resolution infrastructure for digital services and autonomous commerce."};
export default async function RootLayout({children}:{children:React.ReactNode}){let initialAuth:any=undefined;try{const auth=await withAuth();const {accessToken,...safe}=auth;initialAuth=safe}catch{}return <html lang="en"><body><AuthKitProvider initialAuth={initialAuth}><Providers>{children}</Providers></AuthKitProvider></body></html>}
