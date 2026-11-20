import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign Up" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your org"
      footer={
        <>
          Already have an account? <Link href="/login" className="link">Log in</Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
