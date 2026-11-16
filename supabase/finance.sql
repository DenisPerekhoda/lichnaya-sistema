-- Раздел «Финансы»: таблицы снимков, портфель Т-Инвестиций, функции записи по ключу.
-- Уже применено в проекте jkatklipqmnfjdienafw. Здесь для справки и восстановления.
-- Ключ ingest_key НЕ хранится в репозитории: он в private.config и в тексте ежедневной задачи.

create table if not exists fin_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  as_of date not null,
  data jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, as_of)
);
alter table fin_snapshots enable row level security;
create policy owner_read on fin_snapshots for select using (user_id = auth.uid());

create table if not exists invest_raw (
  user_id uuid primary key references auth.users on delete cascade,
  fetched_at timestamptz default now(),
  data jsonb not null
);
alter table invest_raw enable row level security;
create policy owner_read on invest_raw for select using (user_id = auth.uid());

-- Владелец системы (первый и единственный пользователь)
create or replace function public.owner_id() returns uuid
language sql security definer set search_path = '' as $$
  select id from auth.users order by created_at limit 1
$$;
revoke all on function public.owner_id() from public, anon, authenticated;
grant execute on function public.owner_id() to service_role;

create schema if not exists private;
create table if not exists private.config (key text primary key, value text not null);
revoke all on schema private from public, anon, authenticated;
-- insert into private.config values ('ingest_key', '<секрет>');

create or replace function public.fin_export_invest(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_key is distinct from (select value from private.config where key = 'ingest_key') then
    raise exception 'forbidden';
  end if;
  return (select data from public.invest_raw where user_id = public.owner_id());
end $$;

create or replace function public.fin_ingest_snapshot(p_key text, p_data jsonb) returns date
language plpgsql security definer set search_path = '' as $$
declare d date := (p_data->>'as_of')::date;
begin
  if p_key is distinct from (select value from private.config where key = 'ingest_key') then
    raise exception 'forbidden';
  end if;
  insert into public.fin_snapshots (user_id, as_of, data) values (public.owner_id(), d, p_data)
  on conflict (user_id, as_of) do update set data = excluded.data, created_at = now();
  return d;
end $$;
revoke all on function public.fin_export_invest(text) from public;
revoke all on function public.fin_ingest_snapshot(text, jsonb) from public;
grant execute on function public.fin_export_invest(text) to anon;
grant execute on function public.fin_ingest_snapshot(text, jsonb) to anon;

-- Ежедневный вызов функции tinvest-sync (06:45 МСК = 03:45 UTC)
create extension if not exists pg_net;
create extension if not exists pg_cron;
-- select cron.schedule('tinvest-sync-daily', '45 3 * * *', $$ select net.http_post(
--   url := 'https://jkatklipqmnfjdienafw.supabase.co/functions/v1/tinvest-sync',
--   headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon key>"}'::jsonb,
--   body := '{}'::jsonb, timeout_milliseconds := 150000) $$);
