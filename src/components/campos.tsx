// Campos de data e hora com máscara: a pessoa digita só os números e as barras
// e os dois-pontos aparecem sozinhos (25022026 → 25/02/2026, 1930 → 19:30).
import { StyleProp, ViewStyle } from 'react-native';

import { Campo } from './ui';

const digitos = (s: string) => s.replace(/\D/g, '');

export function mascaraData(txt: string) {
  const d = digitos(txt).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function mascaraHora(txt: string) {
  const d = digitos(txt).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** 'DD/MM/AAAA' → 'AAAA-MM-DD' (null se incompleta ou se o dia não existe, como 31/02). */
export function dataISO(txt: string): string | null {
  const m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(a, mes - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== mes - 1 || dt.getDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' */
export function dataTexto(iso: string | null | undefined) {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** 'HH:MM' válido (00:00 a 23:59). Vazio também vale: hora é opcional nos formulários. */
export function horaValida(txt: string) {
  if (!txt) return true;
  const m = txt.match(/^(\d{2}):(\d{2})$/);
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** Junta data e hora locais num timestamp ISO (UTC). */
export function juntar(dataIso: string, hora: string | null) {
  const [a, m, d] = dataIso.split('-').map(Number);
  const [h, min] = hora ? hora.split(':').map(Number) : [0, 0];
  return new Date(a, m - 1, d, h, min).toISOString();
}

type Props = {
  rotulo?: string; valor: string; aoMudar: (v: string) => void; placeholder?: string;
  erro?: string; style?: StyleProp<ViewStyle>;
};

export function CampoData({ rotulo, valor, aoMudar, placeholder = 'DD/MM/AAAA', erro, style }: Props) {
  return (
    <Campo rotulo={rotulo} value={valor} onChangeText={(t) => aoMudar(mascaraData(t))} placeholder={placeholder}
      keyboardType="number-pad" inputMode="numeric" maxLength={10} erro={erro} style={style} />
  );
}

export function CampoHora({ rotulo, valor, aoMudar, placeholder = 'HH:MM', erro, style }: Props) {
  return (
    <Campo rotulo={rotulo} value={valor} onChangeText={(t) => aoMudar(mascaraHora(t))} placeholder={placeholder}
      keyboardType="number-pad" inputMode="numeric" maxLength={5} erro={erro} style={style} />
  );
}
