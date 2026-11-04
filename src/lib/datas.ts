import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/** Converte 'AAAA-MM-DD' ou timestamp ISO em Date (datas puras ao meio-dia, sem pular de dia por fuso). */
export function data(d: string) {
  return d.length === 10 ? new Date(d + 'T12:00:00') : parseISO(d);
}

export const fmt = (d: string | Date, padrao: string) => format(typeof d === 'string' ? data(d) : d, padrao, { locale: ptBR });

export const diaMes = (d: string) => fmt(d, 'dd/MM');
export const dataCurta = (d: string) => fmt(d, "EEE, dd/MM");
export const dataLonga = (d: string | Date) => fmt(d, "EEEE, d 'de' MMMM");
export const hora = (d: string) => fmt(d, "HH'h'mm").replace('h00', 'h');
export const mesAno = (d: string | Date) => fmt(d, "MMMM 'de' yyyy");
export const diaSemanaCurto = (d: string) => fmt(d, 'EEE').replace('.', '').toUpperCase();
export const dia = (d: string) => fmt(d, 'dd');

export function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
