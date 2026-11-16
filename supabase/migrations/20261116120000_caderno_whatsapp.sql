-- Caderno e cofre pelo WhatsApp.
--
-- O WhatsApp identifica a pessoa pelo número, que é o mesmo login da conta no site.
-- As funções srv_wa_* recebem o telefone (+55...) em vez da sessão; continuam exigindo
-- a chave do servidor, que só o site tem. O telefone vem do webhook autenticado.

alter table privado.vendas add column if not exists incluida_em timestamptz not null default now();

create or replace function privado.conta_do_telefone(p_telefone text) returns uuid
language sql security definer set search_path = '' stable as $$
  select id from privado.contas where telefone = p_telefone
$$;
revoke all on function privado.conta_do_telefone(text) from public, anon, authenticated;

create or replace function public.srv_wa_conta(p_chave text, p_telefone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  perform privado.conferir_servidor(p_chave);
  select id, criada_em into v from privado.contas where telefone = p_telefone;
  if not found then return null; end if;
  return jsonb_build_object('id', v.id, 'criadaEm', v.criada_em);
end $$;

create or replace function public.srv_wa_criar_conta(p_chave text, p_telefone text, p_consentimento text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_nova boolean := false;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then
    insert into privado.contas (telefone, consentimento_versao)
    values (p_telefone, p_consentimento) returning id into v_conta;
    v_nova := true;
  end if;
  insert into privado.registro_acesso (conta_id, acao) values (v_conta, case when v_nova then 'criar_whatsapp' else 'entrar_whatsapp' end);
  return jsonb_build_object('id', v_conta, 'nova', v_nova);
end $$;

create or replace function public.srv_wa_venda_incluir(p_chave text, p_telefone text, p_venda jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_total int;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then raise exception 'sem conta' using errcode = '28000'; end if;
  select count(*) into v_total from privado.vendas where conta_id = v_conta;
  if v_total >= 5000 then raise exception 'caderno cheio' using errcode = '22023'; end if;
  insert into privado.vendas (conta_id, id, data, valor, tipo, comprador_tem_cnpj, descricao)
  values (v_conta, p_venda->>'id', (p_venda->>'data')::date, (p_venda->>'valor')::numeric, p_venda->>'tipo',
          (p_venda->>'compradorTemCnpj')::boolean, coalesce(p_venda->>'descricao', ''));
  return v_total + 1;
end $$;

create or replace function public.srv_wa_vendas(p_chave text, p_telefone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'data', to_char(data, 'YYYY-MM-DD'), 'valor', valor::text, 'tipo', tipo,
      'compradorTemCnpj', comprador_tem_cnpj, 'descricao', descricao) order by data, id)
    from privado.vendas where conta_id = v_conta), '[]'::jsonb);
end $$;

create or replace function public.srv_wa_desfazer_venda(p_chave text, p_telefone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v record;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then return null; end if;
  select id, data, valor, tipo into v from privado.vendas
   where conta_id = v_conta and incluida_em > now() - interval '1 day'
   order by incluida_em desc limit 1;
  if not found then return null; end if;
  delete from privado.vendas where conta_id = v_conta and id = v.id;
  return jsonb_build_object('data', to_char(v.data, 'YYYY-MM-DD'), 'valor', v.valor::text, 'tipo', v.tipo);
end $$;

create or replace function public.srv_wa_nota_gravar(p_chave text, p_telefone text, p_nota jsonb, p_xml text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_id uuid; v_quantas int;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then raise exception 'sem conta' using errcode = '28000'; end if;
  select count(*) into v_quantas from privado.notas_compra where conta_id = v_conta;
  if v_quantas >= 3000 then return jsonb_build_object('ok', false, 'motivo', 'limite'); end if;
  insert into privado.notas_compra (
    conta_id, chave, origem, emitente_cnpj, emitente_nome, numero, data_emissao,
    valor_total, valor_icms_st, itens, xml)
  values (
    v_conta, p_nota->>'chave', 'xml', p_nota->>'emitenteCnpj', p_nota->>'emitenteNome',
    p_nota->>'numero', (p_nota->>'dataEmissao')::date, (p_nota->>'valorTotal')::numeric,
    (p_nota->>'valorIcmsSt')::numeric, coalesce(p_nota->'itens', '[]'::jsonb), p_xml)
  on conflict (conta_id, chave) do update set
    origem = 'xml',
    emitente_cnpj = excluded.emitente_cnpj,
    emitente_nome = excluded.emitente_nome,
    numero = excluded.numero,
    data_emissao = excluded.data_emissao,
    valor_total = excluded.valor_total,
    valor_icms_st = excluded.valor_icms_st,
    itens = excluded.itens,
    xml = excluded.xml
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

revoke all on function
  public.srv_wa_conta(text, text),
  public.srv_wa_criar_conta(text, text, text),
  public.srv_wa_venda_incluir(text, text, jsonb),
  public.srv_wa_vendas(text, text),
  public.srv_wa_desfazer_venda(text, text),
  public.srv_wa_nota_gravar(text, text, jsonb, text)
from public, authenticated;

grant execute on function
  public.srv_wa_conta(text, text),
  public.srv_wa_criar_conta(text, text, text),
  public.srv_wa_venda_incluir(text, text, jsonb),
  public.srv_wa_vendas(text, text),
  public.srv_wa_desfazer_venda(text, text),
  public.srv_wa_nota_gravar(text, text, jsonb, text)
to anon;
