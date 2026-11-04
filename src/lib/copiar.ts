// Copia um texto. O expo-clipboard é carregado só na hora (se o módulo nativo
// não existir no Expo Go, não derruba o app); sem ele, abre o compartilhamento.
import { Platform, Share } from 'react-native';

export async function copiarTexto(texto: string): Promise<'copiado' | 'compartilhado'> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(texto);
    return 'copiado';
  }
  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(texto);
    return 'copiado';
  } catch {
    await Share.share({ message: texto });
    return 'compartilhado';
  }
}
