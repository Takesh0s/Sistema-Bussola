// Equipe e cargos: diretoria, liderança, concessão de cargos e convites.
// Diretor: concedido pela Associação. Diretor e associados concedem os demais;
// secretário e tesoureiro são da diretoria, sem esse poder.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Shield, Trash2, UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Colunas, Tela, useLargo } from '@/components/layout';
import { useToast } from '@/components/toast';
import {
  Aviso, Avatar, Botao, Campo, Cartao, Carregando, Chip, ChipFiltro, Erro, Icone, Item, Secao, Segmentado, T, Vazio,
} from '@/components/ui';
import * as api from '@/lib/api';
import { CONCEDE, PAPEL_LABEL, Papel, useAuth } from '@/lib/auth';
import { fmt } from '@/lib/datas';
import { copiarTexto } from '@/lib/copiar';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

type CargoLinha = {
  id: string; papel: Papel; unidade_id: string | null; created_at: string;
  perfil: { id: string; nome_completo: string; sexo: 'M' | 'F' | null };
  unidade: { nome: string } | null; concedente: { nome_completo: string } | null;
};
type Convite = { id: string; papel: Papel; token: string; expira_em: string; unidade: { nome: string } | null };

const DIRETORIA: Papel[] = ['diretor', 'diretor_associado', 'secretario', 'tesoureiro'];
const LIDER: Papel[] = ['conselheiro', 'conselheiro_associado', 'capelao', 'instrutor'];
const UNICOS: Papel[] = ['diretor', 'secretario', 'tesoureiro'];
const DESCRICAO: Partial<Record<Papel, string>> = {
  diretor_associado: 'Ajuda a dirigir e concede cargos',
  secretario: 'Cadastros e atas',
  tesoureiro: 'Mensalidades e cobranças',
  conselheiro: 'Uma unidade por ano',
  conselheiro_associado: 'Apoia o conselheiro da unidade',
  capelao: 'Vê a participação espiritual',
  instrutor: 'Aceita e conclui instruções',
};

export default function Equipe() {
  const { clube, tem } = useAuth();
  const { cores } = useTema();
  const largo = useLargo();
  const toast = useToast();
  const qc = useQueryClient();
  const concede = tem(CONCEDE);
  const ehDiretor = tem(['diretor', 'admin_sistema', 'admin_associacao']);
  const [aba, setAba] = useState<'equipe' | 'conceder' | 'convites'>('equipe');

  const cargos = useQuery({
    queryKey: ['cargos', clube?.id],
    queryFn: () => dados<CargoLinha[]>(supabase.from('perfil_papel')
      .select('id, papel, unidade_id, created_at, perfil:perfil_id(id, nome_completo, sexo), unidade:unidade_id(nome), concedente:concedido_por(nome_completo)')
      .eq('clube_id', clube!.id).eq('ativo', true).order('created_at') as never),
    enabled: !!clube,
  });
  const pessoas = useQuery({
    queryKey: ['pessoas', clube?.id],
    queryFn: () => dados<{ id: string; nome_completo: string; sexo: 'M' | 'F' | null }[]>(supabase.from('perfil_usuario').select('id, nome_completo, sexo').eq('clube_id', clube!.id).order('nome_completo')),
    enabled: !!clube && concede,
  });
  const unidades = useQuery({ queryKey: ['unidades', clube?.id], queryFn: () => api.unidadesDoClube(clube!.id), enabled: !!clube });
  const convites = useQuery({
    queryKey: ['convites', clube?.id],
    queryFn: () => dados<Convite[]>(supabase.from('convite').select('id, papel, token, expira_em, unidade:unidade_id(nome)').eq('clube_id', clube!.id).is('usado_por', null).order('created_at', { ascending: false }) as never),
    enabled: !!clube && concede,
  });

  // ── Conceder ──
  const [pessoa, setPessoa] = useState<string | null>(null);
  const [papel, setPapel] = useState<Papel>('conselheiro');
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ocupados = useMemo(() => new Set((cargos.data ?? []).filter((c) => UNICOS.includes(c.papel)).map((c) => c.papel)), [cargos.data]);
  const precisaUnidade = papel === 'conselheiro' || papel === 'conselheiro_associado';
  const pessoaSel = pessoas.data?.find((p) => p.id === pessoa);
  const unidadeSel = unidades.data?.find((u) => u.id === unidadeId);
  const excecaoSexo = !!pessoaSel?.sexo && !!unidadeSel && ((unidadeSel.sexo === 'masculina' && pessoaSel.sexo === 'F') || (unidadeSel.sexo === 'feminina' && pessoaSel.sexo === 'M'));
  const opcoes: Papel[] = [...(ehDiretor ? (['diretor_associado'] as Papel[]) : []), 'secretario', 'tesoureiro', 'conselheiro', 'conselheiro_associado', 'capelao', 'instrutor'];

  async function conceder() {
    if (!clube || !pessoa) return toast('Escolha a pessoa.', 'erro');
    if (precisaUnidade && !unidadeId) return toast('Escolha a unidade.', 'erro');
    if (excecaoSexo && !justificativa.trim()) return toast('Informe a justificativa da exceção.', 'erro');
    setEnviando(true);
    try {
      const { error } = await supabase.from('perfil_papel').insert({
        perfil_id: pessoa, clube_id: clube.id, papel, unidade_id: precisaUnidade ? unidadeId : null,
        justificativa_sexo: excecaoSexo ? justificativa.trim() : null,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['cargos'] });
      toast(`${PAPEL_LABEL[papel]} concedido a ${pessoaSel?.nome_completo}.`);
      setPessoa(null); setJustificativa(''); setAba('equipe');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function revogar(c: CargoLinha) {
    const { error } = await supabase.from('perfil_papel').update({ ativo: false }).eq('id', c.id);
    if (error) return toast(mensagemErro(error), 'erro');
    await qc.invalidateQueries({ queryKey: ['cargos'] });
    toast(`${PAPEL_LABEL[c.papel]} revogado.`);
  }

  // ── Convites ──
  const [papelConvite, setPapelConvite] = useState<Papel>('conselheiro');
  const [unidadeConvite, setUnidadeConvite] = useState<string | null>(null);
  const linkDe = (token: string) => (Platform.OS === 'web' ? `${window.location.origin}/convite/${token}` : `bussola://convite/${token}`);

  async function convidar() {
    if (!clube) return;
    const comUnidade = papelConvite === 'conselheiro' || papelConvite === 'conselheiro_associado';
    if (comUnidade && !unidadeConvite) return toast('Escolha a unidade do convite.', 'erro');
    const { data, error } = await supabase.from('convite').insert({ clube_id: clube.id, papel: papelConvite, unidade_id: comUnidade ? unidadeConvite : null }).select('token').single();
    if (error) return toast(mensagemErro(error), 'erro');
    await qc.invalidateQueries({ queryKey: ['convites'] });
    const como = await copiarTexto(linkDe(data.token)).catch(() => null);
    toast(como === 'copiado' ? 'Convite criado. Link copiado.' : 'Convite criado.');
  }

  async function copiar(token: string) {
    const como = await copiarTexto(linkDe(token)).catch(() => null);
    if (como === 'copiado') toast('Link copiado.');
  }

  async function revogarConvite(id: string) {
    const { error } = await supabase.from('convite').delete().eq('id', id);
    if (error) return toast(mensagemErro(error), 'erro');
    qc.invalidateQueries({ queryKey: ['convites'] });
  }

  const regra = (
    <Cartao bg="acentoSuave" borda={false} gap={6}>
      <T s={14} w="negrito">Quem concede cargos</T>
      <T s={13} c="texto2">O diretor é concedido pela Associação. Diretor e diretores associados concedem os demais cargos. Secretário e tesoureiro fazem parte da diretoria, sem esse poder.</T>
    </Cartao>
  );

  const pessoaLinha = (c: CargoLinha) => {
    const podeRevogar = concede && c.papel !== 'diretor' && (c.papel !== 'diretor_associado' || ehDiretor);
    return (
      <Item key={c.id} esquerda={<Avatar nome={c.perfil.nome_completo} />} titulo={c.perfil.nome_completo}
        sub={c.unidade ? `Unidade ${c.unidade.nome}` : c.papel === 'diretor' ? 'Concedido pela Associação' : c.concedente ? `Concedido por ${c.concedente.nome_completo.split(' ')[0]} · ${fmt(c.created_at, 'MMM/yyyy')}` : undefined}
        direita={
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Chip texto={PAPEL_LABEL[c.papel]} bg={c.papel.startsWith('diretor') ? 'primaria' : 'container'} fg={c.papel.startsWith('diretor') ? 'sobrePrimaria' : 'sobreContainer'} />
            {podeRevogar ? <Pressable onPress={() => revogar(c)} hitSlop={6}><T s={12} w="negrito" c="erro">Revogar</T></Pressable> : null}
          </View>
        }
        style={{ padding: 12 }} />
    );
  };

  const grupo = (titulo: string, papeis: Papel[]) => {
    const ls = (cargos.data ?? []).filter((c) => papeis.includes(c.papel)).sort((a, b) => papeis.indexOf(a.papel) - papeis.indexOf(b.papel));
    return (
      <View style={{ gap: 10, flex: largo ? 1 : undefined }}>
        <Secao titulo={titulo} />
        {ls.length ? ls.map(pessoaLinha) : <T s={13} c="texto2">Ninguém ainda.</T>}
      </View>
    );
  };

  const formConceder = concede ? (
    <Cartao gap={14} p={20}>
      <T s={18} w="negrito">Conceder cargo</T>
      <T s={12} w="negrito" c="texto2" caixaAlta>Pessoa</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(pessoas.data ?? []).map((p) => <ChipFiltro key={p.id} texto={p.nome_completo} ativo={pessoa === p.id} onPress={() => setPessoa(p.id)} />)}
      </View>
      <T s={12} c="texto2">Quem ainda não tem conta entra por convite (abaixo).</T>
      <T s={12} w="negrito" c="texto2" caixaAlta>Cargo</T>
      <View>
        {opcoes.map((p) => {
          const ocupado = UNICOS.includes(p) && ocupados.has(p);
          return (
            <Pressable key={p} disabled={ocupado} onPress={() => setPapel(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: papel === p ? cores.primaria : cores.borda, alignItems: 'center', justifyContent: 'center' }}>
                {papel === p ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cores.primaria }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <T s={15} w="negrito" c={ocupado ? 'texto2' : 'texto'}>{PAPEL_LABEL[p]}</T>
                <T s={12} w="medio" c="texto2">{DESCRICAO[p]}</T>
              </View>
              {ocupado ? <Chip texto="Ocupado" bg="superficie2" fg="texto2" /> : null}
            </Pressable>
          );
        })}
      </View>
      {precisaUnidade ? (
        <>
          <T s={12} w="negrito" c="texto2" caixaAlta>Unidade</T>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {(unidades.data ?? []).map((u) => <ChipFiltro key={u.id} texto={`${u.nome}${u.classe ? ' · ' + u.classe.nome : ''}`} ativo={unidadeId === u.id} onPress={() => setUnidadeId(u.id)} />)}
          </View>
        </>
      ) : null}
      {excecaoSexo ? (
        <Cartao borda="aviso" gap={10}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Chip texto="Exceção" bg="aviso" fg="superficie" />
            <T s={14} w="negrito" style={{ flex: 1 }}>Unidade {unidadeSel!.sexo} com {pessoaSel!.sexo === 'F' ? 'conselheira' : 'conselheiro'}</T>
          </View>
          <Campo rotulo="Justificativa (obrigatória)" value={justificativa} onChangeText={setJustificativa} multiline />
        </Cartao>
      ) : null}
      <Botao titulo="Conceder cargo" onPress={conceder} carregando={enviando} cheio />
    </Cartao>
  ) : null;

  const blocoConvites = concede ? (
    <Cartao gap={14} p={20}>
      <T s={18} w="negrito">Convidar por link</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {opcoes.filter((p) => !(UNICOS.includes(p) && ocupados.has(p))).map((p) => <ChipFiltro key={p} texto={PAPEL_LABEL[p]} ativo={papelConvite === p} onPress={() => setPapelConvite(p)} />)}
      </View>
      {papelConvite === 'conselheiro' || papelConvite === 'conselheiro_associado' ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(unidades.data ?? []).map((u) => <ChipFiltro key={u.id} texto={u.nome} ativo={unidadeConvite === u.id} onPress={() => setUnidadeConvite(u.id)} />)}
        </View>
      ) : null}
      <Botao titulo="Gerar convite" icone={Link2} onPress={convidar} cheio />
      <T s={16} w="negrito">Convites pendentes</T>
      {(convites.data ?? []).map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icone icone={Link2} bg="superficie2" fg="texto2" tamanho={36} />
          <View style={{ flex: 1 }}>
            <T s={14} w="negrito">{PAPEL_LABEL[c.papel]}{c.unidade ? ` · ${c.unidade.nome}` : ''}</T>
            <T s={12} c="texto2">Expira em {fmt(c.expira_em, 'dd/MM')}</T>
          </View>
          <Botao titulo="Copiar" variante="ghost" pequeno onPress={() => copiar(c.token)} />
          <Pressable onPress={() => revogarConvite(c.id)} hitSlop={6} accessibilityLabel="Revogar convite"><Trash2 size={18} color={cores.erro} /></Pressable>
        </View>
      ))}
      {!convites.data?.length ? <T s={13} c="texto2">Nenhum convite pendente.</T> : null}
    </Cartao>
  ) : null;

  if (cargos.isLoading) return <Tela titulo="Equipe e cargos"><Carregando /></Tela>;
  if (cargos.error) return <Tela titulo="Equipe e cargos"><Erro erro={cargos.error} tentar={() => cargos.refetch()} /></Tela>;

  if (largo) {
    return (
      <Tela titulo="Equipe e cargos" sobre={`${clube?.nome} · ${new Date().getFullYear()}`}>
        <Colunas largura={460}
          esquerda={<>{formConceder ?? <Vazio texto="Só diretor e associados concedem cargos." icone={Shield} />}{blocoConvites}</>}
          direita={<>{regra}<View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>{grupo('Diretoria', DIRETORIA)}{grupo('Liderança', LIDER)}</View></>} />
      </Tela>
    );
  }

  return (
    <Tela titulo="Equipe e cargos" gap={12} acoes={concede ? <Pressable onPress={() => setAba('conceder')} hitSlop={8}><UserPlus size={22} color={cores.primaria} /></Pressable> : undefined}>
      <Segmentado opcoes={[{ valor: 'equipe', rotulo: 'Equipe' }, ...(concede ? [{ valor: 'conceder' as const, rotulo: 'Conceder' }, { valor: 'convites' as const, rotulo: `Convites (${convites.data?.length ?? 0})` }] : [])]}
        valor={aba} onChange={setAba} />
      {aba === 'equipe' ? <>{regra}{grupo('Diretoria', DIRETORIA)}{grupo('Liderança', LIDER)}</> : aba === 'conceder' ? formConceder : blocoConvites}
      <Aviso tom="neutro" texto="Revogar um cargo mantém o histórico; a pessoa só perde o acesso daquele cargo." />
    </Tela>
  );
}
