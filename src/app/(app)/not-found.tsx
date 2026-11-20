import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg px-6 py-10 text-center">
      <h1 className="text-lg font-semibold">Record not found</h1>
      <p className="mt-2 text-ink-muted">It may have been deleted, or you don&apos;t have access to it.</p>
      <Link href="/" className="btn btn-primary mt-5">Go Home</Link>
    </div>
  );
}
