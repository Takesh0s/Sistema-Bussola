// Cadastro do desbravador (secretaria): nome, nascimento, sexo, unidade, classe
// e contato do responsável. Sem conta no app — o acesso dele vem depois.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { CampoData, dataISO, dataTexto } from '@/components/campos';
import { Tela } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Aviso, Botao, BotaoExcluir, Campo, Cartao, Carregando, Chip, ChipFiltro, Segmentado, T } from '@/components/ui';
import * as api from '@/lib/api';
import { SECRETARIA, useAuth } from '@/lib/auth';
import { dados, mensagemErro, supabase } from '@/lib/supabase';

type Cadastro = {
  id: string; nome: string; data_nascimento: string | null; sexo: 'M' | 'F' | null;
  unidade_id: string | null; classe_id: string | null; contato: string | null; justificativa_sexo: string | null;
};

export default function CadastroDesbravador() {
  const params = useLocalSearchParams<{ id?: string; unidade?: string }>();
  const id = params.id;
  const { clube, tem } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const atual = useQuery({
    queryKey: ['cadastro', id],
    queryFn: () => dados<Cadastro>(supabase.from('desbravador').select('id, nome, data_nascimento, sexo, unidade_id, classe_id, contato, justificativa_sexo').eq('id', id!).single()),
    enabled: !!id,
  });
  const unidades = useQuery({ queryKey: ['unidades', clube?.id], queryFn: () => api.unidadesDoClube(clube!.id), enabled: !!clube });
  const classes = useQuery({ queryKey: ['classes'], queryFn: api.classes, staleTime: Infinity });

  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(params.unidade ?? null);
  const [classeId, setClasseId] = useState<string | null>(null);
  const [contato, setContato] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [classeManual, setClasseManual] = useState(false);

  useEffect(() => {
    const d = atual.data;
    if (!d) return;
    setNome(d.nome); setNascimento(dataTexto(d.data_nascimento)); setSexo(d.sexo); setUnidadeId(d.unidade_id);
    setClasseId(d.classe_id); setContato(d.contato ?? ''); setJustificativa(d.justificativa_sexo ?? ''); setClasseManual(true);
  }, [atual.data]);

  const unidade = unidades.data?.find((u) => u.id === unidadeId);
  // Novo cadastro: a classe acompanha a da unidade, até a pessoa escolher outra
  useEffect(() => {
    if (!id && !classeManual && unidade?.classe) setClasseId(unidade.classe.id);
  }, [id, classeManual, unidade]);

  const excecao = !!sexo && !!unidade && ((unidade.sexo === 'masculina' && sexo === 'F') || (unidade.sexo === 'feminina' && sexo === 'M'));
  const nasc = dataISO(nascimento);
  const anos = useMemo(() => api.idade(nasc), [nasc]);

  async function salvar() {
    if (!clube) return;
    if (!nome.trim()) return toast('Informe o nome do desbravador.', 'erro');
    if (nascimento && !nasc) return toast('Confira a data de nascimento (DD/MM/AAAA).', 'erro');
    if (nasc && nasc > api.hojeISO()) return toast('A data de nascimento está no futuro.', 'erro');
    if (!sexo) return toast('Escolha o sexo.', 'erro');
    if (excecao && !justificativa.trim()) return toast('Informe a justificativa da exceção.', 'erro');
    setSalvando(true);
    try {
      const linha = {
        nome: nome.trim(), data_nascimento: nasc, sexo, unidade_id: unidadeId, classe_id: classeId,
        contato: contato.trim() || null, justificativa_sexo: excecao ? justificativa.trim() : null,
      };
      const { error } = id
        ? await supabase.from('desbravador').update(linha).eq('id', id)
        : await supabase.from('desbravador').insert({ ...linha, clube_id: clube.id });
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['membros-unidade'] }),
        qc.invalidateQueries({ queryKey: ['membros-clube'] }),
        qc.invalidateQueries({ queryKey: ['membro', id] }),
        qc.invalidateQueries({ queryKey: ['cadastro', id] }),
      ]);
      toast(id ? 'Cadastro salvo.' : `${nome.trim().split(' ')[0]} cadastrado.`);
      if (id) router.replace(`/unidade/${id}`);
      else { setNome(''); setNascimento(''); setSexo(null); setContato(''); setJustificativa(''); setClasseManual(false); }
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    const { error } = await supabase.from('desbravador').delete().eq('id', id!);
    if (error) return toast(mensagemErro(error), 'erro');
    await qc.invalidateQueries({ queryKey: ['membros-unidade'] });
    toast('Desbravador removido do clube.');
    router.replace('/unidade');
  }

  const titulo = id ? 'Editar cadastro' : 'Novo desbravador';
  const voltar = id ? `/unidade/${id}` : '/unidade';
  if (!tem(SECRETARIA)) {
    return <Tela titulo={titulo} voltar={voltar}><Aviso tom="neutro" texto="Só a secretaria do clube cadastra desbravadores." /></Tela>;
  }
  if (id && atual.isLoading) return <Tela titulo={titulo} voltar={voltar}><Carregando /></Tela>;

  return (
    <Tela titulo={titulo} voltar={voltar} rotuloVoltar={id ? 'Ficha' : 'Unidade'} gap={14}
      rodape={<Botao titulo={id ? 'Salvar cadastro' : 'Cadastrar desbravador'} onPress={salvar} carregando={salvando} cheio />}>
      <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" />
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <CampoData rotulo="Data de nascimento" valor={nascimento} aoMudar={setNascimento} style={{ flex: 1, minWidth: 140 }} />
        {anos != null ? <Chip texto={`${anos} anos`} style={{ marginBottom: 12 }} /> : null}
      </View>
      <T s={13} w="semi" c="texto2">Sexo</T>
      <Segmentado opcoes={[{ valor: 'M', rotulo: 'Masculino' }, { valor: 'F', rotulo: 'Feminino' }]} valor={sexo ?? ('' as 'M')} onChange={setSexo} />

      <T s={13} w="semi" c="texto2">Unidade</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(unidades.data ?? []).map((u) => <ChipFiltro key={u.id} texto={u.nome} ativo={unidadeId === u.id} onPress={() => setUnidadeId(u.id)} />)}
        <ChipFiltro texto="Sem unidade" ativo={!unidadeId} onPress={() => setUnidadeId(null)} />
      </View>
      {excecao ? (
        <Cartao borda="aviso" gap={10}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Chip texto="Exceção" bg="aviso" fg="superficie" />
            <T s={14} w="negrito" style={{ flex: 1 }}>Unidade {unidade!.sexo} com {sexo === 'F' ? 'uma desbravadora' : 'um desbravador'}</T>
          </View>
          <Campo rotulo="Justificativa (obrigatória)" value={justificativa} onChangeText={setJustificativa} multiline />
        </Cartao>
      ) : null}

      <T s={13} w="semi" c="texto2">Classe</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(classes.data ?? []).map((c) => (
          <ChipFiltro key={c.id} texto={c.nome} ativo={classeId === c.id} onPress={() => { setClasseId(c.id); setClasseManual(true); }} />
        ))}
        <ChipFiltro texto="Ainda não definida" ativo={!classeId} onPress={() => { setClasseId(null); setClasseManual(true); }} />
      </View>

      <Campo rotulo="Contato do responsável (opcional)" value={contato} onChangeText={setContato} placeholder="Ex.: Maria (mãe) · (61) 99999-0000" />
      <Aviso tom="neutro" texto={id
        ? 'Mudar a unidade ou a classe não apaga os requisitos já cumpridos.'
        : 'Depois de cadastrar, a tela fica pronta para o próximo — bom para cadastrar a unidade inteira de uma vez.'} />
      {id ? (
        <BotaoExcluir titulo="Remover do clube" confirmar="Confirmar remoção"
          aviso="Apaga o cadastro e todo o histórico (requisitos, especialidades, presenças e mensalidades). Se ele só mudou de unidade, edite a unidade em vez de remover."
          onConfirmar={excluir} />
      ) : null}
    </Tela>
  );
}
