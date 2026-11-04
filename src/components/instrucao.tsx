// Instrução: aceite pelo instrutor, chamada e conclusão dos requisitos para os presentes.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import * as api from '@/lib/api';
import { DIRECAO, LIDERANCA, useAuth } from '@/lib/auth';
import { capitalizar, dataLonga } from '@/lib/datas';
import { dados, mensagemErro, supabase } from '@/lib/supabase';

import { useToast } from './toast';
import {
  Aviso, Avatar, Botao, Capa, Cartao, Carregando, Chip, Erro, Item, Marca, Presenca, Secao, SeletorPresenca, T,
} from './ui';

export const STATUS_INSTRUCAO: Record<api.Instrucao['status'], { rotulo: string; bg: 'container' | 'terciaria' | 'sucesso' | 'superficie2' | 'erro'; fg: 'sobreContainer' | 'texto' | 'superficie' | 'texto2' }> = {
  pendente: { rotulo: 'Aguardando resposta', bg: 'terciaria', fg: 'texto' },
  aceita: { rotulo: 'Aceita', bg: 'container', fg: 'sobreContainer' },
  recusada: { rotulo: 'Recusada', bg: 'erro', fg: 'superficie' },
  concluida: { rotulo: 'Concluída', bg: 'sucesso', fg: 'superficie' },
  cancelada: { rotulo: 'Cancelada', bg: 'superficie2', fg: 'texto2' },
};

export async function responder(id: string, aceitar: boolean) {
  const { error } = await supabase.rpc('responder_instrucao', { p_instrucao: id, p_aceitar: aceitar });
  if (error) throw error;
}

export function CartaoPedido({ i, aoResponder }: { i: api.Instrucao; aoResponder: () => void }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState<null | boolean>(null);
  const classe = i.itens.find((x) => x.requisito_classe?.classe)?.requisito_classe?.classe?.nome;

  async function r(aceitar: boolean) {
    setEnviando(aceitar);
    try {
      await responder(i.id, aceitar);
      toast(aceitar ? 'Instrução aceita.' : 'Instrução recusada.');
      aoResponder();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Cartao borda="primaria" gap={10}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip texto="Pedido novo" bg="terciaria" fg="sobreTerciaria" />
        {classe ? <Chip texto={classe} /> : null}
      </View>
      <T s={20} w="extra">{api.tituloInstrucao(i)}</T>
      <T s={14} w="medio" c="texto2">Requisitos {api.rotulosInstrucao(i) || '—'}</T>
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <T s={14} w="negrito">{capitalizar(dataLonga(i.data))}</T>
        {i.inicio ? <T s={14} w="medio" c="texto2">{api.horario(i)}</T> : null}
        {i.atribuidor ? <T s={14} w="medio" c="texto2">Pedido por: {i.atribuidor.nome_completo}</T> : null}
      </View>
      {i.local ? <T s={13} c="texto2">Local: {i.local}</T> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Botao titulo="Recusar" variante="out" cheio onPress={() => r(false)} carregando={enviando === false} />
        <Botao titulo="Aceitar" cheio onPress={() => r(true)} carregando={enviando === true} />
      </View>
    </Cartao>
  );
}

export function DetalheInstrucao({ id }: { id: string }) {
  const { perfil, tem } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['instrucao', id], queryFn: () => api.instrucao(id) });
  const i = q.data;
  const souInstrutor = !!i && i.instrutor_id === perfil?.id;

  const classeIds = useMemo(() => [...new Set((i?.itens ?? []).map((x) => x.requisito_classe?.classe?.id).filter(Boolean) as string[])], [i]);
  const [todos, setTodos] = useState(false);

  const membros = useQuery({
    queryKey: ['membros-clube', i?.clube_id],
    queryFn: () => api.membrosDoClube(i!.clube_id),
    enabled: !!i && (souInstrutor || tem(LIDERANCA)),
  });
  const chamada = useQuery({
    queryKey: ['chamada-instrucao', id],
    queryFn: async () => {
      const c = await dados<{ id: string; presencas: { desbravador_id: string; presente: boolean; justificada: boolean }[] } | null>(
        supabase.from('chamada').select('id, presencas:chamada_presenca(desbravador_id, presente, justificada)').eq('instrucao_id', id).limit(1).maybeSingle() as never,
      );
      return c;
    },
    enabled: !!i,
  });

  const candidatos = useMemo(() => {
    const l = membros.data ?? [];
    if (todos || !classeIds.length) return l;
    const ja = new Set((chamada.data?.presencas ?? []).map((p) => p.desbravador_id));
    return l.filter((m) => (m.classe && classeIds.includes(m.classe.id)) || ja.has(m.id));
  }, [membros.data, todos, classeIds, chamada.data]);

  const [marcas, setMarcas] = useState<Record<string, Presenca>>({});
  useEffect(() => {
    const m: Record<string, Presenca> = {};
    for (const c of candidatos) m[c.id] = 'P';
    for (const p of chamada.data?.presencas ?? []) m[p.desbravador_id] = p.presente ? 'P' : p.justificada ? 'J' : 'F';
    setMarcas((atual) => ({ ...m, ...atual }));
  }, [candidatos, chamada.data]);

  const [salvando, setSalvando] = useState<'chamada' | 'concluir' | 'cancelar' | null>(null);

  async function salvarChamada() {
    if (!i) return;
    let chamadaId = chamada.data?.id;
    if (!chamadaId) {
      const { data, error } = await supabase.from('chamada').insert({ clube_id: i.clube_id, instrucao_id: i.id, data: i.data }).select('id').single();
      if (error) throw error;
      chamadaId = data.id;
    }
    const linhas = candidatos.map((c) => ({ chamada_id: chamadaId, desbravador_id: c.id, presente: marcas[c.id] === 'P', justificada: marcas[c.id] === 'J' }));
    if (linhas.length) {
      const { error } = await supabase.from('chamada_presenca').upsert(linhas, { onConflict: 'chamada_id,desbravador_id' });
      if (error) throw error;
    }
    await qc.invalidateQueries({ queryKey: ['chamada-instrucao', id] });
  }

  async function acao(tipo: 'chamada' | 'concluir' | 'cancelar') {
    setSalvando(tipo);
    try {
      if (tipo === 'cancelar') {
        const { error } = await supabase.rpc('cancelar_instrucao', { p_instrucao: id });
        if (error) throw error;
        toast('Instrução cancelada.');
      } else {
        await salvarChamada();
        if (tipo === 'concluir') {
          const presentes = candidatos.filter((c) => marcas[c.id] === 'P').map((c) => c.id);
          if (!presentes.length) throw new Error('Marque ao menos um presente.');
          const { error } = await supabase.rpc('concluir_instrucao', { p_instrucao: id, p_desbravadores: presentes });
          if (error) throw error;
          toast(`Requisitos concluídos para ${presentes.length} presentes.`);
          qc.invalidateQueries({ queryKey: ['cartao'] });
        } else toast('Chamada salva.');
      }
      await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ['instrucoes'] })]);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(null);
    }
  }

  if (q.isLoading) return <Carregando />;
  if (q.error || !i) return <Erro erro={q.error} tentar={() => q.refetch()} />;

  const st = STATUS_INSTRUCAO[i.status];
  const p = candidatos.filter((c) => marcas[c.id] === 'P').length;
  const f = candidatos.filter((c) => marcas[c.id] === 'F').length;
  const j = candidatos.filter((c) => marcas[c.id] === 'J').length;
  const podeCancelar = ['pendente', 'aceita', 'recusada'].includes(i.status) && (i.atribuido_por === perfil?.id || tem(DIRECAO));
  const fazendoChamada = souInstrutor && i.status === 'aceita';

  return (
    <View style={{ gap: 14 }}>
      <Capa>
        <Chip texto={`${st.rotulo}${i.inicio ? ' · ' + api.horario(i) : ''}`} bg="terciaria" fg="sobreTerciaria" />
        <T s={24} w="extra" c="sobreDestaque">{api.tituloInstrucao(i)}</T>
        <T s={14} w="medio" c="sobreDestaque">
          {[capitalizar(dataLonga(i.data)), i.local, i.instrutor ? `Instrutor: ${i.instrutor.nome_completo}` : null, i.atribuidor ? `pedido por ${i.atribuidor.nome_completo}` : null].filter(Boolean).join(' · ')}
        </T>
      </Capa>

      {souInstrutor && i.status === 'pendente' ? <CartaoPedido i={i} aoResponder={() => q.refetch()} /> : null}

      <Secao titulo="Requisitos desta instrução" />
      {i.itens.map((it) => {
        const r = it.requisito_classe ?? it.requisito ?? it.agrupada;
        const origem = it.requisito_classe?.classe?.nome ?? it.requisito?.esp?.nome ?? 'Classes Agrupadas';
        return (
          <Cartao key={it.id} bg="container" borda={false} p={14} gap={4}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Marca estado={i.status === 'concluida' ? 'ok' : 'inst'} tamanho={24} />
              <View style={{ flex: 1, gap: 4 }}>
                <T s={12} w="negrito" c="sobreContainer">{[origem, r?.rotulo].filter(Boolean).join(' · ')}</T>
                <T s={14} w="medio" c="sobreContainer">{r?.texto}</T>
              </View>
            </View>
          </Cartao>
        );
      })}

      {fazendoChamada || chamada.data ? (
        <>
          <Secao titulo="Chamada" acao={fazendoChamada ? 'Todos presentes' : undefined}
            onAcao={() => setMarcas(Object.fromEntries(candidatos.map((c) => [c.id, 'P' as Presenca])))} />
          {classeIds.length && fazendoChamada ? (
            <Botao titulo={todos ? 'Mostrar só a classe da instrução' : 'Mostrar todos do clube'} variante="ghost" pequeno onPress={() => setTodos((t) => !t)} style={{ alignSelf: 'flex-start' }} />
          ) : null}
          {membros.isLoading ? <Carregando /> : candidatos.map((c) => (
            <Item key={c.id} esquerda={<Avatar nome={c.nome} tamanho={36} />} titulo={c.nome}
              sub={marcas[c.id] === 'P' ? 'Presente' : marcas[c.id] === 'J' ? 'Falta justificada' : 'Falta'}
              direita={fazendoChamada ? <SeletorPresenca valor={marcas[c.id] ?? 'P'} onChange={(v) => setMarcas((m) => ({ ...m, [c.id]: v }))} /> : undefined}
              style={{ padding: 10, borderRadius: 14 }} />
          ))}
          {!membros.isLoading && !candidatos.length ? <T c="texto2">Nenhum desbravador nesta classe.</T> : null}
        </>
      ) : null}

      {fazendoChamada ? (
        <Cartao gap={10}>
          <T s={15} w="semi">{p} presente{p === 1 ? '' : 's'} · {f} falta{f === 1 ? '' : 's'} · {j} justificada{j === 1 ? '' : 's'}</T>
          <Aviso tom="neutro" texto="Ao concluir, cada presente recebe os requisitos como avaliados por você, com a data de hoje." />
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Botao titulo="Salvar chamada" variante="out" onPress={() => acao('chamada')} carregando={salvando === 'chamada'} />
            <Botao titulo={`Concluir ${i.itens.length} requisito${i.itens.length > 1 ? 's' : ''} para ${p === 1 ? 'o presente' : `os ${p} presentes`}`} onPress={() => acao('concluir')} carregando={salvando === 'concluir'} />
          </View>
        </Cartao>
      ) : null}

      {podeCancelar ? <Botao titulo="Cancelar instrução" variante="out" onPress={() => acao('cancelar')} carregando={salvando === 'cancelar'} /> : null}
    </View>
  );
}
