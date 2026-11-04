// Criar ou editar unidade (secretaria). O conselheiro da unidade é escolhido em
// Equipe e cargos, ao conceder o cargo de Conselheiro.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Tela } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Aviso, Botao, BotaoExcluir, Campo, Carregando, ChipFiltro, Segmentado, T } from '@/components/ui';
import * as api from '@/lib/api';
import { SECRETARIA, useAuth } from '@/lib/auth';
import { dados, mensagemErro, supabase } from '@/lib/supabase';

type Sexo = api.Unidade['sexo'];

export default function EditarUnidade() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { clube, tem } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const atual = useQuery({
    queryKey: ['unidade', id],
    queryFn: () => dados<{ id: string; nome: string; sexo: Sexo; classe_id: string | null }>(supabase.from('unidade').select('id, nome, sexo, classe_id').eq('id', id!).single()),
    enabled: !!id,
  });
  const classes = useQuery({ queryKey: ['classes'], queryFn: api.classes, staleTime: Infinity });

  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState<Sexo>('mista');
  const [classeId, setClasseId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (atual.data) { setNome(atual.data.nome); setSexo(atual.data.sexo); setClasseId(atual.data.classe_id); }
  }, [atual.data]);

  async function atualizarListas() {
    await Promise.all([qc.invalidateQueries({ queryKey: ['unidades'] }), qc.invalidateQueries({ queryKey: ['membros-unidade'] })]);
  }

  async function salvar() {
    if (!clube) return;
    if (!nome.trim()) return toast('Dê um nome à unidade.', 'erro');
    setSalvando(true);
    try {
      const linha = { nome: nome.trim(), sexo, classe_id: classeId };
      const { error } = id
        ? await supabase.from('unidade').update(linha).eq('id', id)
        : await supabase.from('unidade').insert({ ...linha, clube_id: clube.id });
      if (error) throw error;
      await atualizarListas();
      toast(id ? 'Unidade salva.' : 'Unidade criada.');
      router.replace('/unidade');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    const { error } = await supabase.from('unidade').delete().eq('id', id!);
    if (error) return toast(mensagemErro(error), 'erro');
    await atualizarListas();
    toast('Unidade excluída.');
    router.replace('/unidade');
  }

  const titulo = id ? 'Editar unidade' : 'Nova unidade';
  if (!tem(SECRETARIA)) {
    return <Tela titulo={titulo} voltar="/unidade" rotuloVoltar="Unidade"><Aviso tom="neutro" texto="Só a secretaria do clube cria e edita unidades." /></Tela>;
  }
  if (id && atual.isLoading) return <Tela titulo={titulo} voltar="/unidade" rotuloVoltar="Unidade"><Carregando /></Tela>;

  return (
    <Tela titulo={titulo} voltar="/unidade" rotuloVoltar="Unidade" gap={14}
      rodape={<Botao titulo={id ? 'Salvar unidade' : 'Criar unidade'} onPress={salvar} carregando={salvando} cheio />}>
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} placeholder="Ex.: Águias" />
      <T s={13} w="semi" c="texto2">Quem pode entrar</T>
      <Segmentado opcoes={[{ valor: 'masculina', rotulo: 'Masculina' }, { valor: 'feminina', rotulo: 'Feminina' }, { valor: 'mista', rotulo: 'Mista' }]}
        valor={sexo} onChange={setSexo} />
      <T s={13} w="semi" c="texto2">Classe da unidade (opcional)</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <ChipFiltro texto="Nenhuma" ativo={!classeId} onPress={() => setClasseId(null)} />
        {(classes.data ?? []).filter((c) => c.tipo !== 'lideranca').map((c) => (
          <ChipFiltro key={c.id} texto={c.nome} ativo={classeId === c.id} onPress={() => setClasseId(c.id)} />
        ))}
      </View>
      <Aviso tom="neutro" texto="O conselheiro da unidade é escolhido em Equipe e cargos, ao conceder o cargo de Conselheiro." />
      {id ? (
        <BotaoExcluir titulo="Excluir unidade" aviso="Os desbravadores desta unidade ficam sem unidade (o cadastro e o histórico deles continuam). Os cargos de conselheiro dela são removidos."
          onConfirmar={excluir} />
      ) : null}
    </Tela>
  );
}
