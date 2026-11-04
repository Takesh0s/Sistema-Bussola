// Chamada por unidade (ou de um evento). O tipo segue a regra do banco:
// conselheiro = Reunião; com instrutor ou instrução = Instrução; ligada a evento = Evento ou acampamento.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Info, Users } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Colunas, Tela, useLargo } from '@/components/layout';
import { useToast } from '@/components/toast';
import {
  Aviso, Avatar, Botao, Campo, Capa, Cartao, Carregando, ChipFiltro, Erro, Item, Numero, Presenca, Progresso, Segmentado, SeletorPresenca, Selo, T, Vazio,
} from '@/components/ui';
import * as api from '@/lib/api';
import { LIDERANCA, unidadeAconselhada, useAuth } from '@/lib/auth';
import { capitalizar, dataLonga, diaMes, fmt } from '@/lib/datas';
import { dados, mensagemErro, supabase } from '@/lib/supabase';

type Tipo = { id: string; nome: string; espiritual: boolean };
const PADRAO = ['Reunião', 'Classe bíblica', 'Instrução', 'Evento ou acampamento'];

function paraISO(txt: string) {
  const m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export default function Chamada() {
  const params = useLocalSearchParams<{ evento?: string; unidade?: string }>();
  const { clube, cargos, tem } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const largo = useLargo();
  const soInstrutor = tem(['instrutor']) && !tem(LIDERANCA);

  const unidades = useQuery({ queryKey: ['unidades', clube?.id], queryFn: () => api.unidadesDoClube(clube!.id), enabled: !!clube });
  const tipos = useQuery({
    queryKey: ['tipos-atividade', clube?.id],
    queryFn: () => dados<Tipo[]>(supabase.from('atividade_tipo').select('id, nome, espiritual').order('nome')),
    enabled: !!clube,
  });
  const evento = useQuery({
    queryKey: ['evento', params.evento],
    queryFn: () => dados<api.Evento>(supabase.from('evento').select('id, titulo, local, inicio, fim, publicado').eq('id', params.evento!).single()),
    enabled: !!params.evento,
  });

  const [unidadeId, setUnidadeId] = useState<string | null>(params.unidade ?? (params.evento ? null : unidadeAconselhada(cargos)));
  useEffect(() => {
    if (!unidadeId && !params.evento && unidades.data?.length) setUnidadeId(unidades.data[0].id);
  }, [unidades.data, unidadeId, params.evento]);

  const [tipoNome, setTipoNome] = useState(params.evento ? 'Evento ou acampamento' : soInstrutor ? 'Instrução' : 'Reunião');
  const [dataTxt, setDataTxt] = useState(fmt(new Date(), 'dd/MM/yyyy'));
  const dataISO = paraISO(dataTxt);
  const tipo = tipos.data?.find((t) => t.nome === tipoNome);

  const membros = useQuery({
    queryKey: ['membros-chamada', unidadeId ?? 'clube', clube?.id],
    queryFn: () => (unidadeId ? api.membrosDaUnidade(unidadeId) : api.membrosDoClube(clube!.id)),
    enabled: !!clube && (!!unidadeId || !!params.evento),
  });
  const ids = (membros.data ?? []).map((m) => m.id);
  const freq = useQuery({
    queryKey: ['freq', ids.join(',')],
    queryFn: () => api.marcacoesDesde(ids, api.inicioTrimestreISO()),
    enabled: ids.length > 0,
  });

  const existente = useQuery({
    queryKey: ['chamada-existente', unidadeId, params.evento, dataISO, tipo?.id],
    queryFn: async () => {
      let q = supabase.from('chamada').select('id, presencas:chamada_presenca(desbravador_id, presente, justificada)')
        .eq('clube_id', clube!.id).eq('data', dataISO!).eq('tipo_id', tipo!.id).is('instrucao_id', null);
      q = unidadeId ? q.eq('unidade_id', unidadeId) : q.is('unidade_id', null);
      q = params.evento ? q.eq('evento_id', params.evento) : q.is('evento_id', null);
      return dados<{ id: string; presencas: { desbravador_id: string; presente: boolean; justificada: boolean }[] } | null>(q.limit(1).maybeSingle() as never);
    },
    enabled: !!clube && !!dataISO && !!tipo,
  });

  const historico = useQuery({
    queryKey: ['chamadas-hist', unidadeId],
    queryFn: () => dados<{ id: string; data: string; tipo: { nome: string } | null; presencas: { presente: boolean }[] }[]>(
      supabase.from('chamada').select('id, data, tipo:tipo_id(nome), presencas:chamada_presenca(presente)').eq('unidade_id', unidadeId!).order('data', { ascending: false }).limit(6) as never),
    enabled: !!unidadeId,
  });

  const [marcas, setMarcas] = useState<Record<string, Presenca>>({});
  useEffect(() => {
    const m: Record<string, Presenca> = {};
    for (const x of membros.data ?? []) m[x.id] = 'P';
    for (const p of existente.data?.presencas ?? []) m[p.desbravador_id] = p.presente ? 'P' : p.justificada ? 'J' : 'F';
    setMarcas(m);
  }, [membros.data, existente.data]);

  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    if (!clube || !tipo || !dataISO) return toast('Confira a data (DD/MM/AAAA).', 'erro');
    setSalvando(true);
    try {
      let id = existente.data?.id;
      if (!id) {
        const { data, error } = await supabase.from('chamada')
          .insert({ clube_id: clube.id, unidade_id: unidadeId, tipo_id: tipo.id, data: dataISO, evento_id: params.evento ?? null })
          .select('id').single();
        if (error) throw error;
        id = data.id;
      }
      const linhas = (membros.data ?? []).map((m) => ({ chamada_id: id, desbravador_id: m.id, presente: marcas[m.id] === 'P', justificada: marcas[m.id] === 'J' }));
      if (linhas.length) {
        const { error } = await supabase.from('chamada_presenca').upsert(linhas, { onConflict: 'chamada_id,desbravador_id' });
        if (error) throw error;
      }
      await Promise.all([existente.refetch(), historico.refetch(), qc.invalidateQueries({ queryKey: ['freq'] })]);
      toast('Chamada salva.');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const unidade = unidades.data?.find((u) => u.id === unidadeId);
  const lista = membros.data ?? [];
  const cont = useMemo(() => ({
    p: lista.filter((m) => marcas[m.id] === 'P').length,
    f: lista.filter((m) => marcas[m.id] === 'F').length,
    j: lista.filter((m) => marcas[m.id] === 'J').length,
  }), [lista, marcas]);

  const dica = tipoNome === 'Classe bíblica'
    ? 'Classe bíblica conta como participação espiritual — o capelão vê o resumo, sem poder editar.'
    : params.evento ? 'Ligada a um evento, a chamada vira “Evento ou acampamento” automaticamente.'
      : soInstrutor ? 'Feita por instrutor, a chamada é registrada como Instrução.'
        : 'Feita pelo conselheiro, o tipo é Reunião. Ligada a uma instrução ou evento, o tipo muda sozinho.';

  const cabecalho = (
    <Capa aneis={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Selo tamanho={30} />
        <T s={15} w="negrito" c="sobreDestaque" style={{ flex: 1 }}>
          {params.evento ? (evento.data?.titulo ?? 'Evento') : unidade ? `Unidade ${unidade.nome}${unidade.classe ? ' · ' + unidade.classe.nome : ''}` : 'Chamada'}
        </T>
      </View>
      <T s={22} w="extra" c="sobreDestaque">{dataISO ? capitalizar(dataLonga(dataISO)) : 'Data inválida'}</T>
      <T s={13} w="medio" c="sobreDestaque">{lista.length} desbravadores{existente.data ? ' · chamada já registrada (editando)' : ''}</T>
    </Capa>
  );

  const seletorUnidade = (unidades.data?.length ?? 0) > 1 || params.evento ? (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {params.evento ? <ChipFiltro texto="Clube todo" ativo={!unidadeId} onPress={() => setUnidadeId(null)} /> : null}
      {(unidades.data ?? []).map((u) => <ChipFiltro key={u.id} texto={u.nome} ativo={unidadeId === u.id} onPress={() => setUnidadeId(u.id)} />)}
    </View>
  ) : null;

  const tiposSeg = (
    <Segmentado opcoes={PADRAO.map((n) => ({ valor: n, rotulo: n === 'Evento ou acampamento' ? 'Evento' : n }))} valor={tipoNome} onChange={setTipoNome} />
  );

  const resumo = (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Numero valor={cont.p} rotulo="Presentes" cor="sucesso" />
      <Numero valor={cont.f} rotulo="Faltas" cor="erro" />
      <Numero valor={cont.j} rotulo="Justificadas" cor="aviso" />
    </View>
  );

  const linhas = membros.isLoading ? <Carregando /> : membros.error ? <Erro erro={membros.error} /> : lista.length ? lista.map((m) => {
    const fq = api.frequencia(freq.data ?? [], m.id);
    return (
      <Item key={m.id} esquerda={<Avatar nome={m.nome} tamanho={36} />} titulo={m.nome}
        sub={fq == null ? 'Sem chamadas no trimestre' : `Frequência ${Math.round(fq * 100)}%`}
        direita={<SeletorPresenca valor={marcas[m.id] ?? 'P'} onChange={(v) => setMarcas((x) => ({ ...x, [m.id]: v }))} />}
        style={{ padding: 10, borderRadius: 14 }} />
    );
  }) : <Vazio texto="Nenhum desbravador nesta unidade." icone={Users} />;

  const lateral = (
    <>
      <Cartao gap={12}>
        <T s={16} w="negrito">Tipo da chamada</T>
        {tiposSeg}
        <T s={13} c="texto2">Definido automaticamente: chamada do conselheiro = Reunião; com instrutor ou requisito = Instrução; ligada a evento = Evento ou acampamento.</T>
        <Campo rotulo="Data" value={dataTxt} onChangeText={setDataTxt} placeholder="DD/MM/AAAA" />
      </Cartao>
      {resumo}
      {unidadeId ? (
        <Cartao gap={12}>
          <T s={16} w="negrito">Últimas chamadas</T>
          {(historico.data ?? []).map((h) => (
            <View key={h.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T s={14} w="medio">{diaMes(h.data)} · {h.tipo?.nome}</T>
              <T s={14} w="negrito" c="texto2">{h.presencas.filter((p) => p.presente).length}/{h.presencas.length}</T>
            </View>
          ))}
          {!historico.data?.length ? <T s={13} c="texto2">Nenhuma chamada ainda.</T> : null}
        </Cartao>
      ) : null}
    </>
  );

  const salvarBotao = <Botao titulo={existente.data ? 'Atualizar chamada' : 'Salvar chamada'} onPress={salvar} carregando={salvando} cheio />;

  if (largo) {
    return (
      <Tela titulo="Chamada" sobre={unidade ? `Unidade ${unidade.nome}` : evento.data?.titulo} voltar={params.evento ? `/agenda` : undefined}
        acoes={<Botao titulo={existente.data ? 'Atualizar chamada' : 'Salvar chamada'} onPress={salvar} carregando={salvando} />}>
        <Colunas largura={420}
          esquerda={<>{cabecalho}{seletorUnidade}{lateral}</>}
          direita={<>{linhas}</>} />
      </Tela>
    );
  }

  return (
    <Tela titulo="Chamada" voltar={params.evento ? '/agenda' : undefined} gap={12} rodape={salvarBotao}>
      {cabecalho}
      {seletorUnidade}
      {tiposSeg}
      <Aviso texto={dica} icone={Info} />
      <Campo rotulo="Data" value={dataTxt} onChangeText={setDataTxt} placeholder="DD/MM/AAAA" />
      {resumo}
      {linhas}
      <Progresso valor={lista.length ? cont.p / lista.length : 0} cor="sucesso" altura={6} />
    </Tela>
  );
}
