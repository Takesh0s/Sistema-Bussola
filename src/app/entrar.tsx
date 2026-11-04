import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLargo } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Botao, Campo, Cartao, Segmentado, Selo, T } from '@/components/ui';
import { entrarComGoogle } from '@/lib/google';
import { mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/theme';

// Conta de desbravador por CPF: login = CPF no domínio interno; senha inicial = data de nascimento (DDMMAAAA)
export const DOMINIO_CPF = 'cpf.sistemabussola.app';

function soDigitos(v: string) {
  return v.replace(/\D/g, '');
}

function mascaraCpf(v: string) {
  const d = soDigitos(v).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascaraData(v: string) {
  const d = soDigitos(v).slice(0, 8);
  return d.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2');
}

function Formulario() {
  const toast = useToast();
  const [modo, setModo] = useState<'email' | 'cpf'>('email');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cpf, setCpf] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setEnviando(true);
    try {
      const credenciais = modo === 'email'
        ? { email: email.trim(), password: senha }
        : { email: `${soDigitos(cpf)}@${DOMINIO_CPF}`, password: soDigitos(nascimento) };
      if (modo === 'cpf' && (soDigitos(cpf).length !== 11 || soDigitos(nascimento).length !== 8)) {
        throw new Error('Confira o CPF (11 dígitos) e a data de nascimento (DD/MM/AAAA).');
      }
      const { error } = await supabase.auth.signInWithPassword(credenciais);
      if (error) {
        throw new Error(error.message.includes('Invalid login') ? 'E-mail/CPF ou senha incorretos.' : error.message);
      }
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function recuperar() {
    if (!email.trim()) return toast('Digite seu e-mail primeiro.', 'erro');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    toast(error ? mensagemErro(error) : 'Enviamos um link para redefinir sua senha.', error ? 'erro' : 'ok');
  }

  async function google() {
    try {
      await entrarComGoogle('/');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  return (
    <View style={{ gap: 18, width: '100%', maxWidth: 440 }}>
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 24, paddingBottom: 8 }}>
        <Selo tamanho={84} />
        <T s={34} w="extra">Bússola</T>
        <T s={16} w="medio" c="texto2">Seu clube na palma da mão</T>
      </View>

      <Segmentado
        opcoes={[{ valor: 'email', rotulo: 'E-mail' }, { valor: 'cpf', rotulo: 'CPF' }]}
        valor={modo}
        onChange={setModo}
      />

      {modo === 'email' ? (
        <>
          <Campo rotulo="E-mail" prefixo="@" value={email} onChangeText={setEmail} placeholder="seu@email.com"
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Campo rotulo="Senha" value={senha} onChangeText={setSenha} placeholder="••••••••" secureTextEntry
            autoComplete="current-password" textContentType="password" onSubmitEditing={entrar} />
          <Botao titulo="Esqueci minha senha" variante="ghost" pequeno onPress={recuperar} style={{ alignSelf: 'flex-start', marginTop: -10 }} />
        </>
      ) : (
        <>
          <Campo rotulo="CPF" prefixo="#" value={cpf} onChangeText={(v) => setCpf(mascaraCpf(v))} placeholder="000.000.000-00" keyboardType="number-pad" />
          <Campo rotulo="Data de nascimento" value={nascimento} onChangeText={(v) => setNascimento(mascaraData(v))} placeholder="DD/MM/AAAA"
            keyboardType="number-pad" onSubmitEditing={entrar} />
          <T s={13} w="medio" c="texto2">A conta por CPF é criada pela secretaria do clube.</T>
        </>
      )}

      <Botao titulo="Entrar" onPress={entrar} carregando={enviando} cheio />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Linha />
        <T s={13} w="medio" c="texto2">ou</T>
        <Linha />
      </View>

      <Botao titulo="Entrar com Google" variante="out" onPress={google} cheio />

      <Cartao bg="acentoSuave" borda={false} gap={6}>
        <T w="negrito">Recebeu um convite?</T>
        <T s={14} c="texto2">Abra o link enviado pela direção do seu clube para criar sua conta já com o cargo certo.</T>
      </Cartao>
    </View>
  );
}

function Linha() {
  const { cores } = useTema();
  return <View style={{ flex: 1, height: 1, backgroundColor: cores.borda }} />;
}

export default function Entrar() {
  const { cores } = useTema();
  const largo = useLargo();
  const insets = useSafeAreaInsets();

  if (largo) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: cores.fundo }}>
        <LinearGradient colors={[cores.destaqueA, cores.destaqueB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 120, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', width: 620, height: 620, borderRadius: 310, borderWidth: 70, borderColor: cores.terciaria, opacity: 0.5, right: -260, top: -180 }} />
          <View pointerEvents="none" style={{ position: 'absolute', width: 520, height: 520, borderRadius: 260, borderWidth: 50, borderColor: cores.terciaria, opacity: 0.35, left: -260, bottom: -200 }} />
          <View style={{ gap: 20, maxWidth: 560 }}>
            <Selo tamanho={72} />
            <T s={64} w="extra" c="sobreDestaque" style={{ lineHeight: 72 }}>Bússola</T>
            <T s={24} w="medio" c="sobreDestaque">Requisitos, instruções, chamada e eventos do clube num lugar só.</T>
            <View style={{ gap: 12, paddingTop: 16 }}>
              {['Cartão de classe e especialidades sempre à mão', 'Instrutores aceitam e concluem requisitos pela turma', 'Cada um vê a cor da sua classe'].map((t) => (
                <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cores.terciaria }} />
                  <T s={17} w="medio" c="sobreDestaque">{t}</T>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Formulario />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cores.fundo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <Formulario />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
