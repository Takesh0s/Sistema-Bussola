// O Hermes (motor JS do React Native) não tem WebCrypto. O Supabase usa
// crypto.subtle para o PKCE (SHA-256); sem ele, cai no modo "plain".
// Aqui completamos o necessário com o expo-crypto (disponível no Expo Go).
import * as ExpoCrypto from 'expo-crypto';

type CryptoMinimo = {
  getRandomValues?: typeof ExpoCrypto.getRandomValues;
  subtle?: { digest: (algoritmo: string, dados: BufferSource) => Promise<ArrayBuffer> };
};

const g = globalThis as unknown as { crypto?: CryptoMinimo };
g.crypto ??= {};

if (!g.crypto.getRandomValues) {
  g.crypto.getRandomValues = ExpoCrypto.getRandomValues;
}

if (!g.crypto.subtle) {
  g.crypto.subtle = {
    digest: (algoritmo, dados) => {
      if (algoritmo.replace('-', '').toUpperCase() !== 'SHA256') {
        return Promise.reject(new Error(`Algoritmo não suportado: ${algoritmo}`));
      }
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, dados);
    },
  };
}
