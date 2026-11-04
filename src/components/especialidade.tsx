// Detalhe de uma especialidade: cabeçalho, requisitos (com subitens) e progresso do membro.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import * as api from '@/lib/api';
import { LIDERANCA, useAuth } from '@/lib/auth';
import { dados, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

import { Botao, Capa, Cartao, Carregando, Erro, Marca, Progresso, Secao, T } from './ui';

type Esp = api.Especialidade & { revisao: string | null; fonte_url: string | null };

export function DetalheEspecialidade({ id }: { id: string }) {
  const { membro, tem } = useAuth();
  const { cores } = useTema();

  const esp = useQuery({
    queryKey: ['especialidade', id],
    queryFn: () => dados<Esp>(supabase.from('especialidades').select('id, nome, codigo, area, revisao, fonte_url').eq('id', id).single()),
  });
  const reqs = useQuery({
    queryKey: ['req-esp', id],
    queryFn: () => dados<api.ReqEspecialidade[]>(supabase.from('requisito_especialidade')
      .select('id, parent_id, numero, rotulo, texto, revisao').eq('especialidade_id', id).order('numero')),
    staleTime: 1000 * 60 * 60,
  });
  const feitos = useQuery({
    queryKey: ['feitos', membro?.id],
    queryFn: () => api.feitosDoMembro(membro!.id),
    enabled: !!membro,
  });

  const feitosSet = useMemo(() => new Set((feitos.data ?? []).map((f) => f.requisito_id).filter(Boolean) as string[]), [feitos.data]);
  const principais = (reqs.data ?? []).filter((r) => !r.parent_id);
  const filhos = (pid: string) => (reqs.data ?? []).filter((r) => r.parent_id === pid);
  const concluidos = principais.filter((r) => feitosSet.has(r.id)).length;

  if (esp.isLoading) return <Carregando />;
  if (esp.error || !esp.data) return <Erro erro={esp.error} tentar={() => esp.refetch()} />;
  const e = esp.data;

  return (
    <View style={{ gap: 12 }}>
      <Capa>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.sobreDestaque }}>
            <T s={18} w="extra" style={{ color: cores.destaqueA }}>{(e.codigo ?? e.nome).slice(0, 2).toUpperCase()}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T s={20} w="extra" c="sobreDestaque">{e.nome}</T>
            <T s={13} w="medio" c="sobreDestaque">{[e.codigo, e.area].filter(Boolean).join(' · ')}</T>
          </View>
        </View>
        {membro ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <T s={30} w="extra" c="sobreDestaque" style={{ lineHeight: 36 }}>{concluidos}</T>
              <T s={14} w="medio" c="sobreDestaque">de {principais.length} requisitos</T>
            </View>
            <Progresso valor={principais.length ? concluidos / principais.length : 0} trilho="destaqueB" cor="sobreDestaque" />
          </>
        ) : null}
      </Capa>

      {tem(LIDERANCA) ? (
        <Botao titulo="Pedir instrução desta especialidade" variante="sec" onPress={() => router.push(`/instrucoes/nova?especialidade=${e.id}`)} cheio />
      ) : null}

      <Secao titulo="Requisitos" />
      {reqs.isLoading ? <Carregando /> : principais.map((r) => (
        <View key={r.id} style={{ gap: 8 }}>
          <Requisito r={r} feito={feitosSet.has(r.id)} />
          {filhos(r.id).map((f) => <View key={f.id} style={{ marginLeft: 20 }}><Requisito r={f} feito={feitosSet.has(f.id)} /></View>)}
        </View>
      ))}

      <Cartao bg="superficie2" borda={false} gap={6}>
        <T s={15} w="negrito">Certificado</T>
        <T s={14} c="texto2">Fica disponível quando todos os requisitos forem concluídos pelo instrutor. O registro aparece no seu cartão.</T>
        {e.revisao ? <T s={12} c="texto2">Fonte: {e.revisao}</T> : null}
      </Cartao>
    </View>
  );
}

function Requisito({ r, feito }: { r: api.ReqEspecialidade; feito: boolean }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda }}>
      <Marca estado={feito ? 'ok' : 'pend'} />
      <View style={{ flex: 1, gap: 4 }}>
        <T s={12} w="negrito" c="primaria">{r.rotulo ?? String(r.numero)}</T>
        <T s={14} w="medio">{r.texto}</T>
      </View>
    </View>
  );
}
