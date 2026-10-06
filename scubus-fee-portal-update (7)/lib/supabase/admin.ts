import { createClient } from "@supabase/supabase-js";

// Service-role client — ONLY ever imported from server actions / route handlers.
// Never import this from a "use client" file: SUPABASE_SERVICE_ROLE_KEY must
// never reach the browser bundle.
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in your hosting provider's environment variables " +
        "(copy it from the Supabase dashboard: Settings -> API -> service_role key) to enable inviting counselors."
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
