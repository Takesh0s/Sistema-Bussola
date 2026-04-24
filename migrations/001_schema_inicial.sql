create extension if not exists "uuid-ossp";

create table classe (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text
);

create table conselheiro (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  telefone text,
  email text
);

create table unidade (
  id uuid primary key default uuid_generate_v4(),
  nome text not null
);

create table unidade_membro (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid references unidade(id) on delete cascade,
  conselheiro_id uuid references conselheiro(id) on delete cascade,
  tipo text check (tipo in ('conselheiro','associado')) not null
);

create table desbravador (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  unidade_id uuid references unidade(id) on delete set null,
  classe_id uuid references classe(id) on delete set null,
  data_nascimento date,
  contato text
);

create table especialidades (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text
);

create table desbravador_especialidade (
  id uuid primary key default uuid_generate_v4(),
  desbravador_id uuid references desbravador(id) on delete cascade,
  especialidade_id uuid references especialidades(id) on delete cascade,
  concluida boolean default false
);

create table mensalidade (
  id uuid primary key default uuid_generate_v4(),
  desbravador_id uuid references desbravador(id) on delete cascade,
  mes int check (mes >= 1 and mes <= 12),
  ano int,
  valor numeric(10,2),
  pago boolean default false
);

create table caixa (
  id uuid primary key default uuid_generate_v4(),
  tipo text check (tipo in ('entrada','saida')),
  descricao text,
  valor numeric(10,2),
  data date default now()
);

create table patrimonio (
  id uuid primary key default uuid_generate_v4(),
  item text not null,
  quantidade int default 1,
  estado text,
  unidade_id uuid references unidade(id) on delete set null
);

create table atas (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  conteudo text,
  data date default now()
);

create table atos (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  conteudo text,
  data date default now()
);

insert into classe (nome, descricao) values
('Amigo','10 anos'),
('Companheiro','11 anos'),
('Pesquisador','12 anos'),
('Pioneiro','13 anos'),
('Excursionista','14 anos'),
('Guia','15-16 anos'),
('Líder','Líder de desbravadores'),
('Líder Máster',''),
('Líder Máster Avançado','');

alter table classe enable row level security;
alter table conselheiro enable row level security;
alter table unidade enable row level security;
alter table unidade_membro enable row level security;
alter table desbravador enable row level security;
alter table especialidades enable row level security;
alter table desbravador_especialidade enable row level security;
alter table mensalidade enable row level security;
alter table caixa enable row level security;
alter table patrimonio enable row level security;
alter table atas enable row level security;
alter table atos enable row level security;

create policy "Authenticated full access - classe"
  on classe for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - conselheiro"
  on conselheiro for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - unidade"
  on unidade for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - unidade_membro"
  on unidade_membro for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - desbravador"
  on desbravador for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - especialidades"
  on especialidades for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - desbravador_especialidade"
  on desbravador_especialidade for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - mensalidade"
  on mensalidade for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - caixa"
  on caixa for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - patrimonio"
  on patrimonio for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - atas"
  on atas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access - atos"
  on atos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');