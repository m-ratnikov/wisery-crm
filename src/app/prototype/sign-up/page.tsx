import Link from "next/link";
import { AuthShell, AuthField } from "../_auth/AuthShell";

// Sign-up (anchor-view prototype). Email + password for MVP; Google SSO is V2.
export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your ICP once, then work the queue Wisery fills for you."
      submitLabel="Create account"
      submitHref="/prototype/icp-config"
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/prototype/sign-in"
            className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            Sign in
          </Link>
        </>
      }
    >
      <AuthField label="Name" placeholder="Your name" />
      <AuthField label="Email" type="email" placeholder="you@company.com" />
      <AuthField label="Password" type="password" placeholder="At least 8 characters" />
    </AuthShell>
  );
}
