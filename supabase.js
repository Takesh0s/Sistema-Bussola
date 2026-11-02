// supabase.js — Sistema Bússola
const { createClient } = globalThis.supabase;

const db = createClient(
  'https://mexzzdxkronktxrupodz.supabase.co',
  'sb_publishable_EBXNBlKr4YlDziP25VE_wg_t9Bby-M_',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);