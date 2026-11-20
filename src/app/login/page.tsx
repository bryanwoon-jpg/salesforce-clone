import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log In" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Log in to your org"
      footer={
        <>
          New here? <Link href="/signup" className="link">Start a free trial</Link>
        </>
      }
    >
      <LoginForm next={next ?? "/"} />
    </AuthShell>
  );
}
