# 🧭 Sistema Bússola

> **App do Clube de Desbravadores** — Android, iOS e web com o mesmo código.

Complementa o SGC oficial com o dia a dia do clube: cartão de classe, especialidades,
instruções, chamada, eventos, equipe e finanças. Cada pessoa vê o app na cor da sua classe.

---

## Funcionalidades

| Tela | Para quem | O que faz |
|---|---|---|
| Início | Todos | Classe atual, próximos compromissos, especialidades e frequência |
| Minha classe | Desbravadores | Cartão com requisitos por seção (regular e avançada) |
| Especialidades | Todos | Catálogo oficial (555), busca, filtros e progresso |
| Agenda | Todos | Eventos com seções por visibilidade (todos, liderança, direção) e modelos |
| Instruções | Instrutores e liderança | Pedido → aceite → chamada → conclusão em lote dos requisitos |
| Chamada | Liderança e instrutores | Presente, falta ou justificada; o tipo é definido automaticamente |
| Unidade | Liderança | Progresso, frequência e ficha de cada desbravador |
| Espiritual | Capelão e liderança | Participação na Classe bíblica (somente leitura) |
| Equipe e cargos | Direção | Concessão de cargos, convites por link e exceções de unidade |
| Finanças | Diretor, associados e tesoureiro | Mensalidades, caixa e e-mail de cobrança |
| Perfil | Todos | Tema claro/escuro e cor do app |

**Cor do app:** a paleta segue a classe — a classe do desbravador, a classe da unidade que
o conselheiro aconselha ou, para quem concluiu Líder, Líder Máster ou Líder Máster Avançado,
a classe de liderança atual. As cores são as mesmas variáveis do Figma.

---

## Stack

- **Expo SDK 58** + **Expo Router** (Android, iOS e web; roda no Expo Go)
- **Supabase** — Postgres, Auth (e-mail, Google) e RLS
- **TanStack Query** com cache salvo no aparelho (abre sem internet com os últimos dados)
- **lucide-react-native** (ícones), **expo-linear-gradient**, **Plus Jakarta Sans**, **date-fns**
- Web publicada na **Vercel** como site estático (SPA)

## Estrutura

```
sistema-bussola/
├── src/
│   ├── app/                  # Rotas (cada arquivo é uma tela)
│   │   ├── _layout.tsx       # Fontes, provedores e proteção de rotas
│   │   ├── entrar.tsx        # Login (e-mail, CPF, Google)
│   │   ├── convite/[token]   # Aceitar convite
│   │   └── (app)/            # Telas logadas (barra lateral no PC, abas no celular)
│   ├── components/           # Design system (ui, layout, menu) e blocos de tela
│   ├── lib/                  # Supabase, sessão, consultas e datas
│   └── theme/                # Tokens do Figma (classe × claro/escuro)
├── migrations/               # SQL em ordem (001 → 011)
├── seeds/                    # Requisitos oficiais de classes e especialidades
├── scripts/                  # Importadores do MDA Wiki
├── docs/                     # Documentação e histórico das migrations
├── app.json                  # Configuração do Expo
└── vercel.json               # Deploy web
```

---

## Rodando

```bash
npm install
npx expo start          # abre o QR code: leia com o Expo Go (Android/iOS)
npx expo start --web    # no navegador
npm run typecheck       # checagem de tipos
```

### Supabase

1. Rode as migrations em ordem no SQL Editor: `001`, `002`, `004` a `011`
   (a `003` tem ids de usuários do projeto antigo e não deve ser usada).
2. Rode os seeds: `seeds/requisitos_classes.sql` e `seeds/especialidades_oficiais/parte_01..10.sql`.
3. Em **Authentication → URL Configuration → Redirect URLs**, adicione:
   - `http://localhost:8081/**` (web local)
   - o domínio da Vercel, ex.: `https://sistema-bussola.vercel.app/**`
   - `bussola://**` (app instalado) e `exp://**` (Expo Go)

A URL e a chave publishable ficam em `src/lib/supabase.ts` (ou nas variáveis
`EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_KEY`). **Nunca** use a secret key no app.

### Convite por e-mail (Edge Function `enviar-convite`)

O convite chega com o nome e o brasão do clube, enviado por um Gmail do sistema.

1. Crie (ou use) um Gmail só para o sistema, ative a verificação em duas etapas
   e gere uma **senha de app** em myaccount.google.com/apppasswords.
2. No Supabase, em **Edge Functions → Secrets**, crie:
   - `SMTP_USER`: o Gmail do sistema
   - `SMTP_PASS`: a senha de app (16 letras)
   - `SITE_URLS`: `https://sistema-bussola.vercel.app,http://localhost:8081`
     (o primeiro é o link padrão; o app no celular usa ele)
3. Publique a função: em **Edge Functions → Deploy a new function → Via Editor**,
   nome `enviar-convite`, cole o conteúdo de `supabase/functions/enviar-convite/index.ts`
   e clique em **Deploy** (ou `npx supabase functions deploy enviar-convite`).

Sem a função publicada, o botão "Só gerar o link" continua funcionando.

### Deploy web (Vercel)

Importe o repositório na Vercel. O `vercel.json` já define o build
(`npx expo export --platform web`) e a pasta `dist`.

---

## Especialidade de Informática Programável (AP-052)

O requisito pede um software útil para o clube: o Bússola v3 cobre cadastro e progresso de
classes e especialidades, instrução, chamada, eventos, equipe e finanças, com código-fonte
aberto e documentação neste repositório.

---

*Sistema Bússola — Orientando clubes, um desbravador de cada vez. 🧭*
