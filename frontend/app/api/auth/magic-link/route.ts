import { NextResponse } from "next/server";

import { defaultMagicLinkSender } from "@/lib/auth/email-sender";
import { requestMagicLink } from "@/lib/auth/magic-link";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function originOf(request: Request): string {
  return new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const email = (body as { email?: unknown } | null)?.email;
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  await requestMagicLink({
    email,
    origin: originOf(request),
    sender: defaultMagicLinkSender(),
  });

  // Always 200 — do not reveal whether the user already existed.
  return NextResponse.json({ ok: true });
}
