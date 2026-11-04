// Entrar com Google pelo Supabase.
// Web: redireciona e volta para a própria página. Celular: abre o navegador do
// sistema e troca o código pela sessão (PKCE).
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/** Junta os parâmetros da query (?a=1) e do fragmento (#b=2) de uma URL de retorno. */
function lerParametros(url: string) {
  const params: Record<string, string> = {};
  const [, resto = ''] = url.split('?');
  const partes = [resto.split('#')[0], url.includes('#') ? url.split('#')[1] : ''];
  for (const parte of partes) {
    for (const par of parte.split('&')) {
      if (!par) continue;
      const [k, v = ''] = par.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return params;
}

export async function entrarComGoogle(destino = '/') {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + destino },
    });
    if (error) throw error;
    return;
  }

  // No Expo Go vira exp://<endereço>/--/auth; no app instalado, bussola://auth.
  // Os dois precisam estar em Authentication → URL Configuration → Redirect URLs.
  const redirectTo = makeRedirectUri({ scheme: 'bussola', path: 'auth' });
  if (__DEV__) console.log('[google] redirectTo =', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (__DEV__) console.log('[google] resultado =', res.type);
  if (res.type !== 'success') return;

  const p = lerParametros(res.url);
  if (p.error || p.error_description) {
    throw new Error(p.error_description || p.error);
  }
  if (p.code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(p.code);
    if (e) throw e;
  } else if (p.access_token && p.refresh_token) {
    const { error: e } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
    if (e) throw e;
  } else {
    throw new Error('O Google voltou sem os dados de login. Tente de novo.');
  }
}
