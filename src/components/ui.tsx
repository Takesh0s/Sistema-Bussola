// Componentes básicos do design system (página "01 · Fundamentos" do Figma).
// Toda cor vem do tema: nada de hex solto nas telas.
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { Check, X } from 'lucide-react-native';
import { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Switch, Text, TextInput,
  TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';

import { CorChave, F, Peso, useTema } from '@/theme';

// ── Texto ────────────────────────────────────────────────────────────────────
type TProps = {
  children: ReactNode; s?: number; w?: Peso; c?: CorChave; linhas?: number;
  centro?: boolean; caixaAlta?: boolean; style?: StyleProp<TextStyle>; selecionavel?: boolean;
};
export function T({ children, s = 15, w = 'regular', c = 'texto', linhas, centro, caixaAlta, style, selecionavel }: TProps) {
  const { cores } = useTema();
  return (
    <Text
      numberOfLines={linhas}
      selectable={selecionavel}
      style={[
        { fontFamily: F[w], fontSize: s, color: cores[c], lineHeight: Math.round(s * 1.4) },
        centro && { textAlign: 'center' },
        caixaAlta && { textTransform: 'uppercase', letterSpacing: s * 0.06 },
        style,
      ]}>
      {children}
    </Text>
  );
}

// ── Superfícies ──────────────────────────────────────────────────────────────
type CartaoProps = { children: ReactNode; style?: StyleProp<ViewStyle>; p?: number; gap?: number; bg?: CorChave; borda?: CorChave | false };
export function Cartao({ children, style, p = 16, gap = 12, bg = 'superficie', borda = 'borda' }: CartaoProps) {
  const { cores } = useTema();
  return (
    <View style={[{ backgroundColor: cores[bg], borderRadius: 20, padding: p, gap },
      borda ? { borderWidth: 1, borderColor: cores[borda] } : null, style]}>
      {children}
    </View>
  );
}

/** Cartão em degradê da classe, com o anel decorativo (dourado nas classes de liderança). */
export function Capa({ children, style, p = 18, gap = 10, aneis = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; p?: number; gap?: number; aneis?: boolean }) {
  const { cores } = useTema();
  return (
    <LinearGradient
      colors={[cores.destaqueA, cores.destaqueB]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 22, padding: p, gap, overflow: 'hidden' }, style]}>
      {aneis && (
        <>
          <View pointerEvents="none" style={[est.anel, { width: 220, height: 220, borderRadius: 110, borderWidth: 26, right: -110, top: -70, borderColor: cores.terciaria, opacity: 0.5 }]} />
          <View pointerEvents="none" style={[est.anel, { width: 110, height: 110, borderRadius: 55, borderWidth: 10, right: -45, top: -15, borderColor: cores.acento, opacity: 0.4 }]} />
        </>
      )}
      {children}
    </LinearGradient>
  );
}

/** Faixa de cores da classe (degradê, terciária e acento). */
export function FaixaClasse() {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <View style={{ width: 28, height: 6, borderRadius: 3, backgroundColor: cores.terciaria }} />
      <View style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: cores.acento }} />
      <View style={{ width: 10, height: 6, borderRadius: 3, backgroundColor: cores.sobreDestaque }} />
    </View>
  );
}

/** Selo da classe: centro do emblema em degradê e contorno (verde ou dourado na liderança). */
export function Selo({ tamanho = 34 }: { tamanho?: number }) {
  const { cores } = useTema();
  const borda = Math.max(2, Math.round(tamanho / 10));
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cores.contorno, padding: borda }}>
      <LinearGradient colors={[cores.seloA, cores.seloB]} start={{ x: 0.15, y: 0.15 }} end={{ x: 0.95, y: 0.95 }}
        style={{ flex: 1, borderRadius: tamanho / 2 }} />
    </View>
  );
}

// ── Botões e controles ──────────────────────────────────────────────────────
type Variante = 'pri' | 'sec' | 'out' | 'ghost' | 'perigo' | 'inverso';
type BotaoProps = {
  titulo: string; onPress?: () => void; variante?: Variante; icone?: LucideIcon;
  carregando?: boolean; desabilitado?: boolean; cheio?: boolean; pequeno?: boolean; style?: StyleProp<ViewStyle>;
};
export function Botao({ titulo, onPress, variante = 'pri', icone: Icone, carregando, desabilitado, cheio, pequeno, style }: BotaoProps) {
  const { cores } = useTema();
  const fg: Record<Variante, string> = { pri: cores.sobreDestaque, sec: cores.sobreContainer, out: cores.texto, ghost: cores.primaria, perigo: cores.superficie, inverso: cores.destaqueA };
  const bg: Record<Variante, string | undefined> = { pri: undefined, sec: cores.container, out: undefined, ghost: undefined, perigo: cores.erro, inverso: cores.sobreDestaque };
  const conteudo = (
    <View style={[est.botao, pequeno && est.botaoPequeno, { backgroundColor: bg[variante] },
      variante === 'out' && { borderWidth: 1, borderColor: cores.borda }]}>
      {carregando ? <ActivityIndicator color={fg[variante]} /> : Icone ? <Icone size={pequeno ? 16 : 18} color={fg[variante]} /> : null}
      <T s={pequeno ? 13 : 15} w="negrito" style={{ color: fg[variante] }}>{titulo}</T>
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado || carregando}
      accessibilityRole="button"
      style={({ pressed }) => [cheio && { alignSelf: 'stretch', flexGrow: 1 }, { opacity: desabilitado ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {variante === 'pri' ? (
        <LinearGradient colors={[cores.destaqueA, cores.destaqueB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 12 }}>
          {conteudo}
        </LinearGradient>
      ) : conteudo}
    </Pressable>
  );
}

export function BotaoIcone({ icone: Icone, onPress, cor = 'texto', rotulo }: { icone: LucideIcon; onPress?: () => void; cor?: CorChave; rotulo: string }) {
  const { cores } = useTema();
  return (
    <Pressable onPress={onPress} accessibilityLabel={rotulo} hitSlop={10}
      style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.superficie2, opacity: pressed ? 0.7 : 1 }]}>
      <Icone size={20} color={cores[cor]} />
    </Pressable>
  );
}

export function Chip({ texto, bg = 'container', fg = 'sobreContainer', style }: { texto: string; bg?: CorChave; fg?: CorChave; style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  return (
    <View style={[{ backgroundColor: cores[bg], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }, style]}>
      <T s={12} w="semi" c={fg}>{texto}</T>
    </View>
  );
}

export function ChipFiltro({ texto, ativo, onPress }: { texto: string; ativo?: boolean; onPress?: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1,
      borderColor: ativo ? cores.primaria : cores.borda, backgroundColor: ativo ? cores.primaria : cores.superficie }}>
      <T s={13} w="semi" style={{ color: ativo ? cores.sobrePrimaria : cores.texto }}>{texto}</T>
    </Pressable>
  );
}

export function Segmentado<V extends string>({ opcoes, valor, onChange, style }: { opcoes: { valor: V; rotulo: string }[]; valor: V; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  return (
    <View style={[{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: cores.superficie2 }, style]}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable key={o.valor} onPress={() => onChange(o.valor)} accessibilityState={{ selected: ativo }}
            style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center',
              backgroundColor: ativo ? cores.superficie : 'transparent', borderWidth: ativo ? 1 : 0, borderColor: cores.borda }}>
            <T s={13} w={ativo ? 'negrito' : 'medio'} c={ativo ? 'texto' : 'texto2'} linhas={1}>{o.rotulo}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

type CampoProps = TextInputProps & { rotulo?: string; prefixo?: string; erro?: string; style?: StyleProp<ViewStyle> };
export function Campo({ rotulo, prefixo, erro, style, multiline, ...props }: CampoProps) {
  const { cores } = useTema();
  return (
    <View style={[{ gap: 6 }, style]}>
      {rotulo ? <T s={13} w="semi" c="texto2">{rotulo}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 8, borderRadius: 12, borderWidth: 1,
        borderColor: erro ? cores.erro : cores.borda, backgroundColor: cores.superficie, paddingHorizontal: 14 }}>
        {prefixo ? <T w="negrito" c="texto2">{prefixo}</T> : null}
        <TextInput
          placeholderTextColor={cores.texto2}
          multiline={multiline}
          style={{ flex: 1, paddingVertical: 13, fontFamily: F.medio, fontSize: 15, color: cores.texto, minHeight: multiline ? 110 : undefined, textAlignVertical: multiline ? 'top' : 'center' }}
          {...props}
        />
      </View>
      {erro ? <T s={12} w="medio" c="erro">{erro}</T> : null}
    </View>
  );
}

export function Interruptor({ valor, onChange }: { valor: boolean; onChange: (v: boolean) => void }) {
  const { cores } = useTema();
  return <Switch value={valor} onValueChange={onChange} trackColor={{ true: cores.primaria, false: cores.borda }} thumbColor={valor ? cores.sobrePrimaria : cores.superficie} />;
}

// ── Estados e indicadores ───────────────────────────────────────────────────
export type EstadoReq = 'ok' | 'inst' | 'pend';
export function Marca({ estado, tamanho = 26 }: { estado: EstadoReq; tamanho?: number }) {
  const { cores } = useTema();
  const bg = estado === 'ok' ? cores.sucesso : estado === 'inst' ? cores.container : 'transparent';
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
      borderWidth: estado === 'pend' ? 2 : 0, borderColor: cores.borda }}>
      {estado === 'ok' && <Check size={tamanho * 0.6} color={cores.superficie} strokeWidth={3} />}
      {estado === 'inst' && <View style={{ width: tamanho * 0.3, height: tamanho * 0.3, borderRadius: 99, backgroundColor: cores.sobreContainer }} />}
    </View>
  );
}

export type Presenca = 'P' | 'F' | 'J';
export function SeletorPresenca({ valor, onChange }: { valor: Presenca; onChange: (v: Presenca) => void }) {
  const { cores } = useTema();
  const cor: Record<Presenca, string> = { P: cores.sucesso, F: cores.erro, J: cores.aviso };
  const rotulo: Record<Presenca, string> = { P: 'Presente', F: 'Falta', J: 'Falta justificada' };
  return (
    <View style={{ flexDirection: 'row', padding: 3, gap: 3, borderRadius: 10, backgroundColor: cores.superficie2 }}>
      {(['P', 'F', 'J'] as Presenca[]).map((p) => (
        <Pressable key={p} onPress={() => onChange(p)} accessibilityLabel={rotulo[p]} accessibilityState={{ selected: valor === p }}
          style={{ width: 32, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: valor === p ? cor[p] : 'transparent' }}>
          <T s={13} w="negrito" style={{ color: valor === p ? cores.superficie : cores.texto2 }}>{p}</T>
        </Pressable>
      ))}
    </View>
  );
}

export function Progresso({ valor, trilho = 'container', cor = 'primaria', altura = 8, style }: { valor: number; trilho?: CorChave; cor?: CorChave; altura?: number; style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  const v = Math.max(0, Math.min(1, valor || 0));
  return (
    <View style={[{ height: altura, borderRadius: altura / 2, backgroundColor: cores[trilho], overflow: 'hidden' }, style]}>
      <View style={{ width: `${v * 100}%`, minWidth: v > 0 ? altura : 0, height: '100%', borderRadius: altura / 2, backgroundColor: cores[cor] }} />
    </View>
  );
}

export function iniciais(nome?: string | null) {
  const p = (nome ?? '?').trim().split(/\s+/).filter((x) => !/^(de|da|do|dos|das|e)$/i.test(x));
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ nome, tamanho = 40 }: { nome?: string | null; tamanho?: number }) {
  const { cores } = useTema();
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cores.container, alignItems: 'center', justifyContent: 'center' }}>
      <T s={Math.round(tamanho * 0.36)} w="negrito" c="sobreContainer">{iniciais(nome)}</T>
    </View>
  );
}

export function Icone({ icone: I, bg = 'container', fg = 'sobreContainer', tamanho = 40 }: { icone: LucideIcon; bg?: CorChave; fg?: CorChave; tamanho?: number }) {
  const { cores } = useTema();
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.3), backgroundColor: cores[bg], alignItems: 'center', justifyContent: 'center' }}>
      <I size={Math.round(tamanho * 0.5)} color={cores[fg]} />
    </View>
  );
}

// ── Listas ──────────────────────────────────────────────────────────────────
export function Secao({ titulo, acao, onAcao }: { titulo: string; acao?: string; onAcao?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <T s={18} w="negrito">{titulo}</T>
      {acao ? <Pressable onPress={onAcao} hitSlop={8}><T s={14} w="semi" c="primaria">{acao}</T></Pressable> : null}
    </View>
  );
}

type ItemProps = { esquerda?: ReactNode; titulo: string; sub?: string; direita?: ReactNode; onPress?: () => void; destaque?: boolean; linhasSub?: number; style?: StyleProp<ViewStyle> };
export function Item({ esquerda, titulo, sub, direita, onPress, destaque, linhasSub = 2, style }: ItemProps) {
  const { cores } = useTema();
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: cores.superficie,
        borderWidth: destaque ? 2 : 1, borderColor: destaque ? cores.primaria : cores.borda, opacity: pressed ? 0.8 : 1 }, style]}>
      {esquerda}
      <View style={{ flex: 1, gap: 3 }}>
        <T w="negrito" linhas={1}>{titulo}</T>
        {sub ? <T s={13} c="texto2" linhas={linhasSub}>{sub}</T> : null}
      </View>
      {direita}
    </Pressable>
  );
}

export function Aviso({ texto, tom = 'acento', icone: I }: { texto: string; tom?: 'acento' | 'neutro' | 'alerta'; icone?: LucideIcon }) {
  const { cores } = useTema();
  const bg = tom === 'acento' ? cores.acentoSuave : tom === 'alerta' ? cores.container : cores.superficie2;
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: bg, alignItems: 'center' }}>
      {I ? <I size={18} color={tom === 'acento' ? cores.acento : cores.texto2} /> : null}
      <T s={13} w="medio" c={tom === 'neutro' ? 'texto2' : 'texto'} style={{ flex: 1 }}>{texto}</T>
    </View>
  );
}

export function Numero({ valor, rotulo, cor = 'primaria', style }: { valor: string | number; rotulo: string; cor?: CorChave; style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  return (
    <View style={[{ flex: 1, padding: 12, gap: 2, borderRadius: 14, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda }, style]}>
      <T s={20} w="extra" c={cor}>{String(valor)}</T>
      <T s={12} w="medio" c="texto2">{rotulo}</T>
    </View>
  );
}

export function Vazio({ texto, icone: I }: { texto: string; icone?: LucideIcon }) {
  const { cores } = useTema();
  return (
    <View style={{ alignItems: 'center', gap: 10, padding: 28 }}>
      {I ? <I size={28} color={cores.texto2} /> : null}
      <T c="texto2" centro>{texto}</T>
    </View>
  );
}

export function Carregando({ texto }: { texto?: string }) {
  const { cores } = useTema();
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={cores.primaria} />
      {texto ? <T c="texto2">{texto}</T> : null}
    </View>
  );
}

export function Erro({ erro, tentar }: { erro: unknown; tentar?: () => void }) {
  const { cores } = useTema();
  const msg = (erro as { hint?: string; message?: string })?.hint ?? (erro as { message?: string })?.message ?? 'Não foi possível carregar.';
  return (
    <Cartao bg="superficie2" borda={false}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <X size={18} color={cores.erro} />
        <T s={14} w="medio" style={{ flex: 1 }}>{msg}</T>
      </View>
      {tentar ? <Botao titulo="Tentar de novo" variante="out" pequeno onPress={tentar} /> : null}
    </Cartao>
  );
}

const est = StyleSheet.create({
  anel: { position: 'absolute' },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  botaoPequeno: { paddingHorizontal: 12, paddingVertical: 8 },
});
