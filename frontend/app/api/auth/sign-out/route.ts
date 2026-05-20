import { sessionClearCookie } from "@/lib/auth/cookie";
import { SESSION_COOKIE } from "@/lib/auth/middleware";
import { deleteSession } from "@/lib/auth/sessions";

function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === SESSION_COOKIE) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const token = readSessionCookie(request);
  if (token) await deleteSession(token);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": sessionClearCookie(),
    },
  });
}
