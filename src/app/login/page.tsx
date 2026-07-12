"use client";
import { useActionState } from "react";
import { Package } from "lucide-react";
import { login } from "@/lib/auth/actions";
import { Field, Input, FormError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <div className="flex flex-1 items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-ink text-paper">
            <Package className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">JuanBuild IMS</h1>
          <p className="mt-1 text-sm text-muted">Sign in to the inventory console</p>
        </div>

        <form action={formAction} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          {state?.error ? <FormError>{state.error}</FormError> : null}

          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              required
            />
          </Field>

          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </Field>

          <Button type="submit" disabled={pending} className="mt-1 w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
