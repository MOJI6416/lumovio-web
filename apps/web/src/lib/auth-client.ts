"use client";
import { deviceAuthorizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = `${window.location.pathname.replace(/\/auth\/.*$/, "")}/auth/two-factor${window.location.search}`;
      },
    }),
    deviceAuthorizationClient(),
  ],
});
