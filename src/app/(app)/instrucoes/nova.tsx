// Pedir instrução: direção ou conselheiro escolhe requisitos (de classe ou de
// especialidade), o instrutor e a data. O instrutor recebe e responde "aceita?".
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Tela } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Aviso, Botao, Campo, Cartao, Carregando, ChipFiltro, Marca, Segmentado, T, Vazio } from '@/components/ui';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function dataISO(txt: string) {
  const m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function horaOk(txt: string) {
  return !txt || /^\d{1,2}:\d{2}$/.test(txt);
}

export default function NovaInstrucao() {
  const params = useLocalSearchParams<{ classe?: string; especialidade?: string }>();
  const { clube } = useAuth();
  const { cores } = useTema();
  const toast = useToast();
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<'classe' | 'especialidade'>(params.especialidade ? 'especialidade' : 'classe');
  const [classeId, setClasseId] = useState<string | null>(params.classe ?? null);
  const [espId, setEspId] = useState<string | null>(params.especialidade ?? null);
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [instrutor, setInstrutor] = useState<string | null>(null);
  const [data, setData] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [local, setLocal] = useState('');
  const [enviando, setEnviando] = useState(false);

  const classes = useQuery({ queryKey: ['classes'], queryFn: api.classes, staleTime: Infinity });
  const catalogo = useQuery({ queryKey: ['catalogo'], queryFn: api.catalogoEspecialidades, enabled: tipo === 'especialidade', staleTime: 1000 * 60 * 60 });
  const reqs = useQuery({
    queryKey: ['req-escolha', tipo, tipo === 'classe' ? classeId : espId],
    queryFn: async () => (tipo === 'classe'
      ? api.requisitosDaClasse(classeId!)
      : dados<api.ReqEspecialidade[]>(supabase.from('requisito_especialidade').select('id, parent_id, numero, rotulo, texto, revisao').eq('especialidade_id', espId!).order('numero'))),
    enabled: tipo === 'classe' ? !!classeId : !!espId,
  });
  const instrutores = useQuery({
    queryKey: ['instrutores', clube?.id],
    queryFn: () => dados<{ perfil: { id: string; nome_completo: string } }[]>(supabase.from('perfil_papel')
      .select('perfil:perfil_id(id, nome_completo)').eq('clube_id', clube!.id).eq('papel', 'instrutor').eq('ativo', true) as never),
    enabled: !!clube,
  });

  const achadas = useMemo(() => {
    const q = semAcento(busca.trim());
    if (!q) return [];
    return (catalogo.data ?? []).filter((e) => semAcento(e.nome).includes(q) || semAcento(e.codigo ?? '').includes(q)).slice(0, 8);
  }, [busca, catalogo.data]);

  const alternar = (id: string) => setMarcados((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  async function enviar() {
    const d = dataISO(data);
    if (!marcados.size) return toast('Escolha ao menos um requisito.', 'erro');
    if (!instrutor) return toast('Escolha o instrutor.', 'erro');
    if (!d) return toast('Data no formato DD/MM/AAAA.', 'erro');
    if (!horaOk(inicio) || !horaOk(fim)) return toast('Horários no formato HH:MM.', 'erro');
    setEnviando(true);
    try {
      const { data: nova, error } = await supabase.from('instrucao')
        .insert({ clube_id: clube!.id, data: d, instrutor_id: instrutor, inicio: inicio || null, fim: fim || null, local: local.trim() || null })
        .select('id').single();
      if (error) throw error;
      const linhas = [...marcados].map((rid) => (tipo === 'classe' ? { instrucao_id: nova.id, requisito_classe_id: rid } : { instrucao_id: nova.id, requisito_id: rid }));
      const { error: e2 } = await supabase.from('instrucao_requisito').insert(linhas);
      if (e2) throw e2;
      await qc.invalidateQueries({ queryKey: ['instrucoes'] });
      toast('Pedido enviado ao instrutor.');
      router.replace(`/instrucoes/${nova.id}`);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  const listaReqs = (reqs.data ?? []) as { id: string; parent_id: string | null; rotulo: string | null; texto: string; numero: number; avancada?: boolean }[];

  return (
    <Tela titulo="Pedir instrução" voltar="/instrucoes" rotuloVoltar="Instruções" gap={14}
      rodape={<Botao titulo="Enviar pedido" onPress={enviar} carregando={enviando} cheio />}>
      <Segmentado opcoes={[{ valor: 'classe', rotulo: 'Requisito de classe' }, { valor: 'especialidade', rotulo: 'Especialidade' }]}
        valor={tipo} onChange={(v) => { setTipo(v); setMarcados(new Set()); }} />

      {tipo === 'classe' ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(classes.data ?? []).map((c) => <ChipFiltro key={c.id} texto={c.nome} ativo={classeId === c.id} onPress={() => { setClasseId(c.id); setMarcados(new Set()); }} />)}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Campo rotulo="Especialidade" value={busca} onChangeText={setBusca} placeholder="Buscar por nome ou código" />
          {achadas.map((e) => (
            <ChipFiltro key={e.id} texto={`${e.nome}${e.codigo ? ' · ' + e.codigo : ''}`} ativo={espId === e.id} onPress={() => { setEspId(e.id); setBusca(e.nome); setMarcados(new Set()); }} />
          ))}
        </View>
      )}

      <T s={12} w="negrito" c="texto2" caixaAlta>Requisitos ({marcados.size} escolhidos)</T>
      {reqs.isLoading ? <Carregando /> : listaReqs.length ? (
        <Cartao p={8} gap={0}>
          {listaReqs.map((r) => (
            <Pressable key={r.id} onPress={() => alternar(r.id)} style={{ flexDirection: 'row', gap: 12, padding: 10, paddingLeft: r.parent_id ? 34 : 10, borderRadius: 12,
              backgroundColor: marcados.has(r.id) ? cores.container : 'transparent' }}>
              <Marca estado={marcados.has(r.id) ? 'ok' : 'pend'} tamanho={22} />
              <View style={{ flex: 1 }}>
                <T s={12} w="negrito" c="primaria">{r.rotulo ?? r.numero}{r.avancada ? ' · Avançada' : ''}</T>
                <T s={14} w="medio">{r.texto}</T>
              </View>
            </Pressable>
          ))}
        </Cartao>
      ) : <Vazio texto={tipo === 'classe' ? 'Escolha uma classe.' : 'Busque e escolha uma especialidade.'} />}

      <T s={12} w="negrito" c="texto2" caixaAlta>Instrutor</T>
      {instrutores.data?.length ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {instrutores.data.map(({ perfil: p }) => <ChipFiltro key={p.id} texto={p.nome_completo} ativo={instrutor === p.id} onPress={() => setInstrutor(p.id)} />)}
        </View>
      ) : <Aviso tom="neutro" texto="Nenhum instrutor no clube ainda. A direção concede o cargo em Equipe e cargos." />}

      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <Campo rotulo="Data" value={data} onChangeText={setData} placeholder="DD/MM/AAAA" style={{ flexGrow: 1, minWidth: 140 }} />
        <Campo rotulo="Início" value={inicio} onChangeText={setInicio} placeholder="HH:MM" style={{ width: 110 }} />
        <Campo rotulo="Fim" value={fim} onChangeText={setFim} placeholder="HH:MM" style={{ width: 110 }} />
      </View>
      <Campo rotulo="Local" value={local} onChangeText={setLocal} placeholder="Ex.: Sede do clube" />
      <Aviso tom="neutro" texto="O instrutor recebe o pedido e responde “aceita?”. Você acompanha a resposta em Instruções." />
    </Tela>
  );
}
