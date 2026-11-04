// Tema do app: as mesmas duas coleções de variáveis do Figma.
//   Classe (Padrão, Amigo ... Líder Máster Avançado) × Tema (claro / escuro).
// A escolha fica salva no aparelho e, para quem tem perfil, também na conta.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { CLASSES, NEUTROS } from './tokens';

export type NomeClasse = keyof typeof CLASSES;
export type ModoTema = 'claro' | 'escuro' | 'sistema';

export const NOMES_CLASSE = Object.keys(CLASSES) as NomeClasse[];

export function ehNomeClasse(nome: unknown): nome is NomeClasse {
  return typeof nome === 'string' && nome in CLASSES;
}

export type Cores = {
  fundo: string; superficie: string; superficie2: string; borda: string;
  texto: string; texto2: string; sucesso: string; aviso: string; erro: string;
  primaria: string; sobrePrimaria: string; container: string; sobreContainer: string;
  acento: string; acentoSuave: string; destaqueA: string; destaqueB: string;
  sobreDestaque: string; terciaria: string; sobreTerciaria: string; seloA: string; seloB: string; contorno: string;
};

export type CorChave = keyof Cores;

export function coresDe(classe: NomeClasse, escuro: boolean): Cores {
  const c = CLASSES[classe][escuro ? 'escuro' : 'claro'];
  const n = NEUTROS[escuro ? 'escuro' : 'claro'];
  return {
    fundo: c.fundo, superficie: c.superficie, superficie2: c.superficie_2, borda: c.borda,
    texto: n.texto, texto2: n.texto_2, sucesso: n.sucesso, aviso: n.aviso, erro: n.erro,
    primaria: c.primaria, sobrePrimaria: c.sobre_primaria,
    container: c.container, sobreContainer: c.sobre_container,
    acento: c.acento, acentoSuave: c.acento_suave,
    destaqueA: c.destaque_a, destaqueB: c.destaque_b, sobreDestaque: c.sobre_destaque,
    // A terciária é clara (tom da classe) ou dourada: o texto sobre ela é sempre escuro
    terciaria: c.terciaria, sobreTerciaria: escuro ? c.fundo : n.texto, seloA: c.selo_a, seloB: c.selo_b, contorno: c.contorno,
  };
}

// Plus Jakarta Sans, carregada em app/_layout.tsx
export const F = {
  regular: 'PlusJakartaSans_400Regular',
  medio: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  negrito: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
} as const;

export type Peso = keyof typeof F;

type ContextoTema = {
  cores: Cores;
  escuro: boolean;
  modo: ModoTema;
  classe: NomeClasse;
  definirModo: (m: ModoTema) => void;
  definirClasse: (c: NomeClasse) => void;
};

const Ctx = createContext<ContextoTema | null>(null);

const CHAVE_MODO = 'bussola.tema.modo';
const CHAVE_CLASSE = 'bussola.tema.classe';

export function ProvedorTema({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [modo, setModo] = useState<ModoTema>('sistema');
  const [classe, setClasse] = useState<NomeClasse>('Padrão');

  useEffect(() => {
    (async () => {
      try {
        const [m, c] = await Promise.all([AsyncStorage.getItem(CHAVE_MODO), AsyncStorage.getItem(CHAVE_CLASSE)]);
        if (m === 'claro' || m === 'escuro' || m === 'sistema') setModo(m);
        if (ehNomeClasse(c)) setClasse(c);
      } catch {
        // Sem armazenamento (navegação privada): fica o padrão
      }
    })();
  }, []);

  const definirModo = useCallback((m: ModoTema) => {
    setModo(m);
    AsyncStorage.setItem(CHAVE_MODO, m).catch(() => {});
  }, []);

  const definirClasse = useCallback((c: NomeClasse) => {
    setClasse(c);
    AsyncStorage.setItem(CHAVE_CLASSE, c).catch(() => {});
  }, []);

  const escuro = modo === 'sistema' ? sistema === 'dark' : modo === 'escuro';
  const valor = useMemo(
    () => ({ cores: coresDe(classe, escuro), escuro, modo, classe, definirModo, definirClasse }),
    [classe, escuro, modo, definirModo, definirClasse],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTema() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTema fora do ProvedorTema');
  return v;
}
