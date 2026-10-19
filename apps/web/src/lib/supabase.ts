"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client: SupabaseClient | null | undefined;

/** Only the URL and publishable key are ever read in browser code. */
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = url && publishableKey ? createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }) : null;
  return client;
}

export const supabaseConfigured = Boolean(url && publishableKey);
export const supabaseConfigurationMessage = "Supabase is not configured; changes stay in this browser only.";
