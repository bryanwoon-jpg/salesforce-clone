import { Logo } from "./Logo";

export function AuthShell({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-light to-canvas px-4 py-12">
      <div className="mb-6">
        <Logo />
      </div>
      <div className="card w-full max-w-sm p-6">
        <h1 className="mb-5 text-lg font-semibold">{title}</h1>
        {children}
      </div>
      <p className="mt-4 text-sm text-ink-muted">{footer}</p>
    </main>
  );
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (error)
    return (
      <p role="alert" className="mb-4 rounded-card border border-danger/30 bg-danger-light px-3 py-2 text-danger">
        {error}
      </p>
    );
  if (message)
    return (
      <p role="status" className="mb-4 rounded-card border border-success/30 bg-success-light px-3 py-2 text-success">
        {message}
      </p>
    );
  return null;
}
