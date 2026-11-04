// Perfil: dados da conta, tema (claro/escuro/sistema) e cor do app.
// Cores permitidas: a classe do desbravador; a classe da unidade que aconselha;
// e, para quem concluiu Líder, Líder Máster ou Líder Máster Avançado, a classe
// de liderança atual. Padrão sempre disponível.
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { LogOut } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Colunas, Tela, useLargo } from '@/components/layout';
import { MeuCartao } from '@/components/meu-cartao';
import { useToast } from '@/components/toast';
import { Avatar, Botao, Capa, Cartao, Chip, Secao, Segmentado, T } from '@/components/ui';
import * as api from '@/lib/api';
import { PAPEL_LABEL, unidadeAconselhada, useAuth } from '@/lib/auth';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { coresDe, ehNomeClasse, ModoTema, NomeClasse, useTema } from '@/theme';

type Opcao = { classe: NomeClasse; motivo: string };

function useOpcoesDeCor(): { opcoes: Opcao[]; carregando: boolean } {
  const { membro, cargos } = useAuth();
  const unidadeId = unidadeAconselhada(cargos);

  const insc = useQuery({ queryKey: ['inscricoes', membro?.id], queryFn: () => api.inscricoesAtivas(membro!.id), enabled: !!membro });
  const unidade = useQuery({
    queryKey: ['unidade-classe', unidadeId],
    queryFn: () => dados<{ classe: { nome: string } | null }>(supabase.from('unidade').select('classe:classe_id(nome)').eq('id', unidadeId!).single() as never),
    enabled: !!unidadeId,
  });

  const opcoes: Opcao[] = [];
  const add = (nome: string | null | undefined, motivo: string) => {
    if (ehNomeClasse(nome) && !opcoes.some((o) => o.classe === nome)) opcoes.push({ classe: nome, motivo });
  };

  const lista = insc.data ?? [];
  const regular = lista.find((i) => i.status === 'em_andamento' && i.classe?.tipo === 'regular')?.classe?.nome ?? (membro?.classe?.nome as string | undefined);
  const lideranca = lista.filter((i) => i.classe?.tipo === 'lideranca').sort((a, b) => (b.classe?.ordem ?? 0) - (a.classe?.ordem ?? 0));
  const concluiuLider = lideranca.some((i) => i.status === 'concluida');

  if (concluiuLider) add(lideranca[0]?.classe?.nome, 'Sua classe de liderança atual');
  if (unidade.data?.classe) add(unidade.data.classe.nome, 'Classe da unidade que você aconselha');
  add(regular, 'Sua classe');
  add('Padrão', 'Cores do Bússola');
  return { opcoes, carregando: insc.isLoading || unidade.isLoading };
}

function Amostra({ classe, motivo, ativo, onPress, grande }: Opcao & { ativo: boolean; onPress: () => void; grande?: boolean }) {
  const { escuro, cores: atuais } = useTema();
  const c = coresDe(classe, escuro);
  const radio = (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: ativo ? atuais.primaria : atuais.borda, alignItems: 'center', justifyContent: 'center' }}>
      {ativo ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: atuais.primaria }} /> : null}
    </View>
  );
  const selo = (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.contorno, padding: 4 }}>
      <LinearGradient colors={[c.seloA, c.seloB]} style={{ flex: 1, borderRadius: 20 }} />
    </View>
  );
  if (grande) {
    return (
      <Pressable onPress={onPress} style={{ flex: 1, minWidth: 220, gap: 12, padding: 16, borderRadius: 20, backgroundColor: c.superficie, borderWidth: ativo ? 2 : 1, borderColor: ativo ? c.primaria : c.borda }}>
        <LinearGradient colors={[c.destaqueA, c.destaqueB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.contorno, padding: 3 }}>
            <LinearGradient colors={[c.seloA, c.seloB]} style={{ flex: 1, borderRadius: 14 }} />
          </View>
          <T s={15} w="extra" style={{ color: c.sobreDestaque }} linhas={1}>{classe}</T>
        </LinearGradient>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.container }}><View style={{ width: '66%', height: 6, borderRadius: 3, backgroundColor: c.primaria }} /></View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: c.container }}><T s={12} w="semi" style={{ color: c.sobreContainer }}>Instrução</T></View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: c.acentoSuave }}><T s={12} w="semi" style={{ color: c.texto }}>Evento</T></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>{radio}<T s={13} w="medio" style={{ color: c.texto2, flex: 1 }} linhas={1}>{motivo}</T></View>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: atuais.superficie,
      borderWidth: ativo ? 2 : 1, borderColor: ativo ? atuais.primaria : atuais.borda }}>
      {radio}
      {selo}
      <View style={{ flex: 1 }}>
        <T s={15} w="negrito">{classe}</T>
        <T s={12} w="medio" c="texto2" linhas={1}>{motivo}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[c.destaqueA, c.destaqueB, c.terciaria, c.acento].map((cor, i) => <View key={i} style={{ width: 12, height: 26, borderRadius: 4, backgroundColor: cor }} />)}
      </View>
    </Pressable>
  );
}

export default function Perfil() {
  const { perfil, membro, clube, cargos, sessao, sair, recarregar } = useAuth();
  const { modo, classe, definirModo, definirClasse } = useTema();
  const largo = useLargo();
  const toast = useToast();
  const { opcoes } = useOpcoesDeCor();
  const nome = perfil?.nome_completo ?? membro?.nome ?? 'Conta';

  async function salvarNaConta(campos: { tema?: ModoTema; cor_classe?: string }) {
    if (!perfil) return;
    const { error } = await supabase.from('perfil_usuario').update(campos).eq('id', perfil.id);
    if (error) toast(mensagemErro(error), 'erro');
    else recarregar();
  }

  function escolherModo(m: ModoTema) {
    definirModo(m);
    salvarNaConta({ tema: m });
  }

  function escolherCor(c: NomeClasse) {
    definirClasse(c);
    salvarNaConta({ cor_classe: c });
  }

  const cabecalho = (
    <Capa>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar nome={nome} tamanho={60} />
        <View style={{ flex: 1 }}>
          <T s={22} w="extra" c="sobreDestaque">{nome}</T>
          <T s={13} w="medio" c="sobreDestaque">{clube?.nome ?? 'Sem clube'}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {cargos.map((c) => <Chip key={c.id} texto={PAPEL_LABEL[c.papel]} bg="terciaria" fg="sobreTerciaria" />)}
        {membro?.classe ? <Chip texto={membro.classe.nome} bg="terciaria" fg="sobreTerciaria" /> : null}
      </View>
    </Capa>
  );

  const tema = (
    <View style={{ gap: 10 }}>
      <T s={12} w="negrito" c="texto2" caixaAlta>Tema</T>
      <Segmentado opcoes={[{ valor: 'claro', rotulo: 'Claro' }, { valor: 'escuro', rotulo: 'Escuro' }, { valor: 'sistema', rotulo: 'Sistema' }]} valor={modo} onChange={escolherModo} />
    </View>
  );

  const cores = (
    <View style={{ gap: 10 }}>
      <T s={12} w="negrito" c="texto2" caixaAlta>Cor do app</T>
      {largo ? (
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          {opcoes.map((o) => <Amostra key={o.classe} {...o} ativo={classe === o.classe} onPress={() => escolherCor(o.classe)} grande />)}
        </View>
      ) : opcoes.map((o) => <Amostra key={o.classe} {...o} ativo={classe === o.classe} onPress={() => escolherCor(o.classe)} />)}
      <T s={12} w="medio" c="texto2">Quem concluiu Líder, Líder Máster ou Líder Máster Avançado pode escolher entre a cor da classe que aconselha e a da sua classe de liderança atual.</T>
    </View>
  );

  const conta = (
    <Cartao gap={0}>
      <View style={{ paddingVertical: 12, gap: 2 }}>
        <T s={15} w="semi">E-mail</T>
        <T s={13} c="texto2">{sessao?.user.email?.includes('@cpf.') ? 'Conta por CPF' : sessao?.user.email}</T>
      </View>
      <Botao titulo="Sair" icone={LogOut} variante="ghost" onPress={sair} style={{ alignSelf: 'flex-start' }} />
    </Cartao>
  );

  return (
    <Tela titulo="Perfil" sobre={largo ? 'Conta' : undefined} gap={16}>
      {largo ? (
        <Colunas largura={440} esquerda={<>{cabecalho}<MeuCartao />{conta}</>} direita={<><Cartao gap={12}><T s={18} w="negrito">Aparência</T>{tema}</Cartao><Cartao gap={12}>{cores}</Cartao></>} />
      ) : (
        <>
          {cabecalho}
          <MeuCartao />
          <Secao titulo="Aparência" />
          {tema}
          {cores}
          <Secao titulo="Conta" />
          {conta}
        </>
      )}
    </Tela>
  );
}
