// Unidade: desbravadores, progresso na classe, especialidades e frequência.
// A secretaria (diretor, associados e secretário) cria unidades e cadastra desbravadores.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pencil, Plus, UserPlus, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Tela, useLargo } from '@/components/layout';
import { Avatar, Botao, Capa, Cartao, Carregando, Chip, ChipFiltro, Erro, Item, Progresso, Secao, Selo, T, Vazio } from '@/components/ui';
import * as api from '@/lib/api';
import { SECRETARIA, unidadeAconselhada, useAuth } from '@/lib/auth';
import { dados, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

const SEXO = { masculina: 'Masculina', feminina: 'Feminina', mista: 'Mista' } as const;
/** Valor do seletor para os desbravadores ainda sem unidade. */
const SEM = 'sem';

export default function Unidade() {
  const { clube, cargos, tem } = useAuth();
  const { cores } = useTema();
  const largo = useLargo();
  const secretaria = tem(SECRETARIA);
  const unidades = useQuery({ queryKey: ['unidades', clube?.id], queryFn: () => api.unidadesDoClube(clube!.id), enabled: !!clube });
  const semUnidade = useQuery({ queryKey: ['membros-unidade', 'sem', clube?.id], queryFn: () => api.membrosSemUnidade(clube!.id), enabled: !!clube && secretaria });
  const [id, setId] = useState<string | null>(unidadeAconselhada(cargos));
  useEffect(() => {
    if (id && id !== SEM && unidades.data && !unidades.data.some((x) => x.id === id)) setId(null);
    else if (!id && unidades.data?.length) setId(unidades.data[0].id);
    else if (!id && semUnidade.data?.length) setId(SEM);
  }, [id, unidades.data, semUnidade.data]);
  const u = unidades.data?.find((x) => x.id === id);

  const membros = useQuery({
    queryKey: ['membros-unidade', id, clube?.id],
    queryFn: () => (id === SEM ? api.membrosSemUnidade(clube!.id) : api.membrosDaUnidade(id!)),
    enabled: !!id && !!clube,
  });
  const lista = membros.data ?? [];
  const prog = useQuery({ queryKey: ['prog-unidade', id, lista.length], queryFn: () => api.progressoNaClasse(lista), enabled: lista.length > 0 });
  const freq = useQuery({ queryKey: ['freq', lista.map((m) => m.id).join(',')], queryFn: () => api.marcacoesDesde(lista.map((m) => m.id), api.inicioTrimestreISO()), enabled: lista.length > 0 });
  const conselho = useQuery({
    queryKey: ['conselho', id],
    queryFn: () => dados<{ papel: string; perfil: { nome_completo: string } }[]>(supabase.from('perfil_papel').select('papel, perfil:perfil_id(nome_completo)').eq('unidade_id', id!).eq('ativo', true) as never),
    enabled: !!id && id !== SEM,
  });

  const conselheiro = conselho.data?.find((c) => c.papel === 'conselheiro')?.perfil.nome_completo;
  const medias = lista.map((m) => prog.data?.[m.id]).filter(Boolean) as { feitos: number; total: number }[];
  const mediaClasse = medias.length ? medias.reduce((s, p) => s + (p.total ? p.feitos / p.total : 0), 0) / medias.length : 0;
  const fqs = lista.map((m) => api.frequencia(freq.data ?? [], m.id)).filter((x) => x != null) as number[];
  const mediaFreq = fqs.length ? fqs.reduce((a, b) => a + b, 0) / fqs.length : null;

  const capa = u ? (
    <Capa>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Selo tamanho={44} />
        <View style={{ flex: 1 }}>
          <T s={22} w="extra" c="sobreDestaque">Unidade {u.nome}</T>
          <T s={13} w="medio" c="sobreDestaque">{[u.classe?.nome, SEXO[u.sexo], conselheiro ? `Cons. ${conselheiro}` : null].filter(Boolean).join(' · ')}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        {[[String(lista.length), 'desbravadores'], [`${Math.round(mediaClasse * 100)}%`, 'da classe'], [mediaFreq == null ? '—' : `${Math.round(mediaFreq * 100)}%`, 'frequência']].map(([n, l]) => (
          <View key={l}><T s={20} w="extra" c="sobreDestaque">{n}</T><T s={12} w="medio" c="sobreDestaque">{l}</T></View>
        ))}
      </View>
    </Capa>
  ) : null;

  const acoes = u ? (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Botao titulo="Fazer chamada" cheio={!largo} onPress={() => router.push(`/chamada?unidade=${id}`)} />
      <Botao titulo="Pedir instrução" variante="sec" cheio={!largo} onPress={() => router.push(u?.classe ? `/instrucoes/nova?classe=${u.classe.id}` : '/instrucoes/nova')} />
    </View>
  ) : null;

  const qtdSem = semUnidade.data?.length ?? 0;
  const seletor = (unidades.data?.length ?? 0) > 1 || qtdSem ? (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {(unidades.data ?? []).map((x) => <ChipFiltro key={x.id} texto={x.nome} ativo={x.id === id} onPress={() => setId(x.id)} />)}
      {qtdSem ? <ChipFiltro texto={`Sem unidade (${qtdSem})`} ativo={id === SEM} onPress={() => setId(SEM)} /> : null}
    </View>
  ) : null;

  const cadastro = secretaria ? (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Botao titulo="Adicionar desbravador" icone={UserPlus} variante="sec" pequeno
        onPress={() => router.push(u ? `/unidade/cadastro?unidade=${u.id}` : '/unidade/cadastro')} />
      {u ? <Botao titulo="Editar unidade" icone={Pencil} variante="out" pequeno onPress={() => router.push(`/unidade/editar?id=${u.id}`)} /> : null}
      <Botao titulo="Nova unidade" icone={Plus} variante="out" pequeno onPress={() => router.push('/unidade/editar')} />
    </View>
  ) : null;

  const linhas = lista.map((m) => {
    const p = prog.data?.[m.id];
    const fq = api.frequencia(freq.data ?? [], m.id);
    const pct = p?.total ? p.feitos / p.total : 0;
    return (
      <Item key={m.id} esquerda={<Avatar nome={m.nome} />} titulo={m.nome}
        sub={`${p ? `${p.feitos}/${p.total} requisitos · ${p.especialidades} especialidades` : '…'}${fq != null ? ` · ${Math.round(fq * 100)}%` : ''}`}
        direita={
          <View style={{ alignItems: 'flex-end', gap: 4, width: 64 }}>
            <T s={14} w="extra" c="primaria">{Math.round(pct * 100)}%</T>
            <Progresso valor={pct} altura={5} style={{ width: 60 }} />
            {fq != null && fq < 0.6 ? <Chip texto="Atenção" bg="aviso" fg="superficie" /> : null}
          </View>
        }
        onPress={() => router.push(`/unidade/${m.id}`)} style={{ padding: 12 }} />
    );
  });

  if (unidades.isLoading) return <Tela titulo="Unidade"><Carregando /></Tela>;
  if (!unidades.data?.length && !qtdSem) {
    return (
      <Tela titulo="Unidade">
        <Vazio texto="O clube ainda não tem unidades cadastradas." icone={Users} />
        {secretaria ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Botao titulo="Criar a primeira unidade" icone={Plus} onPress={() => router.push('/unidade/editar')} />
            <Botao titulo="Cadastrar desbravador sem unidade" variante="ghost" onPress={() => router.push('/unidade/cadastro')} />
          </View>
        ) : <T s={13} c="texto2" centro>A secretaria do clube cadastra as unidades e os desbravadores.</T>}
      </Tela>
    );
  }

  return (
    <Tela titulo={u ? `Unidade ${u.nome}` : id === SEM ? 'Sem unidade' : 'Unidade'} sobre={u?.classe?.nome} gap={12} acoes={largo ? acoes : undefined}
      aoAtualizar={() => { membros.refetch(); prog.refetch(); freq.refetch(); }} atualizando={membros.isRefetching}>
      {seletor}
      {cadastro}
      {capa}
      {!largo ? acoes : null}
      <Secao titulo="Desbravadores" />
      {membros.isLoading ? <Carregando /> : membros.error ? <Erro erro={membros.error} /> : lista.length ? (
        largo ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{linhas.map((l, i) => <View key={i} style={{ width: '49%' }}>{l}</View>)}</View> : linhas
      ) : <Vazio texto="Nenhum desbravador nesta unidade." icone={Users} />}
      {lista.length ? (
        <Cartao bg="superficie2" borda={false}>
          <T s={13} c="texto2">Toque em um desbravador para ver o cartão, os requisitos pendentes e pedir instrução.</T>
        </Cartao>
      ) : null}
      <View style={{ height: 1, backgroundColor: cores.fundo }} />
    </Tela>
  );
}
