import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export const metadata = { title: "Something went wrong" };

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const text =
    reason === "no-organization"
      ? "Your account isn't a member of any organization yet. Ask an admin to add you, or sign up again."
      : (reason ?? "We couldn't complete that request.");
  return (
    <AuthShell title="Something went wrong" footer={<Link href="/login" className="link">Back to log in</Link>}>
      <p className="text-ink-muted">{text}</p>
      <form action="/auth/signout" method="post" className="mt-4">
        <button className="btn w-full">Sign out</button>
      </form>
    </AuthShell>
  );
}
