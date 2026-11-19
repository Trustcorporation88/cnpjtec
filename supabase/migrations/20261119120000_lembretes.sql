-- Lembretes pelo WhatsApp, só para quem pediu: DAS (regra R32), declaração anual (R33) e limite do MEI.
-- Cada lembrete é registrado com uma chave (ex.: "das:2026-11") para nunca sair duas vezes.

create table if not exists privado.lembretes (
  conta_id uuid primary key references privado.contas(id) on delete cascade,
  das boolean not null default true,
  declaracao boolean not null default true,
  limite boolean not null default true,
  ativo boolean not null default true,
  pedido_em timestamptz not null default now(),
  alterado_em timestamptz not null default now()
);
comment on table privado.lembretes is 'Quem pediu lembretes pelo WhatsApp. Base legal: consentimento; sai com "parar lembretes" ou ao apagar a conta.';

create table if not exists privado.lembretes_enviados (
  conta_id uuid not null references privado.contas(id) on delete cascade,
  chave text not null check (char_length(chave) between 3 and 60),
  enviado_em timestamptz not null default now(),
  primary key (conta_id, chave)
);

alter table privado.lembretes enable row level security;
alter table privado.lembretes_enviados enable row level security;
revoke all on privado.lembretes, privado.lembretes_enviados from public, anon, authenticated;

/** Liga (ou religa) os lembretes da conta do telefone. Devolve falso se não houver conta. */
create or replace function public.srv_wa_lembretes_ligar(p_chave text, p_telefone text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then return false; end if;
  insert into privado.lembretes (conta_id) values (v_conta)
  on conflict (conta_id) do update set ativo = true, das = true, declaracao = true, limite = true, alterado_em = now();
  return true;
end $$;

/** Desliga os lembretes. Devolve verdadeiro se havia lembretes ligados. */
create or replace function public.srv_wa_lembretes_desligar(p_chave text, p_telefone text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then return false; end if;
  update privado.lembretes set ativo = false, alterado_em = now() where conta_id = v_conta and ativo;
  return found;
end $$;

/** Situação dos lembretes do telefone: null sem conta, senão {ativo}. */
create or replace function public.srv_wa_lembretes(p_chave text, p_telefone text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then return null; end if;
  return jsonb_build_object('ativo', coalesce((select ativo from privado.lembretes where conta_id = v_conta), false));
end $$;

/** Quem recebe lembretes, com as vendas do ano corrente e do anterior (para limite e declaração). */
create or replace function public.srv_lembretes_assinantes(p_chave text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.conferir_servidor(p_chave);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'telefone', c.telefone, 'das', l.das, 'declaracao', l.declaracao, 'limite', l.limite,
      'vendas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'data', to_char(v.data, 'YYYY-MM-DD'), 'valor', v.valor::text, 'tipo', v.tipo,
          'compradorTemCnpj', v.comprador_tem_cnpj) order by v.data)
        from privado.vendas v
        where v.conta_id = c.id and v.data >= date_trunc('year', now() at time zone 'America/Sao_Paulo') - interval '1 year'
      ), '[]'::jsonb)) order by c.criada_em)
    from privado.lembretes l join privado.contas c on c.id = l.conta_id
    where l.ativo
  ), '[]'::jsonb);
end $$;

/** Marca o lembrete como enviado. Devolve falso se a mesma chave já tinha saído para essa conta. */
create or replace function public.srv_lembrete_marcar(p_chave text, p_telefone text, p_lembrete text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_conta uuid;
begin
  perform privado.conferir_servidor(p_chave);
  v_conta := privado.conta_do_telefone(p_telefone);
  if v_conta is null then return false; end if;
  insert into privado.lembretes_enviados (conta_id, chave) values (v_conta, p_lembrete) on conflict do nothing;
  return found;
end $$;

/** Desfaz a marca quando o envio falhou, para tentar de novo no dia seguinte. */
create or replace function public.srv_lembrete_desmarcar(p_chave text, p_telefone text, p_lembrete text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.conferir_servidor(p_chave);
  delete from privado.lembretes_enviados
   where conta_id = privado.conta_do_telefone(p_telefone) and chave = p_lembrete;
end $$;

revoke all on function
  public.srv_wa_lembretes_ligar(text, text), public.srv_wa_lembretes_desligar(text, text),
  public.srv_wa_lembretes(text, text), public.srv_lembretes_assinantes(text),
  public.srv_lembrete_marcar(text, text, text), public.srv_lembrete_desmarcar(text, text, text)
from public, authenticated;
grant execute on function
  public.srv_wa_lembretes_ligar(text, text), public.srv_wa_lembretes_desligar(text, text),
  public.srv_wa_lembretes(text, text), public.srv_lembretes_assinantes(text),
  public.srv_lembrete_marcar(text, text, text), public.srv_lembrete_desmarcar(text, text, text)
to anon;
