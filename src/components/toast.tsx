// Mensagens rápidas de sucesso/erro (funciona igual no celular e no navegador).
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '@/theme';

import { T } from './ui';

type Tipo = 'ok' | 'erro';
const Ctx = createContext<(texto: string, tipo?: Tipo) => void>(() => {});

export function ProvedorToast({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ texto: string; tipo: Tipo } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { cores } = useTema();
  const insets = useSafeAreaInsets();

  const mostrar = useCallback((texto: string, tipo: Tipo = 'ok') => {
    setMsg({ texto, tipo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3500);
  }, []);

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      {msg && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 12, alignItems: 'center' }}>
          <View style={{ maxWidth: 520, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
            backgroundColor: msg.tipo === 'erro' ? cores.erro : cores.texto }}>
            <T s={14} w="semi" style={{ color: cores.superficie }}>{msg.texto}</T>
          </View>
        </View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
