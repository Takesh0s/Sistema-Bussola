import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProvedorToast } from '@/components/toast';
import { Carregando } from '@/components/ui';
import { ProvedorAuth, useAuth } from '@/lib/auth';
import { ProvedorConsultas } from '@/lib/consultas';
import { ehNomeClasse, ProvedorTema, useTema } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Raiz() {
  const [fontes] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontes) SplashScreen.hideAsync().catch(() => {});
  }, [fontes]);

  if (!fontes) return null;

  return (
    <SafeAreaProvider>
      <ProvedorConsultas>
        <ProvedorTema>
          <ProvedorAuth>
            <ProvedorToast>
              <Navegacao />
            </ProvedorToast>
          </ProvedorAuth>
        </ProvedorTema>
      </ProvedorConsultas>
    </SafeAreaProvider>
  );
}

function Navegacao() {
  const { sessao, carregando } = useAuth();
  const { cores, escuro } = useTema();
  useSincronizarTema();

  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: cores.fundo }}>
        <Carregando />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
        <Stack.Protected guard={!!sessao} redirectTo="/entrar">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!sessao} redirectTo="/">
          <Stack.Screen name="entrar" />
        </Stack.Protected>
        <Stack.Screen name="convite/[token]" />
      </Stack>
    </>
  );
}

/** Ao entrar, aplica o tema e a cor salvos na conta (ou a classe do desbravador). */
function useSincronizarTema() {
  const { perfil, membro, sessao } = useAuth();
  const { definirModo, definirClasse } = useTema();
  const aplicadoPara = useRef<string | null>(null);

  useEffect(() => {
    const uid = sessao?.user.id ?? null;
    if (!uid || aplicadoPara.current === uid || (!perfil && !membro)) return;
    aplicadoPara.current = uid;
    if (perfil?.tema) definirModo(perfil.tema);
    if (ehNomeClasse(perfil?.cor_classe)) definirClasse(perfil.cor_classe);
    else if (ehNomeClasse(membro?.classe?.nome)) definirClasse(membro.classe.nome);
  }, [sessao?.user.id, perfil, membro, definirModo, definirClasse]);
}
