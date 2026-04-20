// supabase.js — Sistema Bússola
const { createClient } = globalThis.supabase;

const db = createClient(
  'https://gjplfuopvdsoaracqljp.supabase.co',
  'sb_publishable_kDXuYFeJAEYbbytOJjDJhQ_2k8v8fL1',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);