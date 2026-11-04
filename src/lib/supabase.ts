// Cliente Supabase do app (Android, iOS e web).
// Só a chave publishable vai no cliente — nunca a secret key.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const URL_PADRAO = 'https://mexzzdxkronktxrupodz.supabase.co';
const CHAVE_PADRAO = 'sb_publishable_EBXNBlKr4YlDziP25VE_wg_t9Bby-M_';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? URL_PADRAO,
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? CHAVE_PADRAO,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // No navegador o retorno do Google chega na própria URL
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  },
);

// No celular, só renova o token com o app aberto
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Mensagem legível para erros do Supabase (as funções do banco mandam a dica em `hint`). */
export function mensagemErro(e: unknown): string {
  if (!e) return 'Algo deu errado.';
  const err = e as { hint?: string; message?: string; code?: string };
  if (err.hint) return err.hint;
  if (err.code === '42501') return 'Você não tem permissão para isso.';
  if (err.code === '23505') return 'Já existe um registro igual.';
  return err.message ?? 'Algo deu errado.';
}

/** Desembrulha { data, error } e lança o erro, para usar com React Query. */
export async function dados<T>(consulta: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await consulta;
  if (error) throw error;
  return data as T;
}
