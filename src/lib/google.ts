// Entrar com Google pelo Supabase.
// Web: redireciona e volta para a própria página. Celular: abre o navegador do
// sistema e troca o código pela sessão (PKCE).
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export async function entrarComGoogle(destino = '/') {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + destino },
    });
    if (error) throw error;
    return;
  }

  const redirectTo = makeRedirectUri({ scheme: 'bussola', path: 'auth' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return;

  const url = new URL(res.url);
  const code = url.searchParams.get('code');
  if (code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(code);
    if (e) throw e;
  }
}
