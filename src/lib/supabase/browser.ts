"use client";

import { createBrowserClient } from "@supabase/ssr";

/* ============================================================
   Client NAVIGATEUR (admin uniquement : login, MFA, upload
   direct vers Storage). Le site public n'embarque jamais ce
   module.
   ============================================================ */

export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return createBrowserClient(url, key);
}
