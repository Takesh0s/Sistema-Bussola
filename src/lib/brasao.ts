// Brasão do clube: a direção escolhe uma foto, o app recorta em quadrado, reduz
// para 512 px (PNG, mantém transparência) e envia para o Storage (bucket "brasoes",
// arquivo <clube_id>/brasao). O endereço público fica em clube.brasao_url e é
// usado no menu, na página do convite e no e-mail de convite.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

const LADO = 512;

function base64ParaBytes(b64: string) {
  const tabela = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const limpo = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((limpo.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < limpo.length; i += 4) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => tabela.indexOf(limpo[i + k] ?? 'A'));
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (j < bytes.length) bytes[j++] = (n >> 16) & 255;
    if (j < bytes.length) bytes[j++] = (n >> 8) & 255;
    if (j < bytes.length) bytes[j++] = n & 255;
  }
  return bytes;
}

/** Abre a galeria, envia o brasão e grava no clube. Devolve a nova URL (ou null se cancelou). */
export async function trocarBrasao(clubeId: string): Promise<string | null> {
  const escolha = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (escolha.canceled || !escolha.assets?.length) return null;

  const contexto = ImageManipulator.manipulate(escolha.assets[0].uri).resize({ width: LADO });
  const imagem = await contexto.renderAsync();
  const salvo = await imagem.saveAsync({ format: SaveFormat.PNG, base64: true });
  if (!salvo.base64) throw new Error('Não foi possível ler a imagem.');
  const bytes = base64ParaBytes(salvo.base64);

  const caminho = `${clubeId}/brasao`;
  const { error } = await supabase.storage.from('brasoes').upload(caminho, bytes, { contentType: 'image/png', upsert: true, cacheControl: '3600' });
  if (error) throw error;

  // ?v= troca o endereço a cada envio, para ninguém ficar com o brasão antigo em cache
  const url = `${supabase.storage.from('brasoes').getPublicUrl(caminho).data.publicUrl}?v=${Date.now()}`;
  const { error: e2 } = await supabase.from('clube').update({ brasao_url: url }).eq('id', clubeId);
  if (e2) throw e2;
  return url;
}
