import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const OWNER_ONLY_PREFIXES = ["/dashboard", "/counselors", "/fee-structure", "/annual-plan", "/custom-fields", "/export"];
const MANAGER_OR_OWNER_PREFIXES = ["/team"];
const ACCOUNTS_OR_OWNER_PREFIXES = ["/invoices"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // "/reset-password" has to stay public: the recovery link lands here with the session tokens
  // carried in the URL hash, which only the browser can read — the server sees no cookie session
  // on that first request, so this route must not be gated behind one the way the rest of the app is.
  const isPublic = path.startsWith("/login") || path.startsWith("/reset-password") || path.startsWith("/_next") || path.startsWith("/favicon");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && OWNER_ONLY_PREFIXES.some((p) => path.startsWith(p))) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "owner") {
      const url = request.nextUrl.clone();
      url.pathname = "/calculator";
      return NextResponse.redirect(url);
    }
  }

  if (user && MANAGER_OR_OWNER_PREFIXES.some((p) => path.startsWith(p))) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "owner" && profile?.role !== "manager") {
      const url = request.nextUrl.clone();
      url.pathname = "/calculator";
      return NextResponse.redirect(url);
    }
  }

  // Bulk invoice export is a finance-facing feature — owner or accounts only, same as the
  // owner-only pages above but also letting the accounts role in since they issue invoices.
  if (user && ACCOUNTS_OR_OWNER_PREFIXES.some((p) => path.startsWith(p))) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "owner" && profile?.role !== "accounts") {
      const url = request.nextUrl.clone();
      url.pathname = "/calculator";
      return NextResponse.redirect(url);
    }
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/calculator";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
