// Pedir instrução. Requisito de classe: escolhem-se os requisitos. Especialidade:
// só a especialidade — os requisitos cumpridos são marcados ao concluir.
// Instrutor: qualquer pessoa com cargo no clube (responde "aceita?") ou alguém
// de fora, sem conta (aí quem pediu conduz a chamada e conclui).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CampoData, CampoHora, dataISO, horaValida } from '@/components/campos';
import { Tela } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Aviso, Botao, Campo, Cartao, Carregando, ChipFiltro, Marca, Segmentado, T, Vazio } from '@/components/ui';
import * as api from '@/lib/api';
import { PAPEL_LABEL, Papel, useAuth } from '@/lib/auth';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const DE_FORA = 'de-fora';

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
  const [externo, setExterno] = useState('');
  const [data, setData] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [local, setLocal] = useState('');
  const [enviando, setEnviando] = useState(false);

  const classes = useQuery({ queryKey: ['classes'], queryFn: api.classes, staleTime: Infinity });
  const catalogo = useQuery({ queryKey: ['catalogo'], queryFn: api.catalogoEspecialidades, enabled: tipo === 'especialidade', staleTime: 1000 * 60 * 60 });
  const reqs = useQuery({
    queryKey: ['req-escolha', classeId],
    queryFn: () => api.requisitosDaClasse(classeId!),
    enabled: tipo === 'classe' && !!classeId,
  });
  const totalReqsEsp = useQuery({
    queryKey: ['req-esp-total', espId],
    queryFn: async () => (await dados<{ id: string }[]>(supabase.from('requisito_especialidade').select('id').eq('especialidade_id', espId!).is('parent_id', null))).length,
    enabled: tipo === 'especialidade' && !!espId,
  });
  // Todo mundo com cargo ativo no clube pode dar instrução
  const equipe = useQuery({
    queryKey: ['equipe-instrutores', clube?.id],
    queryFn: async () => {
      const linhas = await dados<{ papel: Papel; perfil: { id: string; nome_completo: string } }[]>(supabase.from('perfil_papel')
        .select('papel, perfil:perfil_id(id, nome_completo)').eq('clube_id', clube!.id).eq('ativo', true) as never);
      const porPessoa: Record<string, { id: string; nome: string; papeis: Papel[] }> = {};
      for (const l of linhas) (porPessoa[l.perfil.id] ??= { id: l.perfil.id, nome: l.perfil.nome_completo, papeis: [] }).papeis.push(l.papel);
      return Object.values(porPessoa).sort((a, b) => a.nome.localeCompare(b.nome));
    },
    enabled: !!clube,
  });

  const espEscolhida = catalogo.data?.find((e) => e.id === espId);
  const achadas = useMemo(() => {
    const q = semAcento(busca.trim());
    if (!q || (espEscolhida && busca === espEscolhida.nome)) return [];
    return (catalogo.data ?? []).filter((e) => semAcento(e.nome).includes(q) || semAcento(e.codigo ?? '').includes(q)).slice(0, 8);
  }, [busca, catalogo.data, espEscolhida]);

  const alternar = (id: string) => setMarcados((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  async function enviar() {
    const d = dataISO(data);
    if (tipo === 'classe' && !marcados.size) return toast('Escolha ao menos um requisito.', 'erro');
    if (tipo === 'especialidade' && !espId) return toast('Escolha a especialidade.', 'erro');
    if (!instrutor) return toast('Escolha quem vai dar a instrução.', 'erro');
    if (instrutor === DE_FORA && !externo.trim()) return toast('Informe o nome do instrutor de fora.', 'erro');
    if (!d) return toast('Confira a data (DD/MM/AAAA).', 'erro');
    if (d < api.hojeISO()) return toast('Essa data já passou.', 'erro');
    if (!horaValida(inicio) || !horaValida(fim)) return toast('Confira os horários (HH:MM).', 'erro');
    if (fim && !inicio) return toast('Informe também o horário de início.', 'erro');
    // Terminar à meia-noite (00:00) conta como fim do dia, não como antes do início
    const fimBanco = fim === '00:00' && inicio ? '24:00' : fim;
    if (inicio && fimBanco && fimBanco <= inicio) return toast('O horário de fim precisa ser depois do início.', 'erro');

    setEnviando(true);
    try {
      const { data: nova, error } = await supabase.from('instrucao').insert({
        clube_id: clube!.id, data: d,
        instrutor_id: instrutor === DE_FORA ? null : instrutor,
        instrutor_externo: instrutor === DE_FORA ? externo.trim() : null,
        especialidade_id: tipo === 'especialidade' ? espId : null,
        inicio: inicio || null, fim: fimBanco || null, local: local.trim() || null,
      }).select('id').single();
      if (error) throw error;
      if (tipo === 'classe') {
        const { error: e2 } = await supabase.from('instrucao_requisito').insert([...marcados].map((rid) => ({ instrucao_id: nova.id, requisito_classe_id: rid })));
        if (e2) throw e2;
      }
      await qc.invalidateQueries({ queryKey: ['instrucoes'] });
      toast(instrutor === DE_FORA ? 'Instrução marcada.' : 'Pedido enviado ao instrutor.');
      router.replace(`/instrucoes/${nova.id}`);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  const listaReqs = reqs.data ?? [];

  return (
    <Tela titulo="Pedir instrução" voltar="/instrucoes" rotuloVoltar="Instruções" gap={14}
      rodape={<Botao titulo={instrutor === DE_FORA ? 'Marcar instrução' : 'Enviar pedido'} onPress={enviar} carregando={enviando} cheio />}>
      <Segmentado opcoes={[{ valor: 'classe', rotulo: 'Requisito de classe' }, { valor: 'especialidade', rotulo: 'Especialidade' }]}
        valor={tipo} onChange={(v) => { setTipo(v); setMarcados(new Set()); }} />

      {tipo === 'classe' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {(classes.data ?? []).map((c) => <ChipFiltro key={c.id} texto={c.nome} ativo={classeId === c.id} onPress={() => { setClasseId(c.id); setMarcados(new Set()); }} />)}
          </View>
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
          ) : <Vazio texto="Escolha uma classe." />}
        </>
      ) : (
        <View style={{ gap: 8 }}>
          <Campo rotulo="Especialidade" value={busca} onChangeText={(t) => { setBusca(t); if (espEscolhida && t !== espEscolhida.nome) setEspId(null); }} placeholder="Buscar por nome ou código" />
          {achadas.map((e) => (
            <ChipFiltro key={e.id} texto={`${e.nome}${e.codigo ? ' · ' + e.codigo : ''}`} onPress={() => { setEspId(e.id); setBusca(e.nome); }} />
          ))}
          {espId ? (
            <Cartao bg="container" borda={false} gap={4}>
              <T s={16} w="negrito" c="sobreContainer">{espEscolhida?.nome ?? 'Especialidade'}{espEscolhida?.codigo ? ` · ${espEscolhida.codigo}` : ''}</T>
              <T s={13} c="sobreContainer">
                {totalReqsEsp.data != null ? `${totalReqsEsp.data} requisitos. ` : ''}Não precisa escolher agora: ao concluir, você diz se a especialidade foi concluída ou marca os requisitos cumpridos no dia.
              </T>
            </Cartao>
          ) : null}
        </View>
      )}

      <T s={12} w="negrito" c="texto2" caixaAlta>Quem vai dar a instrução</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(equipe.data ?? []).map((p) => (
          <ChipFiltro key={p.id} texto={`${p.nome} · ${p.papeis.map((x) => PAPEL_LABEL[x]).join(', ')}`} ativo={instrutor === p.id} onPress={() => setInstrutor(p.id)} />
        ))}
        <ChipFiltro texto="Instrutor de fora" ativo={instrutor === DE_FORA} onPress={() => setInstrutor(DE_FORA)} />
      </View>
      {instrutor === DE_FORA ? (
        <>
          <Campo rotulo="Nome do instrutor de fora" value={externo} onChangeText={setExterno} placeholder="Ex.: Pr. João (convidado)" />
          <Aviso tom="neutro" texto="Quem é de fora não usa o app: a instrução já fica marcada, e você faz a chamada e conclui." />
        </>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        <CampoData rotulo="Data" valor={data} aoMudar={setData} style={{ flex: 1, minWidth: 140 }} />
        <CampoHora rotulo="Início" valor={inicio} aoMudar={setInicio} style={{ width: 110 }} />
        <CampoHora rotulo="Fim" valor={fim} aoMudar={setFim} style={{ width: 110 }} />
      </View>
      <Campo rotulo="Local" value={local} onChangeText={setLocal} placeholder="Ex.: Sede do clube" />
      {instrutor !== DE_FORA ? <Aviso tom="neutro" texto="O instrutor recebe o pedido e responde “aceita?”. Você acompanha a resposta em Instruções." /> : null}
    </Tela>
  );
}
