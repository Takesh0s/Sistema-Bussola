// O Hermes (motor JS do React Native) não tem WebCrypto. O Supabase usa
// crypto.getRandomValues (verificador do PKCE) e crypto.subtle.digest('SHA-256').
//
// - Aleatoriedade: no app instalado (build da loja), usa o gerador seguro do
//   sistema pelo módulo nativo ExpoCrypto. Só no Expo Go, que não traz esse
//   módulo, cai no Math.random (não é criptograficamente seguro — serve para teste).
// - SHA-256: em JavaScript puro. O resultado é idêntico ao nativo (é um cálculo
//   determinístico); a diferença seria só de velocidade, irrelevante para um hash por login.
// Na web, o crypto do navegador já existe e nada aqui é usado.
import { requireOptionalNativeModule } from 'expo';

type CryptoMinimo = {
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
  subtle?: { digest: (algoritmo: string, dados: BufferSource) => Promise<ArrayBuffer> };
};

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 (FIPS 180-4) sobre bytes. */
export function sha256(dados: Uint8Array): Uint8Array {
  const tamanhoBits = dados.length * 8;
  const total = ((dados.length + 9 + 63) >> 6) << 6;
  const msg = new Uint8Array(total);
  msg.set(dados);
  msg[dados.length] = 0x80;
  const visao = new DataView(msg.buffer);
  visao.setUint32(total - 8, Math.floor(tamanhoBits / 0x100000000));
  visao.setUint32(total - 4, tamanhoBits >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = visao.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const saida = new Uint8Array(32);
  const vs = new DataView(saida.buffer);
  h.forEach((v, i) => vs.setUint32(i * 4, v));
  return saida;
}

function paraBytes(dados: BufferSource): Uint8Array {
  if (dados instanceof Uint8Array) return dados;
  if (ArrayBuffer.isView(dados)) return new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength);
  return new Uint8Array(dados as ArrayBuffer);
}

const g = globalThis as unknown as { crypto?: CryptoMinimo };
g.crypto ??= {};

const nativo = requireOptionalNativeModule<{ getRandomValues: (a: ArrayBufferView) => void }>('ExpoCrypto');

/** true quando a aleatoriedade vem do gerador seguro do sistema. */
export const ALEATORIO_SEGURO = typeof g.crypto.getRandomValues === 'function' || !!nativo?.getRandomValues;

if (typeof g.crypto.getRandomValues !== 'function' && nativo?.getRandomValues) {
  g.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array) nativo.getRandomValues(array);
    return array;
  };
} else if (typeof g.crypto.getRandomValues !== 'function') {
  if (__DEV__) console.warn('[cripto] Sem gerador seguro (Expo Go): usando Math.random só para teste.');
  g.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array) {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

if (!g.crypto.subtle) {
  g.crypto.subtle = {
    digest: async (algoritmo, dados) => {
      if (algoritmo.replace('-', '').toUpperCase() !== 'SHA256') {
        throw new Error(`Algoritmo não suportado: ${algoritmo}`);
      }
      const r = sha256(paraBytes(dados));
      return r.buffer.slice(r.byteOffset, r.byteOffset + r.byteLength) as ArrayBuffer;
    },
  };
}
