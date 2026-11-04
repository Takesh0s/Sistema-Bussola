// Sessão e quem é o usuário: perfil (adultos com cargo), cargos ativos,
// clube e o cadastro de membro (desbravador — crianças e adultos).
import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { queryClient } from './consultas';
import { supabase } from './supabase';

export type Papel =
  | 'admin_sistema' | 'admin_associacao'
  | 'diretor' | 'diretor_associado' | 'secretario' | 'tesoureiro'
  | 'conselheiro' | 'conselheiro_associado' | 'capelao' | 'instrutor';

export const PAPEL_LABEL: Record<Papel, string> = {
  admin_sistema: 'Admin do sistema',
  admin_associacao: 'Admin da Associação',
  diretor: 'Diretor',
  diretor_associado: 'Diretor associado',
  secretario: 'Secretário',
  tesoureiro: 'Tesoureiro',
  conselheiro: 'Conselheiro',
  conselheiro_associado: 'Conselheiro associado',
  capelao: 'Capelão',
  instrutor: 'Instrutor',
};

// Mesmos grupos das funções do banco (papeis_direcao, papeis_lideranca...)
export const DIRECAO: Papel[] = ['admin_sistema', 'admin_associacao', 'diretor', 'diretor_associado', 'secretario', 'tesoureiro'];
export const SECRETARIA: Papel[] = ['admin_sistema', 'admin_associacao', 'diretor', 'diretor_associado', 'secretario'];
export const CONCEDE: Papel[] = ['admin_sistema', 'admin_associacao', 'diretor', 'diretor_associado'];
export const FINANCAS: Papel[] = ['admin_sistema', 'diretor', 'diretor_associado', 'tesoureiro'];
export const LIDERANCA: Papel[] = [...DIRECAO, 'conselheiro', 'conselheiro_associado'];
export const ESPIRITUAL: Papel[] = [...LIDERANCA, 'capelao'];
/** Quem tem qualquer cargo no clube (todos podem dar instrução). */
export const EQUIPE: Papel[] = [...LIDERANCA, 'capelao', 'instrutor'];

export type Cargo = { id: string; papel: Papel; unidade_id: string | null; clube_id: string | null; ano: number };
export type Perfil = {
  id: string; nome_completo: string; clube_id: string | null; sexo: 'M' | 'F' | null;
  tema: 'claro' | 'escuro' | 'sistema' | null; cor_classe: string | null;
};
export type Clube = { id: string; nome: string; cidade: string | null; brasao_url: string | null };
export type Membro = {
  id: string; nome: string; clube_id: string; unidade_id: string | null; classe_id: string | null;
  data_nascimento: string | null; sexo: 'M' | 'F' | null;
  classe: { id: string; nome: string } | null;
};

type ContextoAuth = {
  carregando: boolean;
  sessao: Session | null;
  perfil: Perfil | null;
  cargos: Cargo[];
  clube: Clube | null;
  membro: Membro | null;
  tem: (papeis: Papel[]) => boolean;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
};

const Ctx = createContext<ContextoAuth | null>(null);

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [iniciado, setIniciado] = useState(false);
  // uid cujo perfil já foi carregado: recarregar() não volta a mostrar a tela de espera
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [clube, setClube] = useState<Clube | null>(null);
  const [membro, setMembro] = useState<Membro | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setIniciado(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const carregar = useCallback(async (s: Session | null) => {
    if (!s) {
      setPerfil(null); setCargos([]); setClube(null); setMembro(null); setCarregadoPara(null);
      return;
    }
    try {
      const uid = s.user.id;
      const { data: p } = await supabase
        .from('perfil_usuario')
        .select('id, nome_completo, clube_id, sexo, tema, cor_classe, clube:clube_id(id, nome, cidade, brasao_url)')
        .eq('auth_user_id', uid)
        .maybeSingle();

      let cs: Cargo[] = [];
      if (p) {
        const { data } = await supabase
          .from('perfil_papel')
          .select('id, papel, unidade_id, clube_id, ano')
          .eq('perfil_id', p.id)
          .eq('ativo', true);
        cs = (data ?? []) as Cargo[];
      }

      const filtro = p ? `auth_user_id.eq.${uid},perfil_id.eq.${p.id}` : `auth_user_id.eq.${uid}`;
      const { data: m } = await supabase
        .from('desbravador')
        .select('id, nome, clube_id, unidade_id, classe_id, data_nascimento, sexo, classe:classe_id(id, nome)')
        .or(filtro)
        .limit(1)
        .maybeSingle();

      let cl = (p?.clube as unknown as Clube | null) ?? null;
      if (!cl && m?.clube_id) {
        const { data } = await supabase.from('clube').select('id, nome, cidade, brasao_url').eq('id', m.clube_id).maybeSingle();
        cl = data as Clube | null;
      }

      setPerfil(p ? { ...(p as unknown as Perfil) } : null);
      setCargos(cs);
      setClube(cl);
      setMembro((m as unknown as Membro) ?? null);
    } finally {
      setCarregadoPara(s.user.id);
    }
  }, []);

  useEffect(() => {
    if (iniciado) carregar(sessao);
  }, [iniciado, sessao?.user.id, carregar]); // eslint-disable-line react-hooks/exhaustive-deps

  const valor = useMemo<ContextoAuth>(() => ({
    carregando: !iniciado || (!!sessao && carregadoPara !== sessao.user.id),
    sessao, perfil, cargos, clube, membro,
    tem: (papeis) => cargos.some((c) => papeis.includes(c.papel)),
    recarregar: () => carregar(sessao),
    sair: async () => {
      await supabase.auth.signOut();
      queryClient.clear();
    },
  }), [iniciado, carregadoPara, sessao, perfil, cargos, clube, membro, carregar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do ProvedorAuth');
  return v;
}

/** Unidade que o usuário aconselha (conselheiro ou associado), se houver. */
export function unidadeAconselhada(cargos: Cargo[]) {
  return cargos.find((c) => c.papel === 'conselheiro' || c.papel === 'conselheiro_associado')?.unidade_id ?? null;
}

export function primeiroNome(nome?: string | null) {
  return (nome ?? '').trim().split(/\s+/)[0] || '';
}
