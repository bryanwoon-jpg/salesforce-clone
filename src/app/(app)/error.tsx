"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg px-6 py-10 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-ink-muted">{error.message || "An unexpected error occurred."}</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-5">Try again</button>
    </div>
  );
}
