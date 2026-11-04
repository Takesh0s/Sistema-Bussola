// Aceitar convite: mostra o clube e o cargo, cria a conta (ou usa a atual) e
// chama aceitar_convite, que cria o perfil, concede o cargo e queima o token.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import { Aviso, Botao, Brasao, Campo, Capa, Cartao, Carregando, T } from '@/components/ui';
import { PAPEL_LABEL, Papel, useAuth } from '@/lib/auth';
import { entrarComGoogle } from '@/lib/google';
import { dados, mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

type Info = { clube_nome: string; clube_cidade: string | null; papel: Papel; valido: boolean; brasao_url: string | null; unidade_nome: string | null };

export default function Convite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { sessao, perfil, recarregar } = useAuth();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  const info = useQuery({
    queryKey: ['convite', token],
    queryFn: async () => (await dados<Info[]>(supabase.rpc('consultar_convite', { p_token: token })))[0] ?? null,
  });

  async function aceitar() {
    setEnviando(true);
    try {
      const { error } = await supabase.rpc('aceitar_convite', { p_token: token, p_nome: nome.trim() || perfil?.nome_completo || '' });
      if (error) throw error;
      await recarregar();
      toast('Convite aceito. Bem-vindo!');
      router.replace('/');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function criarConta() {
    if (!nome.trim() || !email.trim() || senha.length < 6) return toast('Preencha nome, e-mail e uma senha com 6+ caracteres.', 'erro');
    setEnviando(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha, options: { data: { nome: nome.trim() } } });
      if (error) throw error;
      if (!data.session) {
        toast('Confirme seu e-mail e abra este link de novo para concluir.');
        return;
      }
      const { error: e2 } = await supabase.rpc('aceitar_convite', { p_token: token, p_nome: nome.trim() });
      if (e2) throw e2;
      await recarregar();
      router.replace('/');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  const i = info.data;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: cores.fundo }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 460, gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Brasao url={info.data?.brasao_url} tamanho={72} />
          <T s={28} w="extra">{info.data?.clube_nome ?? 'Bússola'}</T>
        </View>
        {info.isLoading ? <Carregando /> : !i ? (
          <Aviso tom="alerta" texto="Convite não encontrado. Confira o link com a diretoria do clube." />
        ) : !i.valido ? (
          <Aviso tom="alerta" texto="Este convite já foi usado ou expirou. Peça um novo à diretoria do clube." />
        ) : (
          <>
            <Capa>
              <T s={13} w="negrito" c="sobreDestaque" caixaAlta>Convite</T>
              <T s={24} w="extra" c="sobreDestaque">{i.clube_nome}</T>
              <T s={14} w="medio" c="sobreDestaque">{[i.clube_cidade, `Cargo: ${PAPEL_LABEL[i.papel] ?? i.papel}${i.unidade_nome ? ` da unidade ${i.unidade_nome}` : ''}`].filter(Boolean).join(' · ')}</T>
            </Capa>
            {sessao ? (
              <Cartao gap={12}>
                <T s={15} w="negrito">Entrou como {sessao.user.email}</T>
                {!perfil ? <Campo rotulo="Seu nome completo" value={nome} onChangeText={setNome} /> : null}
                <Botao titulo="Aceitar convite" onPress={aceitar} carregando={enviando} cheio />
              </Cartao>
            ) : (
              <Cartao gap={12}>
                <T s={15} w="negrito">Crie sua conta</T>
                <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} />
                <Campo rotulo="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
                <Campo rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry />
                <Botao titulo="Criar conta e aceitar" onPress={criarConta} carregando={enviando} cheio />
                <Botao titulo="Continuar com Google" variante="out" onPress={() => entrarComGoogle(`/convite/${token}`).catch((e) => toast(mensagemErro(e), 'erro'))} cheio />
                <T s={12} c="texto2">Já tem conta? Entre com Google ou pela tela inicial e abra este link de novo.</T>
              </Cartao>
            )}
          </>
        )}
        <Botao titulo="Ir para o início" variante="ghost" onPress={() => router.replace(sessao ? '/' : '/entrar')} />
      </View>
    </ScrollView>
  );
}
