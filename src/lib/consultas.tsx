// React Query com cache guardado no aparelho: o app abre mostrando os últimos
// dados enquanto busca os novos (e continua legível sem internet).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
    },
  },
});

// Atualiza os dados ao voltar para o app: no celular, quando ele volta ao
// primeiro plano; no navegador, ao voltar para a aba ou para a janela (o padrão
// só olhava a aba, e trocar de janela não atualizava nada).
focusManager.setEventListener((aoFocar) => {
  if (Platform.OS !== 'web') {
    const sub = AppState.addEventListener('change', (estado) => aoFocar(estado === 'active'));
    return () => sub.remove();
  }
  if (typeof window === 'undefined') return undefined;
  const avisar = () => aoFocar();
  window.addEventListener('focus', avisar);
  document.addEventListener('visibilitychange', avisar);
  return () => {
    window.removeEventListener('focus', avisar);
    document.removeEventListener('visibilitychange', avisar);
  };
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'bussola.cache' });

export function ProvedorConsultas({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24, buster: 'v3' }}>
      {children}
    </PersistQueryClientProvider>
  );
}
