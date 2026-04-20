# 🧭 Sistema Bússola

> **Plataforma de Administração e Controle para Clubes de Desbravadores**

Sistema web completo para gestão administrativa de clubes de desbravadores da Divisão Sul Americana. Desenvolvido em HTML5, CSS3 e JavaScript puro com backend Supabase (PostgreSQL).

---

## 🚀 Funcionalidades

| Módulo | Descrição |
|---|---|
| 🎖️ Conselheiros | Cadastro de líderes e conselheiros |
| 🏕️ Unidades | Gestão de unidades com conselheiro e associados |
| 👤 Desbravadores | Cadastro com classe, especialidades e perfil individual |
| 💳 Mensalidades | Controle de pagamentos com filtros e toggle de status |
| 💰 Caixa | Entradas/saídas com saldo em tempo real |
| 📦 Patrimônio | Inventário de bens por unidade |
| 📋 Atas e Atos | Registros oficiais com visualização e edição |
| 📊 Relatórios | 6 tipos de PDF gerados no cliente com jsPDF |

## 🔐 Autenticação

- Login com e-mail e senha
- Login social com Google OAuth
- Proteção de rotas com verificação de sessão
- Logout seguro

## 📄 Relatórios em PDF

1. **Autorização de Saída** — por unidade, com espaço para assinaturas
2. **Fluxo de Caixa** — extrato completo com totais e saldo
3. **Patrimônio** — inventário com estado dos itens
4. **Livro de Atas e Atos** — conteúdo completo de cada registro
5. **Mensalidades** — situação de pagamentos com cores por status
6. **Relatório Geral** — visão consolidada: unidades, classes, especialidades e membros

---

## 🛠️ Stack Tecnológica

- **Frontend**: HTML5 · CSS3 · JavaScript ES2022
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL + Auth + PostgREST)
- **PDF**: jsPDF + jsPDF-AutoTable
- **Alertas**: SweetAlert2 → substituído por sistema próprio de flash messages
- **Fonte**: Sora + JetBrains Mono (Google Fonts)

---

## 📁 Estrutura do Projeto

```
sistema-bussola/
├── index.html                  # Login
├── cadastro.html               # Cadastro de conta
├── dashboard.html              # Painel de controle
├── conselheiro.html            # Gestão de conselheiros
├── unidade.html                # Gestão de unidades
├── desbravador.html            # Gestão de desbravadores
├── perfil-desbravador.html     # Perfil individual
├── mensalidade.html            # Controle de mensalidades
├── caixa.html                  # Controle de caixa
├── patrimonio.html             # Controle de patrimônio
├── atas_atos.html              # Atas e atos
├── relatorios.html             # Central de relatórios PDF
├── style.css                   # Design system global
├── supabase.js                 # Cliente Supabase
└── utils.js                    # Utilitários globais
```

---

## ⚙️ Configuração e Deploy

### 1. Supabase

Execute o SQL abaixo no seu projeto Supabase:

```sql
create extension if not exists "uuid-ossp";

create table conselheiro (
  id uuid primary key default uuid_generate_v4(),
  nome text not null, telefone text, email text
);

create table unidade (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  conselheiro_id uuid references conselheiro(id),
  associado1_id uuid references conselheiro(id),
  associado2_id uuid references conselheiro(id)
);

create table desbravador (
  id uuid primary key default uuid_generate_v4(),
  nome text not null, unidade_id uuid references unidade(id),
  classe_id uuid references classe(id),
  data_nascimento date, contato text
);

create table classe (
  id uuid primary key default uuid_generate_v4(),
  nome text not null, descricao text
);

create table especialidades (
  id uuid primary key default uuid_generate_v4(),
  nome text not null, descricao text
);

create table desbravador_especialidade (
  id uuid primary key default uuid_generate_v4(),
  desbravador_id uuid references desbravador(id),
  especialidade_id uuid references especialidades(id),
  concluida boolean default false
);

create table mensalidade (
  id uuid primary key default uuid_generate_v4(),
  desbravador_id uuid references desbravador(id),
  mes int check (mes >= 1 and mes <= 12),
  ano int, valor numeric(10,2), pago boolean default false
);

create table caixa (
  id uuid primary key default uuid_generate_v4(),
  tipo text check (tipo in ('entrada','saida')),
  descricao text, valor numeric(10,2),
  data date default now()
);

create table patrimonio (
  id uuid primary key default uuid_generate_v4(),
  item text not null, quantidade int default 1,
  estado text, unidade_id uuid references unidade(id)
);

create table atas (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null, conteudo text, data date default now()
);

create table atos (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null, conteudo text, data date default now()
);

-- Classes iniciais
insert into classe (nome, descricao) values
('Amigo','10 anos'),('Companheiro','11 anos'),
('Pesquisador','12 anos'),('Pioneiro','13 anos'),
('Excursionista','14 anos'),('Guia','15-16 anos'),
('Líder','Líder de desbravadores'),
('Líder Máster',''),('Líder Máster Avançado','');
```

### 2. Configurar credenciais

Edite `supabase.js` com sua URL e chave anon do Supabase:

```js
const supabase = window.supabase.createClient(
  'https://gjplfuopvdsoaracqljp.supabase.co',
  'sb_publishable_kDXuYFeJAEYbbytOJjDJhQ_2k8v8fL1'
);
```

### 3. Deploy

O projeto é 100% estático — faça deploy em qualquer plataforma:

- **GitHub Pages**: Repositório → Settings → Pages → Deploy from branch `main`
- **Vercel / Netlify**: Arraste a pasta ou conecte o repositório
- **Servidor próprio**: Copie os arquivos para o diretório público

### 4. Google OAuth (opcional)

No painel do Supabase: Authentication → Providers → Google → Configure com suas credenciais OAuth do Google Cloud Console. Adicione o domínio do seu site nas URLs autorizadas.

---

## 🎯 Cobertura — Especialidade de Informática Programável (AP-052)

| Requisito | Status |
|---|---|
| 4.1.1 Cadastro de unidades, especialidades, classes e desbravadores | ✅ |
| 4.1.2 Controle de mensalidade | ✅ |
| 4.1.3 Controle de caixa | ✅ |
| 4.1.4 Controle de custos | ✅ (saídas do caixa) |
| 4.1.5 Controle de patrimônio | ✅ |
| 4.1.6 Controle de Atas | ✅ |
| 4.1.7 Controle de Atos | ✅ |
| 4.1.8 Relatório de autorização de saída | ✅ |
| 4.1.9 Relatório de fluxo de caixa | ✅ |
| 4.1.10 Relatório de patrimônio | ✅ |
| 4.1.11 Relatório Livro Ata e Atos | ✅ |
| 4.1.12 Relatório de mensalidade | ✅ |
| 4.1.13 Relatório geral (unidades, classes, especialidades, desbravadores) | ✅ |
| 4.2 Sistema funcional com todos os módulos | ✅ |
| 4.3 Código-fonte disponível | ✅ |
| 4.4 Documentação de uso | ✅ |

---

## 📚 Documentação

A documentação completa do projeto está na pasta `/docs`:

- `01_Documento_de_Visao.docx`
- `02_Casos_de_Uso.docx`
- `03_Arquitetura_de_Software.docx`
- `04_Manual_do_Usuario.docx`
- `05_Especificacao_de_Requisitos_SRS.docx`

---

## 👨‍💻 Linguagem de Programação

**JavaScript** — criado em 1995 por Brendan Eich na Netscape. A linguagem mais utilizada do mundo por mais de 12 anos consecutivos (Stack Overflow Developer Survey). Escolhida por ser executada nativamente em todos os navegadores, ter integração nativa com o SDK do Supabase e não exigir servidor ou processo de build.

---

*Sistema Bússola — Orientando clubes, um desbravador de cada vez. 🧭*