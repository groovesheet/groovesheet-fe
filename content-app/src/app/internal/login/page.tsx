import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, isConfigured, sharedPasswordMode } from "../_lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in: no reason to show the form again.
  if (await getSession()) redirect("/internal");

  return (
    <div className="int-login">
      {isConfigured() ? (
        <Suspense fallback={<div className="int-login-card" />}>
          <LoginForm sharedPassword={sharedPasswordMode()} />
        </Suspense>
      ) : (
        <div className="int-login-card">
          <span className="gs-caption-strong">Not configured</span>
          <p className="int-login-copy">
            Set <code>INTERNAL_PASSWORD</code> in the environment and redeploy. On Vercel
            that is Settings, then Environment Variables, then a redeploy: env changes do not
            reach a running deployment on their own. For one credential per person, set{" "}
            <code>INTERNAL_USERS</code> instead, built with{" "}
            <code>node scripts/internal-user-hash.mjs</code>.
          </p>
          <p className="int-login-foot">INTERNAL_PASSWORD=&lt;the team password&gt;</p>
        </div>
      )}
    </div>
  );
}
