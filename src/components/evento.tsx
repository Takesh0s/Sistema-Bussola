// Evento: leitura (seções conforme a visibilidade de cada um) e editor da direção.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, ClipboardCheck, Lock, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import * as api from '@/lib/api';
import { DIRECAO, LIDERANCA, useAuth } from '@/lib/auth';
import { capitalizar, dataLonga, fmt, hora } from '@/lib/datas';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

import { useToast } from './toast';
import { Aviso, Botao, Campo, Capa, Cartao, Carregando, Chip, ChipFiltro, Erro, Secao, Segmentado, T } from './ui';

type Vis = api.Secao['visibilidade'];
const VIS: Record<Vis, { rotulo: string; bg: 'container' | 'acentoSuave' | 'superficie2'; fg: 'sobreContainer' | 'texto' | 'texto2' }> = {
  todos: { rotulo: 'Todos', bg: 'container', fg: 'sobreContainer' },
  lideranca: { rotulo: 'Liderança', bg: 'acentoSuave', fg: 'texto' },
  direcao: { rotulo: 'Só direção', bg: 'superficie2', fg: 'texto2' },
};

export function periodo(e: { inicio: string; fim: string | null }) {
  const ini = capitalizar(dataLonga(e.inicio));
  if (!e.fim) return `${ini}, ${hora(e.inicio)}`;
  if (e.fim.slice(0, 10) === e.inicio.slice(0, 10)) return `${ini}, ${hora(e.inicio)} às ${hora(e.fim)}`;
  return `${fmt(e.inicio, 'd')} a ${fmt(e.fim, "d 'de' MMMM")}`;
}

// 'DD/MM/AAAA HH:MM' ⇄ ISO
export function paraTexto(iso: string | null) {
  return iso ? fmt(iso, 'dd/MM/yyyy HH:mm') : '';
}
export function paraISO(txt: string): string | null {
  const m = txt.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function useEvento(id: string) {
  const ev = useQuery({ queryKey: ['evento', id], queryFn: () => dados<api.Evento>(supabase.from('evento').select('id, titulo, local, inicio, fim, publicado').eq('id', id).single()) });
  const secoes = useQuery({
    queryKey: ['secoes', id],
    queryFn: () => dados<api.Secao[]>(supabase.from('evento_secao').select('id, evento_id, titulo, conteudo, ordem, visibilidade').eq('evento_id', id).order('ordem')),
  });
  return { ev, secoes };
}

export function DetalheEvento({ id, aoEditar }: { id: string; aoEditar?: () => void }) {
  const { tem } = useAuth();
  const { ev, secoes } = useEvento(id);
  if (ev.isLoading) return <Carregando />;
  if (ev.error || !ev.data) return <Erro erro={ev.error} tentar={() => ev.refetch()} />;
  const e = ev.data;
  const direcao = tem(DIRECAO);

  return (
    <View style={{ gap: 12 }}>
      <Capa>
        <Chip texto={e.publicado ? 'Publicado' : 'Rascunho'} bg={e.publicado ? 'terciaria' : 'aviso'} fg={e.publicado ? 'texto' : 'superficie'} />
        <T s={24} w="extra" c="sobreDestaque">{e.titulo}</T>
        <T s={14} w="medio" c="sobreDestaque">{periodo(e)}{e.local ? ` · ${e.local}` : ''}</T>
      </Capa>
      {direcao ? <Aviso tom="neutro" texto="Você vê todas as seções porque é da direção. Desbravadores veem só as marcadas como “Todos”." /> : null}
      {secoes.isLoading ? <Carregando /> : (secoes.data ?? []).map((s) => (
        <Cartao key={s.id} gap={10}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T s={16} w="negrito" style={{ flex: 1 }}>{s.titulo}</T>
            <Chip texto={VIS[s.visibilidade].rotulo} bg={VIS[s.visibilidade].bg} fg={VIS[s.visibilidade].fg} />
          </View>
          {s.conteudo ? <T s={14} c="texto2">{s.conteudo}</T> : null}
        </Cartao>
      ))}
      {!secoes.isLoading && !secoes.data?.length ? <T c="texto2">Este evento ainda não tem seções.</T> : null}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {tem(LIDERANCA) ? <Botao titulo="Fazer chamada do evento" icone={ClipboardCheck} variante="sec" onPress={() => router.push(`/chamada?evento=${e.id}`)} /> : null}
        {direcao && aoEditar ? <Botao titulo="Editar evento" variante="out" onPress={aoEditar} /> : null}
      </View>
    </View>
  );
}

type SecaoEdit = { id: string; titulo: string; conteudo: string; visibilidade: Vis };

export function EditorEvento({ id, aoSair }: { id: string; aoSair: () => void }) {
  const { clube } = useAuth();
  const { cores } = useTema();
  const toast = useToast();
  const qc = useQueryClient();
  const { ev, secoes } = useEvento(id);
  const modelos = useQuery({
    queryKey: ['modelos', clube?.id],
    queryFn: () => dados<{ id: string; nome: string }[]>(supabase.from('evento_modelo').select('id, nome').eq('clube_id', clube!.id).order('nome')),
    enabled: !!clube,
  });

  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [lista, setLista] = useState<SecaoEdit[]>([]);
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [nomeModelo, setNomeModelo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (ev.data) {
      setTitulo(ev.data.titulo); setLocal(ev.data.local ?? ''); setInicio(paraTexto(ev.data.inicio)); setFim(paraTexto(ev.data.fim));
    }
  }, [ev.data]);
  useEffect(() => {
    if (secoes.data) setLista(secoes.data.map((s) => ({ id: s.id, titulo: s.titulo, conteudo: s.conteudo ?? '', visibilidade: s.visibilidade })));
  }, [secoes.data]);

  const mudar = (i: number, p: Partial<SecaoEdit>) => setLista((l) => l.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const mover = (i: number, d: -1 | 1) => setLista((l) => {
    const n = [...l]; const j = i + d;
    if (j < 0 || j >= n.length) return l;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  async function invalidar() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['evento', id] }),
      qc.invalidateQueries({ queryKey: ['secoes', id] }),
      qc.invalidateQueries({ queryKey: ['eventos'] }),
    ]);
  }

  async function salvar(publicado?: boolean) {
    const ini = paraISO(inicio);
    const f = fim.trim() ? paraISO(fim) : null;
    if (!titulo.trim()) return toast('Dê um título ao evento.', 'erro');
    if (!ini) return toast('Início no formato DD/MM/AAAA HH:MM.', 'erro');
    if (fim.trim() && !f) return toast('Fim no formato DD/MM/AAAA HH:MM.', 'erro');
    setSalvando(true);
    try {
      const mudanca: Record<string, unknown> = { titulo: titulo.trim(), local: local.trim() || null, inicio: ini, fim: f };
      if (publicado !== undefined) mudanca.publicado = publicado;
      const { error } = await supabase.from('evento').update(mudanca).eq('id', id);
      if (error) throw error;
      if (removidas.length) {
        const { error: e } = await supabase.from('evento_secao').delete().in('id', removidas);
        if (e) throw e;
      }
      for (const [i, s] of lista.entries()) {
        const linha = { titulo: s.titulo.trim() || 'Seção', conteudo: s.conteudo, visibilidade: s.visibilidade, ordem: i + 1 };
        const { error: e } = s.id.startsWith('novo')
          ? await supabase.from('evento_secao').insert({ ...linha, evento_id: id })
          : await supabase.from('evento_secao').update(linha).eq('id', s.id);
        if (e) throw e;
      }
      setRemovidas([]);
      await invalidar();
      toast(publicado === undefined ? 'Evento salvo.' : publicado ? 'Evento publicado.' : 'Evento voltou a rascunho.');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarModelo() {
    try {
      await salvar();
      const { error } = await supabase.rpc('salvar_como_modelo', { p_evento: id, p_nome: nomeModelo });
      if (error) throw error;
      setNomeModelo('');
      qc.invalidateQueries({ queryKey: ['modelos'] });
      toast('Modelo salvo.');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  async function aplicarModelo(modelo: string) {
    try {
      await salvar();
      const { error } = await supabase.rpc('aplicar_modelo', { p_evento: id, p_modelo: modelo });
      if (error) throw error;
      await invalidar();
      toast('Seções do modelo adicionadas.');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  async function excluir() {
    const { error } = await supabase.from('evento').delete().eq('id', id);
    if (error) return toast(mensagemErro(error), 'erro');
    await qc.invalidateQueries({ queryKey: ['eventos'] });
    toast('Evento excluído.');
    router.replace('/agenda');
  }

  if (ev.isLoading || secoes.isLoading) return <Carregando />;
  if (!ev.data) return <Erro erro={ev.error} />;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Botao titulo="Salvar" onPress={() => salvar()} carregando={salvando} />
        <Botao titulo={ev.data.publicado ? 'Voltar a rascunho' : 'Publicar'} variante="sec" onPress={() => salvar(!ev.data!.publicado)} />
        <Botao titulo="Fechar editor" variante="out" onPress={aoSair} />
      </View>
      <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} />
      <Campo rotulo="Local" value={local} onChangeText={setLocal} placeholder="Ex.: Chácara Recanto" />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Campo rotulo="Início" value={inicio} onChangeText={setInicio} placeholder="DD/MM/AAAA HH:MM" style={{ flex: 1 }} />
        <Campo rotulo="Fim (opcional)" value={fim} onChangeText={setFim} placeholder="DD/MM/AAAA HH:MM" style={{ flex: 1 }} />
      </View>

      <Secao titulo="Seções" acao="+ Adicionar seção" onAcao={() => setLista((l) => [...l, { id: `novo-${Date.now()}`, titulo: '', conteudo: '', visibilidade: 'todos' }])} />
      {lista.map((s, i) => (
        <Cartao key={s.id} gap={10}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Campo value={s.titulo} onChangeText={(v) => mudar(i, { titulo: v })} placeholder="Título da seção" style={{ flex: 1 }} />
            <Pressable onPress={() => mover(i, -1)} hitSlop={6} accessibilityLabel="Subir"><ArrowUp size={20} color={cores.texto2} /></Pressable>
            <Pressable onPress={() => mover(i, 1)} hitSlop={6} accessibilityLabel="Descer"><ArrowDown size={20} color={cores.texto2} /></Pressable>
            <Pressable onPress={() => { if (!s.id.startsWith('novo')) setRemovidas((r) => [...r, s.id]); setLista((l) => l.filter((_, k) => k !== i)); }}
              hitSlop={6} accessibilityLabel="Remover seção"><Trash2 size={20} color={cores.erro} /></Pressable>
          </View>
          <Segmentado opcoes={[{ valor: 'todos', rotulo: 'Todos' }, { valor: 'lideranca', rotulo: 'Liderança' }, { valor: 'direcao', rotulo: 'Direção' }]}
            valor={s.visibilidade} onChange={(v) => mudar(i, { visibilidade: v })} />
          <Campo value={s.conteudo} onChangeText={(v) => mudar(i, { conteudo: v })} placeholder="Conteúdo" multiline />
        </Cartao>
      ))}

      <Cartao gap={10}>
        <T s={15} w="negrito">Modelos</T>
        {modelos.data?.length ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {modelos.data.map((m) => <ChipFiltro key={m.id} texto={`Aplicar: ${m.nome}`} onPress={() => aplicarModelo(m.id)} />)}
          </View>
        ) : <T s={13} c="texto2">Nenhum modelo salvo ainda.</T>}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <Campo rotulo="Salvar seções como modelo" value={nomeModelo} onChangeText={setNomeModelo} placeholder="Ex.: Acampamento padrão" style={{ flex: 1 }} />
          <Botao titulo="Salvar modelo" variante="out" onPress={salvarModelo} desabilitado={!nomeModelo.trim()} />
        </View>
      </Cartao>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Lock size={14} color={cores.texto2} />
        <T s={12} c="texto2" style={{ flex: 1 }}>Rascunhos ficam visíveis só para a direção até serem publicados.</T>
      </View>
      <Botao titulo="Excluir evento" variante="perigo" onPress={excluir} />
    </View>
  );
}
