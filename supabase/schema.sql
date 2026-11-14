-- Личная система: схема базы.
-- Выполни целиком в Supabase → SQL Editor → New query → Run.
-- Каждая таблица защищена RLS: видишь и меняешь только свои строки.
-- Исключение — витрина (profile, showcase_cases): её публичные строки читаются всеми.

create extension if not exists pgcrypto;

-- Настройки и цели верхнего уровня
create table if not exists settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  income_goal numeric default 1000000,
  cycle_goal numeric default 600000,
  cycle_end date default '2027-01-17',
  deal_goal numeric default 300000,
  deal_note text default 'уточнить: что и к какой дате',
  capital numeric default 0,
  capital_goal numeric default 0,
  monthly_saving_goal numeric default 50000,
  vision text default '1 млн ₽ в месяц из нескольких независимых источников, капитал работает на меня',
  main_action text default '',
  updated_at timestamptz default now()
);

-- Бизнес-юниты (проекты)
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  model text default '',
  fixed_income numeric default 0,
  variable_income numeric default 0,
  goal text default '',
  next_step text default '',
  status text default 'в работе',
  sort int default 0,
  created_at timestamptz default now()
);

-- Сделки (общая воронка)
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references projects on delete set null,
  title text not null,
  stage text not null default 'contact' check (stage in ('contact','talks','pilot','contract','lost')),
  amount numeric default 0,
  next_step text default '',
  created_at timestamptz default now()
);

-- Задачи
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references projects on delete set null,
  title text not null,
  due date,
  done boolean default false,
  created_at timestamptz default now()
);

-- Цели цикла и ключевые результаты
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  sort int default 0,
  created_at timestamptz default now()
);
create table if not exists key_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id uuid not null references goals on delete cascade,
  title text not null,
  current numeric default 0,
  target numeric default 1,
  created_at timestamptz default now()
);

-- Еженедельный чек-ин
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null,
  answers jsonb default '{}'::jsonb,
  next_action text default '',
  created_at timestamptz default now(),
  unique (user_id, week_start)
);

-- Витрина
create table if not exists profile (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text default '',
  headline text default '',
  about text default '',
  contact text default '',
  is_public boolean default false
);
create table if not exists showcase_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  value text not null,
  label text not null,
  is_public boolean default true,
  sort int default 0,
  created_at timestamptz default now()
);

-- RLS: только владелец
do $$
declare t text;
begin
  foreach t in array array['settings','projects','deals','tasks','goals','key_results','checkins','profile','showcase_cases']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format('create policy owner_all on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Публичное чтение витрины
drop policy if exists public_read on profile;
create policy public_read on profile for select using (is_public = true);
drop policy if exists public_read on showcase_cases;
create policy public_read on showcase_cases for select
  using (is_public = true and exists (select 1 from profile p where p.user_id = showcase_cases.user_id and p.is_public));
