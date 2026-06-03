import Link from "next/link";
import { AuthShell, AuthField } from "../_auth/AuthShell";

// Sign-in (anchor-view prototype). Email + password for MVP; Google SSO is V2.
export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Pick up the daily loop where you left off."
      submitLabel="Sign in"
      submitHref="/prototype"
      footer={
        <>
          New to Wisery?{" "}
          <Link
            href="/prototype/sign-up"
            className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            Create an account
          </Link>
        </>
      }
    >
      <AuthField label="Email" type="email" placeholder="you@company.com" />
      <AuthField label="Password" type="password" placeholder="Your password" />
    </AuthShell>
  );
}
