-- Radar do CNPJ técnico: contato de quem pediu para ser avisado quando a Receita abrir o canal oficial.
-- Guarda o mínimo: canal, contato, situação da pessoa e a versão do texto de consentimento aceito.
-- Não guarda CPF, nome nem respostas do questionário.

create table public.radar_inscricoes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  canal text not null check (canal in ('whatsapp', 'email')),
  contato text not null check (char_length(contato) between 6 and 120),
  trilha text not null check (trilha in ('A_NANO', 'B_PF_CONTRIBUINTE', 'C_MEI_SERVICO', 'D_MEI_REVENDA', 'E_ME_EPP')),
  uf text check (uf ~ '^[A-Z]{2}$'),
  consentimento_versao text not null check (char_length(consentimento_versao) between 1 and 20),
  cancelado_em timestamptz,
  constraint radar_contato_unico unique (canal, contato)
);

comment on table public.radar_inscricoes is
  'Pedidos de aviso sobre o CNPJ técnico. Dado pessoal: contato. Base legal: consentimento.';

alter table public.radar_inscricoes enable row level security;

-- O site só pode incluir. Ninguém lê, altera ou apaga pela chave pública.
revoke all on public.radar_inscricoes from anon, authenticated;
grant insert (canal, contato, trilha, uf, consentimento_versao) on public.radar_inscricoes to anon;

create policy radar_inclusao_publica
  on public.radar_inscricoes
  for insert
  to anon
  with check (cancelado_em is null);
