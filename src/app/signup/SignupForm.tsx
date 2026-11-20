"use client";

import { useActionState } from "react";
import { signup, type AuthState } from "../auth/actions";
import { FormAlert } from "@/components/AuthShell";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, {});
  return (
    <form action={action} className="space-y-4">
      <FormAlert {...state} />
      <div>
        <label htmlFor="full_name" className="label">Full name</label>
        <input id="full_name" name="full_name" autoComplete="name" required className="input" />
      </div>
      <div>
        <label htmlFor="company" className="label">Company</label>
        <input id="company" name="company" autoComplete="organization" className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <label className="flex items-center gap-2 text-ink-muted">
        <input type="checkbox" name="seed_demo" defaultChecked className="size-4 accent-brand" />
        Load sample data so I can explore
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Creating your org…" : "Create Account"}
      </button>
    </form>
  );
}
