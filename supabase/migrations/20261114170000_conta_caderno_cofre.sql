-- Conta da pessoa, Caderno na nuvem, Cofre de Provas e pedidos de ajuda ao contador.
--
-- Desenho de segurança:
-- * As tabelas ficam no esquema "privado", que a API pública do Supabase não expõe.
-- * O site acessa só por funções do esquema public com prefixo srv_. Toda função confere
--   a chave do servidor (guardada aqui só como hash) e a sessão da pessoa (também em hash).
-- * A chave publicável sozinha não lê nem grava nada destas tabelas.
-- * Login sem senha: código de 6 números enviado pelo WhatsApp, guardado em hash, com
--   validade de 10 minutos, no máximo 5 tentativas e 3 envios a cada 15 minutos.

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table privado.configuracao (
  nome text primary key,
  valor text not null
);

create table privado.contas (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique check (telefone ~ '^\+55[1-9][1-9]9\d{8}$'),
  criada_em timestamptz not null default now(),
  consentimento_versao text not null check (char_length(consentimento_versao) between 1 and 20),
  ultimo_acesso timestamptz
);
comment on table privado.contas is 'Conta da pessoa. Dado pessoal: telefone. Base legal: execução do serviço pedido e consentimento.';

create table privado.codigos (
  telefone text not null,
  codigo_hash text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  tentativas int not null default 0,
  usado_em timestamptz
);
create index on privado.codigos (telefone, criado_em desc);

create table privado.sessoes (
  token_hash text primary key,
  conta_id uuid not null references privado.contas (id) on delete cascade,
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null
);
create index on privado.sessoes (conta_id);

create table privado.vendas (
  conta_id uuid not null references privado.contas (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data date not null,
  valor numeric(12, 2) not null check (valor > 0),
  tipo text not null check (tipo in ('mercadoria', 'servico')),
  comprador_tem_cnpj boolean not null,
  descricao text not null default '' check (char_length(descricao) <= 120),
  primary key (conta_id, id)
);

create table privado.notas_compra (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references privado.contas (id) on delete cascade,
  chave text not null check (chave ~ '^[0-9]{6}[0-9A-Z]{14}[0-9]{24}$'),
  origem text not null check (origem in ('xml', 'chave')),
  emitente_cnpj text check (emitente_cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$' or emitente_cnpj ~ '^[0-9]{11}$'),
  emitente_nome text check (char_length(emitente_nome) <= 120),
  numero text check (char_length(numero) <= 12),
  data_emissao date,
  valor_total numeric(14, 2),
  valor_icms_st numeric(14, 2),
  itens jsonb not null default '[]'::jsonb,
  xml text check (octet_length(xml) <= 1048576),
  incluida_em timestamptz not null default now(),
  unique (conta_id, chave)
);
create index on privado.notas_compra (conta_id, data_emissao);

create table privado.pedidos_ajuda (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references privado.contas (id) on delete cascade,
  contato text not null check (char_length(contato) between 6 and 120),
  pergunta text not null check (char_length(pergunta) between 5 and 2000),
  resumo jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  situacao text not null default 'aberto' check (situacao in ('aberto', 'respondido', 'cancelado'))
);

create table privado.registro_acesso (
  conta_id uuid not null,
  acao text not null,
  em timestamptz not null default now()
);
create index on privado.registro_acesso (conta_id, em desc);

-- ---------------------------------------------------------------- funções internas

create or replace function privado.conferir_servidor(p_chave text) returns void
language plpgsql security definer set search_path = '' as $$
declare esperado text;
begin
  select valor into esperado from privado.configuracao where nome = 'chave_servidor_hash';
  if esperado is null or p_chave is null
     or encode(sha256(convert_to(p_chave, 'UTF8')), 'hex') <> esperado then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
end $$;

create or replace function privado.conta_da_sessao(p_token_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  select conta_id into v_conta from privado.sessoes
   where token_hash = p_token_hash and expira_em > now();
  if v_conta is null then
    raise exception 'sessao invalida' using errcode = '28000';
  end if;
  return v_conta;
end $$;

revoke all on all functions in schema privado from public, anon, authenticated;

-- ---------------------------------------------------------------- login

create or replace function public.srv_registrar_codigo(p_chave text, p_telefone text, p_codigo_hash text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare recentes int;
begin
  perform privado.conferir_servidor(p_chave);
  select count(*) into recentes from privado.codigos
   where telefone = p_telefone and criado_em > now() - interval '15 minutes';
  if recentes >= 3 then
    return false;
  end if;
  insert into privado.codigos (telefone, codigo_hash, expira_em)
  values (p_telefone, p_codigo_hash, now() + interval '10 minutes');
  delete from privado.codigos where criado_em < now() - interval '1 day';
  return true;
end $$;

create or replace function public.srv_entrar(
  p_chave text, p_telefone text, p_codigo_hash text, p_token_hash text, p_consentimento text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo record;
  v_conta uuid;
  v_nova boolean := false;
begin
  perform privado.conferir_servidor(p_chave);
  select ctid, * into v_codigo from privado.codigos
   where telefone = p_telefone and usado_em is null and expira_em > now()
   order by criado_em desc limit 1;
  if not found or v_codigo.tentativas >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;
  if v_codigo.codigo_hash <> p_codigo_hash then
    update privado.codigos set tentativas = tentativas + 1 where ctid = v_codigo.ctid;
    return jsonb_build_object('ok', false, 'motivo', 'errado');
  end if;
  update privado.codigos set usado_em = now() where ctid = v_codigo.ctid;

  select id into v_conta from privado.contas where telefone = p_telefone;
  if v_conta is null then
    insert into privado.contas (telefone, consentimento_versao)
    values (p_telefone, p_consentimento) returning id into v_conta;
    v_nova := true;
  end if;
  update privado.contas set ultimo_acesso = now() where id = v_conta;
  insert into privado.sessoes (token_hash, conta_id, expira_em)
  values (p_token_hash, v_conta, now() + interval '30 days');
  delete from privado.sessoes where expira_em < now();
  insert into privado.registro_acesso (conta_id, acao) values (v_conta, 'entrar');
  return jsonb_build_object('ok', true, 'nova', v_nova);
end $$;

create or replace function public.srv_sessao(p_chave text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  perform privado.conferir_servidor(p_chave);
  select c.id, c.telefone, c.criada_em into v
    from privado.sessoes s join privado.contas c on c.id = s.conta_id
   where s.token_hash = p_token_hash and s.expira_em > now();
  if not found then return null; end if;
  return jsonb_build_object('id', v.id, 'telefone', v.telefone, 'criadaEm', v.criada_em);
end $$;

create or replace function public.srv_sair(p_chave text, p_token_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.conferir_servidor(p_chave);
  delete from privado.sessoes where token_hash = p_token_hash;
end $$;

-- ---------------------------------------------------------------- caderno

create or replace function public.srv_vendas(p_chave text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_da_sessao(p_token_hash);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'data', to_char(data, 'YYYY-MM-DD'), 'valor', valor::text, 'tipo', tipo,
      'compradorTemCnpj', comprador_tem_cnpj, 'descricao', descricao) order by data, id)
    from privado.vendas where conta_id = v_conta), '[]'::jsonb);
end $$;

create or replace function public.srv_vendas_substituir(p_chave text, p_token_hash text, p_vendas jsonb)
returns int
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_total int;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_da_sessao(p_token_hash);
  if jsonb_typeof(p_vendas) <> 'array' or jsonb_array_length(p_vendas) > 5000 then
    raise exception 'lista de vendas invalida' using errcode = '22023';
  end if;
  delete from privado.vendas where conta_id = v_conta;
  insert into privado.vendas (conta_id, id, data, valor, tipo, comprador_tem_cnpj, descricao)
  select v_conta, x->>'id', (x->>'data')::date, (x->>'valor')::numeric, x->>'tipo',
         (x->>'compradorTemCnpj')::boolean, coalesce(x->>'descricao', '')
    from jsonb_array_elements(p_vendas) x;
  get diagnostics v_total = row_count;
  return v_total;
end $$;

-- ---------------------------------------------------------------- cofre de provas

create or replace function public.srv_notas(p_chave text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_da_sessao(p_token_hash);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'chave', chave, 'origem', origem, 'emitenteCnpj', emitente_cnpj,
      'emitenteNome', emitente_nome, 'numero', numero,
      'dataEmissao', to_char(data_emissao, 'YYYY-MM-DD'),
      'valorTotal', valor_total::text, 'valorIcmsSt', valor_icms_st::text,
      'itens', itens, 'incluidaEm', incluida_em) order by data_emissao desc nulls last, incluida_em desc)
    from privado.notas_compra where conta_id = v_conta), '[]'::jsonb);
end $$;

create or replace function public.srv_nota_gravar(p_chave text, p_token_hash text, p_nota jsonb, p_xml text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_id uuid; v_quantas int;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_da_sessao(p_token_hash);
  select count(*) into v_quantas from privado.notas_compra where conta_id = v_conta;
  if v_quantas >= 3000 then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;
  insert into privado.notas_compra (
    conta_id, chave, origem, emitente_cnpj, emitente_nome, numero, data_emissao,
    valor_total, valor_icms_st, itens, xml)
  values (
    v_conta, p_nota->>'chave', p_nota->>'origem', p_nota->>'emitenteCnpj', p_nota->>'emitenteNome',
    p_nota->>'numero', (p_nota->>'dataEmissao')::date, (p_nota->>'valorTotal')::numeric,
    (p_nota->>'valorIcmsSt')::numeric, coalesce(p_nota->'itens', '[]'::jsonb), p_xml)
  on conflict (conta_id, chave) do update set
    origem = excluded.origem,
    emitente_cnpj = coalesce(excluded.emitente_cnpj, privado.notas_compra.emitente_cnpj),
    emitente_nome = coalesce(excluded.emitente_nome, privado.notas_compra.emitente_nome),
    numero = coalesce(excluded.numero, privado.notas_compra.numero),
    data_emissao = coalesce(excluded.data_emissao, privado.notas_compra.data_emissao),
    valor_total = coalesce(excluded.valor_total, privado.notas_compra.valor_total),
    valor_icms_st = coalesce(excluded.valor_icms_st, privado.notas_compra.valor_icms_st),
    itens = case when excluded.origem = 'xml' then excluded.itens else privado.notas_compra.itens end,
    xml = coalesce(excluded.xml, privado.notas_compra.xml)
  where privado.notas_compra.origem = 'chave' or excluded.origem = 'xml'
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.srv_nota_xml(p_chave text, p_token_hash text, p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_da_sessao(p_token_hash);
  return (select xml from privado.notas_compra where id = p_id and conta_id = v_conta);
end $$;

create or replace function public.srv_nota_apagar(p_chave text, p_token_hash text, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_da_sessao(p_token_hash);
  delete from privado.notas_compra where id = p_id and conta_id = v_conta;
  return found;
end $$;

-- ---------------------------------------------------------------- ajuda do contador

create or replace function public.srv_pedido_ajuda(
  p_chave text, p_token_hash text, p_contato text, p_pergunta text, p_resumo jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_id uuid;
begin
  perform privado.conferir_servidor(p_chave);
  if p_token_hash is not null then
    v_conta := privado.conta_da_sessao(p_token_hash);
  end if;
  insert into privado.pedidos_ajuda (conta_id, contato, pergunta, resumo)
  values (v_conta, p_contato, p_pergunta, coalesce(p_resumo, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- LGPD

create or replace function public.srv_exportar(p_chave text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_dados jsonb;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_da_sessao(p_token_hash);
  select jsonb_build_object(
    'conta', (select to_jsonb(c) from privado.contas c where c.id = v_conta),
    'vendas', coalesce((select jsonb_agg(to_jsonb(v) - 'conta_id') from privado.vendas v where v.conta_id = v_conta), '[]'),
    'notasDeCompra', coalesce((select jsonb_agg(to_jsonb(n) - 'conta_id') from privado.notas_compra n where n.conta_id = v_conta), '[]'),
    'pedidosDeAjuda', coalesce((select jsonb_agg(to_jsonb(p) - 'conta_id') from privado.pedidos_ajuda p where p.conta_id = v_conta), '[]'),
    'acessos', coalesce((select jsonb_agg(jsonb_build_object('acao', r.acao, 'em', r.em) order by r.em desc)
                           from privado.registro_acesso r where r.conta_id = v_conta), '[]')
  ) into v_dados;
  insert into privado.registro_acesso (conta_id, acao) values (v_conta, 'exportar');
  return v_dados;
end $$;

create or replace function public.srv_excluir_conta(p_chave text, p_token_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_telefone text;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_da_sessao(p_token_hash);
  select telefone into v_telefone from privado.contas where id = v_conta;
  delete from privado.contas where id = v_conta;
  delete from privado.codigos where telefone = v_telefone;
  delete from privado.registro_acesso where conta_id = v_conta;
  return true;
end $$;

-- ---------------------------------------------------------------- permissões

revoke all on function
  public.srv_registrar_codigo(text, text, text),
  public.srv_entrar(text, text, text, text, text),
  public.srv_sessao(text, text),
  public.srv_sair(text, text),
  public.srv_vendas(text, text),
  public.srv_vendas_substituir(text, text, jsonb),
  public.srv_notas(text, text),
  public.srv_nota_gravar(text, text, jsonb, text),
  public.srv_nota_xml(text, text, uuid),
  public.srv_nota_apagar(text, text, uuid),
  public.srv_pedido_ajuda(text, text, text, text, jsonb),
  public.srv_exportar(text, text),
  public.srv_excluir_conta(text, text)
from public, authenticated;

grant execute on function
  public.srv_registrar_codigo(text, text, text),
  public.srv_entrar(text, text, text, text, text),
  public.srv_sessao(text, text),
  public.srv_sair(text, text),
  public.srv_vendas(text, text),
  public.srv_vendas_substituir(text, text, jsonb),
  public.srv_notas(text, text),
  public.srv_nota_gravar(text, text, jsonb, text),
  public.srv_nota_xml(text, text, uuid),
  public.srv_nota_apagar(text, text, uuid),
  public.srv_pedido_ajuda(text, text, text, text, jsonb),
  public.srv_exportar(text, text),
  public.srv_excluir_conta(text, text)
to anon;
