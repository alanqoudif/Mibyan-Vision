import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    });
    await supabase.auth.exchangeCodeForSession(code);
  }
  // Only same-site relative paths are allowed as the post-login destination.
  const next = url.searchParams.get("next") ?? "";
  const dest = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/plugins";
  return NextResponse.redirect(new URL(dest, url.origin));
}
