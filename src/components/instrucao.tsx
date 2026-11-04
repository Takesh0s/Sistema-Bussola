// Instrução: aceite pelo instrutor, chamada e conclusão dos requisitos para os presentes.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import * as api from '@/lib/api';
import { DIRECAO, LIDERANCA, useAuth } from '@/lib/auth';
import { capitalizar, dataLonga } from '@/lib/datas';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

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
      <T s={14} w="medio" c="texto2">{i.esp && !i.itens.length ? 'Especialidade completa' : `Requisitos ${api.rotulosInstrucao(i) || '—'}`}</T>
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
  // Com instrutor de fora (sem conta), quem pediu ou a liderança faz a chamada e conclui
  const conduzo = !!i && (souInstrutor || (!i.instrutor_id && (i.atribuido_por === perfil?.id || tem(LIDERANCA))));
  const [perguntaEsp, setPerguntaEsp] = useState(false);

  const classeIds = useMemo(() => [...new Set((i?.itens ?? []).map((x) => x.requisito_classe?.classe?.id).filter(Boolean) as string[])], [i]);
  const [todos, setTodos] = useState(false);

  const membros = useQuery({
    queryKey: ['membros-clube', i?.clube_id],
    queryFn: () => api.membrosDoClube(i!.clube_id),
    enabled: !!i && (conduzo || tem(LIDERANCA)),
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

  async function acao(tipo: 'chamada' | 'concluir' | 'cancelar', esp?: { concluida: boolean; requisitos: string[] }) {
    // Especialidade inteira: antes de concluir, pergunta se terminaram ou o que cumpriram
    if (tipo === 'concluir' && i?.especialidade_id && !esp) {
      if (!candidatos.some((c) => marcas[c.id] === 'P')) return toast('Marque ao menos um presente.', 'erro');
      setPerguntaEsp(true);
      return;
    }
    setPerguntaEsp(false);
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
          const { error } = await supabase.rpc('concluir_instrucao', {
            p_instrucao: id, p_desbravadores: presentes,
            p_especialidade_concluida: esp?.concluida ?? true, p_requisitos: esp && !esp.concluida ? esp.requisitos : null,
          });
          if (error) throw error;
          const quem = presentes.length === 1 ? 'o presente' : `os ${presentes.length} presentes`;
          toast(!esp ? `Requisitos concluídos para ${quem}.` : esp.concluida ? `Especialidade concluída para ${quem}.` : `${esp.requisitos.length} requisitos marcados para ${quem}.`);
          qc.invalidateQueries({ queryKey: ['cartao'] });
          qc.invalidateQueries({ queryKey: ['progresso-esp'] });
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
  const fazendoChamada = conduzo && i.status === 'aceita';
  const instrutorNome = api.nomeInstrutor(i);

  return (
    <View style={{ gap: 14 }}>
      <Capa>
        <Chip texto={`${st.rotulo}${i.inicio ? ' · ' + api.horario(i) : ''}`} bg="terciaria" fg="sobreTerciaria" />
        <T s={24} w="extra" c="sobreDestaque">{api.tituloInstrucao(i)}</T>
        <T s={14} w="medio" c="sobreDestaque">
          {[capitalizar(dataLonga(i.data)), i.local, instrutorNome ? `Instrutor: ${instrutorNome}` : null, i.atribuidor ? `pedido por ${i.atribuidor.nome_completo}` : null].filter(Boolean).join(' · ')}
        </T>
      </Capa>

      {souInstrutor && i.status === 'pendente' ? <CartaoPedido i={i} aoResponder={() => q.refetch()} /> : null}

      <Secao titulo={i.esp && !i.itens.length ? 'Especialidade' : 'Requisitos desta instrução'} />
      {i.esp && !i.itens.length ? (
        <Cartao bg="container" borda={false} p={14} gap={4}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Marca estado={i.status === 'concluida' ? 'ok' : 'inst'} tamanho={24} />
            <View style={{ flex: 1, gap: 4 }}>
              <T s={14} w="negrito" c="sobreContainer">{i.esp.nome}{i.esp.codigo ? ` · ${i.esp.codigo}` : ''}</T>
              <T s={13} c="sobreContainer">{i.status === 'concluida' ? 'Registrada para os presentes.' : 'Ao concluir, diga se a especialidade foi concluída ou marque os requisitos cumpridos no dia.'}</T>
            </View>
          </View>
        </Cartao>
      ) : null}
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
          <Aviso tom="neutro" texto={souInstrutor
            ? 'Ao concluir, cada presente recebe o que foi feito como avaliado por você, com a data de hoje.'
            : `Instrutor de fora: o que for concluído fica registrado em seu nome, com a data de hoje.`} />
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Botao titulo="Salvar chamada" variante="out" onPress={() => acao('chamada')} carregando={salvando === 'chamada'} />
            <Botao titulo={i.especialidade_id && !i.itens.length
              ? `Concluir para ${p === 1 ? 'o presente' : `os ${p} presentes`}`
              : `Concluir ${i.itens.length} requisito${i.itens.length > 1 ? 's' : ''} para ${p === 1 ? 'o presente' : `os ${p} presentes`}`} onPress={() => acao('concluir')} carregando={salvando === 'concluir'} />
          </View>
        </Cartao>
      ) : null}

      {podeCancelar ? <Botao titulo="Cancelar instrução" variante="out" onPress={() => acao('cancelar')} carregando={salvando === 'cancelar'} /> : null}

      {i.esp ? (
        <ModalEspecialidade visivel={perguntaEsp} especialidade={i.esp} aoFechar={() => setPerguntaEsp(false)}
          aoConfirmar={(r) => acao('concluir', r)} />
      ) : null}
    </View>
  );
}

/** Pergunta se a especialidade foi concluída; se não, quais requisitos foram cumpridos no dia. */
function ModalEspecialidade({ visivel, especialidade, aoFechar, aoConfirmar }: {
  visivel: boolean; especialidade: { id: string; nome: string };
  aoFechar: () => void; aoConfirmar: (r: { concluida: boolean; requisitos: string[] }) => void;
}) {
  const { cores } = useTema();
  const [parcial, setParcial] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  useEffect(() => { if (visivel) { setParcial(false); setMarcados(new Set()); } }, [visivel]);
  const reqs = useQuery({
    queryKey: ['req-esp', especialidade.id],
    queryFn: () => dados<api.ReqEspecialidade[]>(supabase.from('requisito_especialidade').select('id, parent_id, numero, rotulo, texto, revisao').eq('especialidade_id', especialidade.id).order('numero')),
    enabled: visivel && parcial,
  });
  const alternar = (id: string) => setMarcados((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable onPress={aoFechar} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 560, maxHeight: '90%', borderRadius: 22, backgroundColor: cores.fundo, padding: 20, gap: 14 }}>
          <T s={20} w="extra">{especialidade.nome}</T>
          {!parcial ? (
            <>
              <T c="texto2">Os presentes concluíram a especialidade hoje?</T>
              <Botao titulo="Sim, concluíram" onPress={() => aoConfirmar({ concluida: true, requisitos: [] })} cheio />
              <Botao titulo="Não, só alguns requisitos" variante="sec" onPress={() => setParcial(true)} cheio />
              <Botao titulo="Voltar" variante="ghost" onPress={aoFechar} />
            </>
          ) : (
            <>
              <T c="texto2">Marque os requisitos que os presentes cumpriram hoje. A especialidade fica em andamento.</T>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 2 }}>
                {reqs.isLoading ? <Carregando /> : (reqs.data ?? []).map((r) => (
                  <Pressable key={r.id} onPress={() => alternar(r.id)} style={{ flexDirection: 'row', gap: 12, padding: 10, paddingLeft: r.parent_id ? 34 : 10, borderRadius: 12,
                    backgroundColor: marcados.has(r.id) ? cores.container : 'transparent' }}>
                    <Marca estado={marcados.has(r.id) ? 'ok' : 'pend'} tamanho={22} />
                    <View style={{ flex: 1 }}>
                      <T s={12} w="negrito" c="primaria">{r.rotulo ?? r.numero}</T>
                      <T s={14} w="medio">{r.texto}</T>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Botao titulo="Voltar" variante="out" onPress={() => setParcial(false)} />
                <Botao titulo={`Marcar ${marcados.size} requisito${marcados.size === 1 ? '' : 's'}`} desabilitado={!marcados.size} cheio
                  onPress={() => aoConfirmar({ concluida: false, requisitos: [...marcados] })} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
