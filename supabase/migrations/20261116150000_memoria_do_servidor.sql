-- Memória curta do servidor: estado das conversas do WhatsApp, mensagens já vistas,
-- pedidos ao robô do DAS e contadores de uso. Antes ficava na memória do processo e
-- sumia a cada publicação, o que reiniciava conversas e zerava os tetos de consultas pagas.
--
-- As chaves chegam já resumidas pelo site (sha256 do número), nunca o número em claro.
-- Tudo tem validade e é apagado depois de vencido.

create table if not exists privado.memoria (
  item   text primary key check (length(item) <= 200),
  valor  jsonb not null,
  expira timestamptz not null
);
create index if not exists memoria_expira on privado.memoria (expira);

create table if not exists privado.contadores (
  item   text primary key check (length(item) <= 200),
  total  int not null,
  expira timestamptz not null
);
create index if not exists contadores_expira on privado.contadores (expira);

alter table privado.memoria enable row level security;
alter table privado.contadores enable row level security;
revoke all on privado.memoria, privado.contadores from public, anon, authenticated;

create or replace function privado.limpar_vencidos() returns void
language sql security definer set search_path = '' as $$
  delete from privado.memoria where expira < now();
  delete from privado.contadores where expira < now();
$$;
revoke all on function privado.limpar_vencidos() from public, anon, authenticated;

/** Lê um item; vencido conta como ausente. */
create or replace function public.srv_mem_ler(p_chave text, p_item text) returns jsonb
language plpgsql security definer set search_path = '' stable as $$
begin
  perform privado.conferir_servidor(p_chave);
  return (select valor from privado.memoria where item = p_item and expira > now());
end $$;

/** Grava (ou apaga, com valor nulo) um item com validade em segundos. */
create or replace function public.srv_mem_gravar(p_chave text, p_item text, p_valor jsonb, p_segundos int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.conferir_servidor(p_chave);
  if p_valor is null then
    delete from privado.memoria where item = p_item;
  else
    if p_segundos is null or p_segundos < 1 or p_segundos > 172800 then
      raise exception 'validade inválida' using errcode = '22023';
    end if;
    insert into privado.memoria (item, valor, expira) values (p_item, p_valor, now() + make_interval(secs => p_segundos))
    on conflict (item) do update set valor = excluded.valor, expira = excluded.expira;
  end if;
  if random() < 0.02 then perform privado.limpar_vencidos(); end if;
end $$;

/**
 * Guarda o item só se ainda não existir (ou estiver vencido). Devolve o valor que ficou:
 * o novo, quando gravou; o antigo, quando já havia um.
 */
create or replace function public.srv_mem_reservar(p_chave text, p_item text, p_valor jsonb, p_segundos int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform privado.conferir_servidor(p_chave);
  if p_segundos is null or p_segundos < 1 or p_segundos > 172800 then
    raise exception 'validade inválida' using errcode = '22023';
  end if;
  insert into privado.memoria as m (item, valor, expira) values (p_item, p_valor, now() + make_interval(secs => p_segundos))
  on conflict (item) do update set valor = excluded.valor, expira = excluded.expira where m.expira <= now()
  returning valor into v;
  if v is null then select valor into v from privado.memoria where item = p_item; end if;
  return v;
end $$;

/** Soma um ao contador da janela. Devolve verdadeiro enquanto o total não passar do máximo. */
create or replace function public.srv_contar(p_chave text, p_item text, p_maximo int, p_segundos int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  perform privado.conferir_servidor(p_chave);
  if p_segundos is null or p_segundos < 1 or p_segundos > 172800 then
    raise exception 'validade inválida' using errcode = '22023';
  end if;
  insert into privado.contadores as c (item, total, expira) values (p_item, 1, now() + make_interval(secs => p_segundos))
  on conflict (item) do update
    set total = case when c.expira <= now() then 1 else c.total + 1 end,
        expira = case when c.expira <= now() then excluded.expira else c.expira end
  returning total into v;
  return v <= p_maximo;
end $$;

revoke all on function public.srv_mem_ler(text, text) from public, authenticated;
revoke all on function public.srv_mem_gravar(text, text, jsonb, int) from public, authenticated;
revoke all on function public.srv_mem_reservar(text, text, jsonb, int) from public, authenticated;
revoke all on function public.srv_contar(text, text, int, int) from public, authenticated;
grant execute on function public.srv_mem_ler(text, text) to anon;
grant execute on function public.srv_mem_gravar(text, text, jsonb, int) to anon;
grant execute on function public.srv_mem_reservar(text, text, jsonb, int) to anon;
grant execute on function public.srv_contar(text, text, int, int) to anon;
