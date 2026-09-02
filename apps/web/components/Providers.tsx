"use client";

import type {PropsWithChildren} from "react";
import {PrivyProvider, useSubscribeToJwtAuthWithFlag} from "@privy-io/react-auth";
import {useAuth, useAccessToken} from "@workos-inc/authkit-nextjs/components";

function WorkOSPrivySync() {
  const {user, loading} = useAuth();
  const {getAccessToken} = useAccessToken();

  useSubscribeToJwtAuthWithFlag({
    enabled: Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID),
    isAuthenticated: Boolean(user),
    isLoading: loading,
    getExternalJwt: async () => (user ? await getAccessToken() : undefined),
  });
  return null;
}

export default function Providers({children}: PropsWithChildren) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {walletChainType: "ethereum-and-solana"},
        embeddedWallets: {
          ethereum: {createOnLogin: "users-without-wallets"},
          solana: {createOnLogin: "users-without-wallets"},
        },
      }}
    >
      <WorkOSPrivySync />
      {children}
    </PrivyProvider>
  );
}
