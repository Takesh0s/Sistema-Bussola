// Participação espiritual (visão do capelão, só leitura): vem das chamadas de Classe bíblica.
import { useQuery } from '@tanstack/react-query';
import { Heart, Lock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colunas, Tela } from '@/components/layout';
import { Aviso, Avatar, Capa, Cartao, Carregando, Chip, ChipFiltro, Erro, Item, Progresso, Secao, T, Vazio } from '@/components/ui';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmt } from '@/lib/datas';
import { dados, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

type Linha = { desbravador_id: string; nome: string; unidade_id: string | null; chamadas: number; presencas: number; faltas_seguidas: number; ultima_presenca: string | null };

export default function Espiritual() {
  const { clube } = useAuth();
  const { cores } = useTema();
  const [unidadeSel, setUnidadeSel] = useState<string | null>(null);

  const part = useQuery({
    queryKey: ['espiritual', clube?.id],
    queryFn: () => dados<Linha[]>(supabase.from('participacao_espiritual').select('desbravador_id, nome, unidade_id, chamadas, presencas, faltas_seguidas, ultima_presenca').eq('clube_id', clube!.id)),
    enabled: !!clube,
  });
  const unidades = useQuery({ queryKey: ['unidades', clube?.id], queryFn: () => api.unidadesDoClube(clube!.id), enabled: !!clube });
  const meses = useQuery({
    queryKey: ['espiritual-meses', clube?.id],
    queryFn: async () => {
      const d = new Date(); d.setMonth(d.getMonth() - 3); d.setDate(1);
      const desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return dados<{ data: string; tipo: { espiritual: boolean }; presencas: { presente: boolean }[] }[]>(
        supabase.from('chamada').select('data, tipo:tipo_id!inner(espiritual), presencas:chamada_presenca(presente)')
          .eq('clube_id', clube!.id).eq('tipo.espiritual', true).gte('data', desde) as never);
    },
    enabled: !!clube,
  });

  const linhas = part.data ?? [];
  const taxa = (ls: Linha[]) => {
    const ch = ls.reduce((s, l) => s + Number(l.chamadas), 0);
    return ch ? ls.reduce((s, l) => s + Number(l.presencas), 0) / ch : null;
  };
  const geral = taxa(linhas);
  const porUnidade = (unidades.data ?? []).map((u) => ({ u, t: taxa(linhas.filter((l) => l.unidade_id === u.id)) }));
  const atencao = linhas
    .filter((l) => Number(l.chamadas) > 0 && (Number(l.presencas) / Number(l.chamadas) < 0.5 || Number(l.faltas_seguidas) >= 3))
    .sort((a, b) => Number(a.presencas) / Number(a.chamadas) - Number(b.presencas) / Number(b.chamadas));
  const nomeUnidade = (id: string | null) => unidades.data?.find((u) => u.id === id)?.nome ?? 'Sem unidade';

  const evolucao = useMemo(() => {
    const m = new Map<string, { p: number; t: number }>();
    for (const c of meses.data ?? []) {
      const k = c.data.slice(0, 7);
      const v = m.get(k) ?? { p: 0, t: 0 };
      v.p += c.presencas.filter((x) => x.presente).length; v.t += c.presencas.length;
      m.set(k, v);
    }
    return [...m.entries()].sort().map(([k, v]) => ({ mes: fmt(k + '-15', 'MMM'), taxa: v.t ? v.p / v.t : 0 }));
  }, [meses.data]);

  if (part.isLoading) return <Tela titulo="Espiritual"><Carregando /></Tela>;
  if (part.error) return <Tela titulo="Espiritual"><Erro erro={part.error} tentar={() => part.refetch()} /></Tela>;

  const leitura = <Aviso tom="neutro" icone={Lock} texto="Somente leitura. Os dados vêm das chamadas de Classe bíblica; o capelão acompanha, mas não edita." />;
  const capa = (
    <Capa>
      <T s={14} w="negrito" c="sobreDestaque">Participação na Classe bíblica</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T s={40} w="extra" c="sobreDestaque" style={{ lineHeight: 46 }}>{geral == null ? '—' : `${Math.round(geral * 100)}%`}</T>
        <T s={14} w="medio" c="sobreDestaque">média do ano</T>
      </View>
      <Progresso valor={geral ?? 0} trilho="destaqueB" cor="sobreDestaque" />
    </Capa>
  );
  const barras = (
    <Cartao gap={14}>
      <T s={16} w="negrito">Por unidade</T>
      {porUnidade.map(({ u, t }) => (
        <View key={u.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T s={14} w="medio">{u.nome}{u.classe ? ` · ${u.classe.nome}` : ''}</T>
            <T s={14} w="negrito" c={t != null && t < 0.7 ? 'aviso' : 'texto'}>{t == null ? '—' : `${Math.round(t * 100)}%`}</T>
          </View>
          <Progresso valor={t ?? 0} trilho="superficie2" cor={t != null && t < 0.7 ? 'aviso' : 'primaria'} />
        </View>
      ))}
      {!porUnidade.length ? <T s={13} c="texto2">Nenhuma unidade cadastrada.</T> : null}
    </Cartao>
  );
  const grafico = evolucao.length ? (
    <Cartao gap={16}>
      <T s={16} w="negrito">Evolução mensal</T>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 24, height: 200 }}>
        {evolucao.map((e, i) => (
          <View key={e.mes} style={{ alignItems: 'center', gap: 8 }}>
            <T s={13} w="negrito" c="texto2">{Math.round(e.taxa * 100)}%</T>
            {i === evolucao.length - 1
              ? <LinearGradient colors={[cores.destaqueA, cores.destaqueB]} style={{ width: 64, height: Math.max(8, 150 * e.taxa), borderRadius: 10 }} />
              : <View style={{ width: 64, height: Math.max(8, 150 * e.taxa), borderRadius: 10, backgroundColor: cores.container }} />}
            <T s={13} w="medio" c="texto2">{e.mes}</T>
          </View>
        ))}
      </View>
    </Cartao>
  ) : null;

  const listaAtencao = (
    <View style={{ gap: 10 }}>
      <Secao titulo="Precisam de atenção" />
      {atencao.length ? atencao.slice(0, 8).map((l) => (
        <Item key={l.desbravador_id} esquerda={<Avatar nome={l.nome} />} titulo={l.nome} sub={nomeUnidade(l.unidade_id)}
          direita={<Chip texto={`${l.presencas} de ${l.chamadas}`} bg="aviso" fg="superficie" />} />
      )) : <Vazio texto="Ninguém abaixo de 50% de participação." icone={Heart} />}
    </View>
  );

  const doGrupo = unidadeSel ? linhas.filter((l) => l.unidade_id === unidadeSel) : [];
  const detalheUnidade = (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(unidades.data ?? []).map((u) => <ChipFiltro key={u.id} texto={u.nome} ativo={unidadeSel === u.id} onPress={() => setUnidadeSel(unidadeSel === u.id ? null : u.id)} />)}
      </View>
      {doGrupo.map((l) => (
        <Item key={l.desbravador_id} esquerda={<Avatar nome={l.nome} tamanho={36} />} titulo={l.nome} sub={`${l.presencas} de ${l.chamadas} presenças`}
          direita={<View style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: Math.min(8, Number(l.chamadas)) }, (_, j) => (
              <View key={j} style={{ width: 8, height: 20, borderRadius: 3, backgroundColor: j < Math.round(8 * Number(l.presencas) / Math.max(1, Number(l.chamadas))) ? cores.primaria : cores.superficie2 }} />
            ))}
          </View>}
          style={{ padding: 10, borderRadius: 14 }} />
      ))}
    </View>
  );

  return (
    <Tela titulo="Espiritual" sobre="Participação espiritual" gap={14} acoes={<Chip texto="Somente leitura" bg="primaria" fg="sobrePrimaria" />}
      aoAtualizar={() => { part.refetch(); meses.refetch(); }} atualizando={part.isRefetching}>
      <Colunas largura={480} esquerda={<>{leitura}{capa}{grafico}</>} direita={<>{barras}{listaAtencao}{detalheUnidade}</>} />
    </Tela>
  );
}
