// Public Supabase settings. Env vars win; the defaults point at the
// salesforce-clone project so a fresh Vercel deploy works with zero config.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jhiolnfasmjvcjapmigu.supabase.co";

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_g-4sZWxBberNB-zikI8Cxw_V1YynHVy";
