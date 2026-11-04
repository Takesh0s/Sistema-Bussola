// Estrutura das telas: Shell (barra lateral no PC, abas no celular),
// Tela (cabeçalho + conteúdo rolável) e Colunas (lado a lado no PC).
import { router, usePathname } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleProp, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PAPEL_LABEL, useAuth } from '@/lib/auth';
import { useTema } from '@/theme';

import { abasDoCelular, MENU, rotaAtiva } from './menu';
import { Avatar, Selo, T } from './ui';

export const LARGURA_PC = 1024;

export function useLargo() {
  return useWindowDimensions().width >= LARGURA_PC;
}

function useAcesso() {
  const { membro, tem } = useAuth();
  return { membro: !!membro, tem };
}

// ── Shell ───────────────────────────────────────────────────────────────────
export function Shell({ children }: { children: ReactNode }) {
  const largo = useLargo();
  const { cores } = useTema();
  if (largo) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: cores.fundo }}>
        <BarraLateral />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={{ flex: 1 }}>{children}</View>
      <BarraAbas />
    </View>
  );
}

function BarraLateral() {
  const { cores } = useTema();
  const pathname = usePathname();
  const acesso = useAcesso();
  const { perfil, membro, clube, cargos } = useAuth();
  const itens = MENU.filter((m) => m.visivel(acesso));
  let grupoAtual: string | undefined;

  return (
    <View style={{ width: 272, backgroundColor: cores.superficie, borderRightWidth: 1, borderColor: cores.borda, paddingHorizontal: 20, paddingVertical: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
        <Selo tamanho={34} />
        <T s={20} w="extra">Bússola</T>
      </View>
      {clube ? <T s={12} w="medio" c="texto2" style={{ paddingLeft: 44, paddingBottom: 12 }} linhas={1}>{clube.nome}</T> : <View style={{ height: 12 }} />}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2 }}>
        {itens.map((m) => {
          const cabecalho = m.grupo && m.grupo !== grupoAtual;
          grupoAtual = m.grupo;
          const ativo = rotaAtiva(pathname, m.rota);
          const I = m.icone;
          return (
            <View key={m.rota}>
              {cabecalho ? <T s={11} w="negrito" c="texto2" caixaAlta style={{ paddingTop: 16, paddingBottom: 6, paddingHorizontal: 12 }}>{m.grupo}</T> : null}
              <Pressable onPress={() => router.navigate(m.rota as never)}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
                  backgroundColor: ativo ? cores.container : pressed ? cores.superficie2 : 'transparent' }]}>
                <I size={18} color={ativo ? cores.sobreContainer : cores.texto2} />
                <T s={15} w={ativo ? 'negrito' : 'medio'} c={ativo ? 'sobreContainer' : 'texto'}>{m.rotulo}</T>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 16, borderTopWidth: 1, borderColor: cores.borda }}>
        <Avatar nome={perfil?.nome_completo ?? membro?.nome} tamanho={36} />
        <View style={{ flex: 1 }}>
          <T s={14} w="negrito" linhas={1}>{perfil?.nome_completo ?? membro?.nome ?? 'Conta'}</T>
          <T s={12} c="texto2" linhas={1}>{cargos[0] ? PAPEL_LABEL[cargos[0].papel] : membro ? 'Desbravador' : 'Sem clube'}</T>
        </View>
      </View>
    </View>
  );
}

function BarraAbas() {
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const abas = abasDoCelular(useAcesso());
  const android = Platform.OS === 'android';

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: android ? 12 : 8, paddingBottom: Math.max(insets.bottom, android ? 12 : 8),
      backgroundColor: android ? cores.superficie2 : cores.superficie, borderTopWidth: android ? 0 : 1, borderColor: cores.borda }}>
      {abas.map((a) => {
        const ativo = rotaAtiva(pathname, a.rota);
        const I = a.icone;
        return (
          <Pressable key={a.rota} onPress={() => router.navigate(a.rota as never)} accessibilityRole="tab" accessibilityState={{ selected: ativo }}
            style={{ alignItems: 'center', gap: android ? 4 : 2, minWidth: 72 }}>
            {android ? (
              <View style={{ width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? cores.container : 'transparent' }}>
                <I size={20} color={ativo ? cores.sobreContainer : cores.texto2} />
              </View>
            ) : (
              <I size={24} color={ativo ? cores.primaria : cores.texto2} />
            )}
            <T s={android ? 12 : 11} w={ativo ? 'negrito' : 'medio'} style={{ color: ativo ? (android ? cores.texto : cores.primaria) : cores.texto2 }}>{a.rotulo}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Tela ────────────────────────────────────────────────────────────────────
type TelaProps = {
  titulo: string;
  sobre?: string;
  /** true volta para a tela anterior; uma rota volta para ela quando não há histórico */
  voltar?: boolean | string;
  rotuloVoltar?: string;
  acoes?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  aoAtualizar?: () => void;
  atualizando?: boolean;
  gap?: number;
  /** No celular, sem barra de título (a tela mostra a própria saudação). */
  semCabecalhoCelular?: boolean;
};

export function Tela({ titulo, sobre, voltar, rotuloVoltar = 'Voltar', acoes, children, rodape, aoAtualizar, atualizando = false, gap = 20, semCabecalhoCelular }: TelaProps) {
  const { cores } = useTema();
  const largo = useLargo();
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';

  const irVoltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace((typeof voltar === 'string' ? voltar : '/') as never);
  };

  const cabecalho = largo ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 }}>
      {voltar ? (
        <Pressable onPress={irVoltar} hitSlop={8} accessibilityLabel={rotuloVoltar}
          style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.superficie2 }}>
          <ArrowLeft size={20} color={cores.texto} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        {sobre ? <T s={14} w="medio" c="texto2">{sobre}</T> : null}
        <T s={30} w="extra">{titulo}</T>
      </View>
      {acoes ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>{acoes}</View> : null}
    </View>
  ) : ios ? (
    <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 4, paddingBottom: 6, gap: 2 }}>
      <View style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {voltar ? (
          <Pressable onPress={irVoltar} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ChevronLeft size={22} color={cores.primaria} />
            <T s={17} w="medio" c="primaria">{rotuloVoltar}</T>
          </Pressable>
        ) : <View />}
        <View style={{ flexDirection: 'row', gap: 10 }}>{acoes}</View>
      </View>
      <T s={32} w="extra" linhas={1}>{titulo}</T>
      {sobre ? <T s={14} w="medio" c="texto2">{sobre}</T> : null}
    </View>
  ) : (
    <View style={{ paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
        {voltar ? (
          <Pressable onPress={irVoltar} hitSlop={10} accessibilityLabel={rotuloVoltar}>
            <ArrowLeft size={22} color={cores.texto} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <T s={22} w="negrito" linhas={1}>{titulo}</T>
          {sobre ? <T s={13} c="texto2" linhas={1}>{sobre}</T> : null}
        </View>
        {acoes}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      {!largo && (semCabecalhoCelular ? <View style={{ height: insets.top + 12 }} /> : cabecalho)}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={largo
          ? { paddingHorizontal: 56, paddingTop: 40, paddingBottom: 48 }
          : { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap }}
        refreshControl={aoAtualizar ? <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={cores.primaria} /> : undefined}
        keyboardShouldPersistTaps="handled">
        {largo && cabecalho}
        {largo ? <View style={{ gap }}>{children}</View> : children}
        {largo && rodape ? <View style={{ marginTop: 20 }}>{rodape}</View> : null}
      </ScrollView>
      {!largo && rodape ? (
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, gap: 10, backgroundColor: cores.superficie, borderTopWidth: 1, borderColor: cores.borda }}>
          {rodape}
        </View>
      ) : null}
    </View>
  );
}

// ── Colunas ─────────────────────────────────────────────────────────────────
export function Colunas({ esquerda, direita, largura = 420, style }: { esquerda: ReactNode; direita: ReactNode; largura?: number; style?: StyleProp<ViewStyle> }) {
  const largo = useLargo();
  if (!largo) return <View style={[{ gap: 20 }, style]}>{esquerda}{direita}</View>;
  return (
    <View style={[{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }, style]}>
      <View style={{ width: largura, gap: 20 }}>{esquerda}</View>
      <View style={{ flex: 1, gap: 16 }}>{direita}</View>
    </View>
  );
}

/** Grade responsiva: `colunasCelular` no celular (1), `colunas` no PC. */
export function Grade({ children, colunas = 3, colunasCelular = 1, gap = 14 }: { children: ReactNode[]; colunas?: number; colunasCelular?: number; gap?: number }) {
  const largo = useLargo();
  const n = largo ? colunas : colunasCelular;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {children.map((c, i) => (
        <View key={i} style={{ flexBasis: `${Math.floor(100 / n) - 3}%`, flexGrow: 1 }}>{c}</View>
      ))}
    </View>
  );
}
