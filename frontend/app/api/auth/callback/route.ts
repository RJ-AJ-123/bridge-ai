import { sessionSetCookie } from "@/lib/auth/cookie";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/sessions";

function redirect(location: string, headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 303,
    headers: { location, ...headers },
  });
}

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return redirect("/sign-in?error=invalid_link");

  const consumed = await consumeMagicLink(token);
  if (!consumed) return redirect("/sign-in?error=invalid_link");

  const session = await createSession(consumed.userId);
  return redirect("/queries", {
    "set-cookie": sessionSetCookie(session.token, session.expiresAt),
  });
}
