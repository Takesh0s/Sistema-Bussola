// Agenda do clube: próximos e passados, agrupados por mês.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { DetalheEvento, EditorEvento, horaEvento } from '@/components/evento';
import { Tela, useLargo } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Botao, Carregando, Chip, Erro, Item, Segmentado, T, Vazio } from '@/components/ui';
import * as api from '@/lib/api';
import { DIRECAO, useAuth } from '@/lib/auth';
import { dia, diaSemanaCurto, mesAno } from '@/lib/datas';
import { mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

function BlocoData({ iso, destaque }: { iso: string; destaque?: boolean }) {
  const { cores } = useTema();
  const conteudo = (
    <>
      <T s={20} w="extra" style={{ color: destaque ? cores.sobreDestaque : cores.sobreContainer, lineHeight: 24 }}>{dia(iso)}</T>
      <T s={11} w="negrito" style={{ color: destaque ? cores.sobreDestaque : cores.sobreContainer }}>{diaSemanaCurto(iso)}</T>
    </>
  );
  const estilo = { width: 56, paddingVertical: 8, borderRadius: 14, alignItems: 'center' as const };
  return destaque
    ? <LinearGradient colors={[cores.destaqueA, cores.destaqueB]} style={estilo}>{conteudo}</LinearGradient>
    : <View style={[estilo, { backgroundColor: cores.container }]}>{conteudo}</View>;
}

export default function Agenda() {
  const { clube, tem } = useAuth();
  const largo = useLargo();
  const toast = useToast();
  const qc = useQueryClient();
  const [aba, setAba] = useState<'proximos' | 'passados'>('proximos');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const direcao = tem(DIRECAO);

  const q = useQuery({ queryKey: ['eventos', clube?.id], queryFn: () => api.eventos(clube!.id), enabled: !!clube });
  const hoje = api.hojeISO();
  const lista = (q.data ?? [])
    .filter((e) => (aba === 'proximos' ? (e.fim ?? e.inicio).slice(0, 10) >= hoje : (e.fim ?? e.inicio).slice(0, 10) < hoje))
    .sort((a, b) => (aba === 'proximos' ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio)));

  async function novo() {
    if (!clube) return;
    const inicio = new Date(); inicio.setDate(inicio.getDate() + 7); inicio.setHours(19, 0, 0, 0);
    const { data, error } = await supabase.from('evento').insert({ clube_id: clube.id, titulo: 'Novo evento', inicio: inicio.toISOString() }).select('id').single();
    if (error) return toast(mensagemErro(error), 'erro');
    await qc.invalidateQueries({ queryKey: ['eventos'] });
    if (largo) { setSelecionado(data.id); setEditando(true); } else router.push(`/agenda/${data.id}?editar=1`);
  }

  function abrir(id: string) {
    if (largo) { setSelecionado(id); setEditando(false); } else router.push(`/agenda/${id}`);
  }

  let mesAtual = '';
  const itens = lista.map((e) => {
    const mes = mesAno(e.inicio);
    const cab = mes !== mesAtual;
    mesAtual = mes;
    return (
      <View key={e.id} style={{ gap: 10 }}>
        {cab ? <T s={12} w="negrito" c="texto2" caixaAlta style={{ paddingTop: 6 }}>{mes}</T> : null}
        <Item esquerda={<BlocoData iso={e.inicio} destaque={selecionado === e.id} />} titulo={e.titulo}
          sub={`${horaEvento(e)}${e.local ? ' · ' + e.local : ''}`}
          direita={<Chip texto={e.publicado ? 'Publicado' : 'Rascunho'} bg={e.publicado ? 'sucesso' : 'aviso'} fg="superficie" />}
          destaque={selecionado === e.id} onPress={() => abrir(e.id)} />
      </View>
    );
  });

  const coluna = (
    <View style={{ gap: 10 }}>
      <Segmentado opcoes={[{ valor: 'proximos', rotulo: 'Próximos' }, { valor: 'passados', rotulo: 'Passados' }]} valor={aba} onChange={setAba} />
      {q.isLoading ? <Carregando /> : q.error ? <Erro erro={q.error} tentar={() => q.refetch()} /> : itens}
      {!q.isLoading && !lista.length ? <Vazio texto={aba === 'proximos' ? 'Nenhum evento marcado.' : 'Nenhum evento passado.'} icone={CalendarDays} /> : null}
      {direcao ? <Botao titulo="Novo evento" icone={Plus} onPress={novo} cheio /> : null}
    </View>
  );

  if (largo) {
    const atual = selecionado ?? lista[0]?.id ?? null;
    return (
      <Tela titulo="Agenda" sobre={clube?.nome}>
        <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}>
          <View style={{ width: 440 }}>{coluna}</View>
          <View style={{ flex: 1 }}>
            {atual ? (editando
              ? <EditorEvento key={atual} id={atual} aoSair={() => setEditando(false)} />
              : <DetalheEvento key={atual} id={atual} aoEditar={() => { setSelecionado(atual); setEditando(true); }} />)
              : <Vazio texto="Selecione um evento." />}
          </View>
        </View>
      </Tela>
    );
  }

  return (
    <Tela titulo="Agenda" gap={12} aoAtualizar={() => q.refetch()} atualizando={q.isRefetching}>
      {coluna}
    </Tela>
  );
}
