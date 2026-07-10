import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, ValidationError } from "@/lib/errors";
import { SeparationOfDutiesError } from "@/lib/rbac";

/** Consistent success envelope. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function created<T>(data: T): NextResponse {
  return ok(data, { status: 201 });
}

/**
 * Map any thrown error to a JSON error response. Domain errors (AppError)
 * carry their own status; ZodError becomes a 400 with field details;
 * everything else is a 500 with no internal detail leaked to the client.
 */
export function fail(err: unknown): NextResponse {
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { ok: false, error: err.message, code: err.code, fieldErrors: err.fieldErrors },
      { status: err.status },
    );
  }
  if (err instanceof AppError) {
    return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
  }
  // A separation-of-duties breach is a 403, not a server fault.
  if (err instanceof SeparationOfDutiesError) {
    return NextResponse.json({ ok: false, error: err.message, code: "SEPARATION_OF_DUTIES" }, { status: 403 });
  }
  // Postgres unique-violation (duplicate code/sku/email) is a 409, not a 500.
  if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505") {
    return NextResponse.json(
      { ok: false, error: "A record with the same unique value already exists.", code: "CONFLICT" },
      { status: 409 },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { ok: false, error: "Validation failed.", code: "VALIDATION", fieldErrors: err.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error("Unhandled API error:", err);
  return NextResponse.json({ ok: false, error: "Internal server error.", code: "INTERNAL" }, { status: 500 });
}

/** Parse and validate a JSON body, or throw ValidationError. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError("Validation failed.", result.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

/** Validate query params from a URL. */
export function parseQuery<T>(url: string, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ValidationError("Invalid query parameters.", result.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

/** Wrap a route handler so thrown errors become clean JSON responses. */
export function handler(
  fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return fail(err);
    }
  };
}
