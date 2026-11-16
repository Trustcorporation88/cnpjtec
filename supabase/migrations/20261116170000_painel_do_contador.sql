-- Painel do contador: pedidos de ajuda e números de uso, só para as contas cujo celular
-- está em privado.configuracao ('contadores_telefones', separados por vírgula, no formato +55...).
-- O número fica no banco, não no repositório. A conferência é feita aqui, não no site.

create or replace function privado.contador_da_sessao(p_token_hash text) returns uuid
language plpgsql security definer set search_path = '' stable as $$
declare v_conta uuid; v_tel text; v_lista text;
begin
  v_conta := privado.conta_da_sessao(p_token_hash);
  select telefone into v_tel from privado.contas where id = v_conta;
  select valor into v_lista from privado.configuracao where nome = 'contadores_telefones';
  if v_tel is null or v_lista is null or not (v_tel = any (string_to_array(replace(v_lista, ' ', ''), ','))) then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  return v_conta;
end $$;
revoke all on function privado.contador_da_sessao(text) from public, anon, authenticated;

create or replace function public.srv_contador_painel(p_chave text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid; v_hoje text;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.contador_da_sessao(p_token_hash);
  insert into privado.registro_acesso (conta_id, acao) values (v_conta, 'painel_contador');
  v_hoje := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD');
  return jsonb_build_object(
    'numeros', jsonb_build_object(
      'contas', (select count(*) from privado.contas),
      'contasNaSemana', (select count(*) from privado.contas where criada_em > now() - interval '7 days'),
      'vendasNaSemana', (select count(*) from privado.vendas where incluida_em > now() - interval '7 days'),
      'notas', (select count(*) from privado.notas_compra),
      'pedidosAbertos', (select count(*) from privado.pedidos_ajuda where situacao = 'aberto'),
      'consultasDasHoje', coalesce((select total from privado.contadores where item = 'bothub:dia:' || v_hoje and expira > now()), 0)
    ),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'contato', p.contato, 'pergunta', p.pergunta, 'resumo', p.resumo,
        'criadoEm', p.criado_em, 'situacao', p.situacao, 'comConta', p.conta_id is not null
      ) order by (p.situacao = 'aberto') desc, p.criado_em desc)
      from (select * from privado.pedidos_ajuda order by criado_em desc limit 200) p
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.srv_contador_situacao(p_chave text, p_token_hash text, p_id uuid, p_situacao text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.contador_da_sessao(p_token_hash);
  if p_situacao not in ('aberto', 'respondido', 'cancelado') then
    raise exception 'situacao invalida' using errcode = '22023';
  end if;
  update privado.pedidos_ajuda set situacao = p_situacao where id = p_id;
  if not found then raise exception 'pedido nao encontrado' using errcode = 'P0002'; end if;
  insert into privado.registro_acesso (conta_id, acao) values (v_conta, 'pedido_' || p_situacao);
end $$;

revoke all on function public.srv_contador_painel(text, text) from public, authenticated;
revoke all on function public.srv_contador_situacao(text, text, uuid, text) from public, authenticated;
grant execute on function public.srv_contador_painel(text, text) to anon;
grant execute on function public.srv_contador_situacao(text, text, uuid, text) to anon;
