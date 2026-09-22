import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const OWNER_ONLY_PREFIXES = ["/dashboard", "/counselors"];

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
  const isPublic = path.startsWith("/login") || path.startsWith("/_next") || path.startsWith("/favicon");

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
