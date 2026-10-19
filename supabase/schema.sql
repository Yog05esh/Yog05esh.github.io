-- STRATA static demo: paste this in the Supabase SQL editor. Do not use a service-role key in the web app.
create table if not exists public.companies (
  id text primary key,
  name text not null,
  industry text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  role text not null check (role in ('business_head','operations_manager','account_manager','sales_manager','support_manager','qa_head')),
  company_id text not null references public.companies(id),
  company_name text not null,
  company_industry text not null,
  company_code text,
  prefs jsonb not null default '{"theme":"system","email_alerts":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Join codes are intentionally public demo credentials. They are redeemed only by an authenticated user.
create table if not exists public.company_join_codes (
  code text primary key check (code = upper(code) and length(code) = 6),
  company_id text not null references public.companies(id) on delete cascade,
  role text not null check (role in ('business_head','operations_manager','account_manager','sales_manager','support_manager','qa_head')),
  purpose text not null,
  active boolean not null default true,
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.company_join_code_redemptions (
  code text not null references public.company_join_codes(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

-- Generic change log used by the static API abstraction. Its resource field records the source endpoint;
-- the specific tables below make the user-created data inspectable and easy to evolve later.
create table if not exists public.demo_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id),
  resource text not null,
  operation text not null check (operation in ('POST','PATCH','PUT','DELETE')),
  payload jsonb not null default '{}'::jsonb,
  fixture_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id),
  incident_id text,
  account_id text,
  author text not null,
  author_role text not null,
  body text not null,
  mentions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.notebook_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id),
  author text not null,
  tried text not null,
  happened text not null,
  changed text,
  evidence text,
  created_at timestamptz not null default now()
);
create table if not exists public.workflow_overrides (
  task_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id),
  status text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.plan_decisions (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id),
  decision text not null check (decision in ('approved','modified','rejected')),
  reason text,
  created_at timestamptz not null default now()
);
create table if not exists public.routine_approvals (
  routine_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id),
  approved boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_join_codes enable row level security;
alter table public.company_join_code_redemptions enable row level security;
alter table public.demo_records enable row level security;
alter table public.notes enable row level security;
alter table public.notebook_entries enable row level security;
alter table public.workflow_overrides enable row level security;
alter table public.plan_decisions enable row level security;
alter table public.routine_approvals enable row level security;

-- The lookup is SECURITY DEFINER to avoid recursive RLS evaluation when policies compare company IDs.
create or replace function public.current_company_id() returns text language sql stable security definer set search_path = public as
  $$ select company_id from public.profiles where user_id = auth.uid() $$;
revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to authenticated;

create policy "profiles are private" on public.profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "company list is visible to signed-in demo users" on public.companies for select to authenticated using (true);
create policy "valid demo join codes can be checked" on public.company_join_codes for select to authenticated using (active and (expires_at is null or expires_at > now()) and used_count < max_uses);
create policy "users can read their own code redemptions" on public.company_join_code_redemptions for select to authenticated using (user_id = auth.uid());

-- Redeem atomically so a code cannot be reused by the same account or exceed its configured use limit.
create or replace function public.redeem_company_join_code(p_code text)
returns table (company_id text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  join_code public.company_join_codes%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in before redeeming a join code'; end if;
  select * into join_code
    from public.company_join_codes
    where code = upper(trim(p_code))
    for update;
  if not found or not join_code.active then raise exception 'Invalid join code'; end if;
  if join_code.expires_at is not null and join_code.expires_at <= now() then raise exception 'Join code has expired'; end if;
  if join_code.used_count >= join_code.max_uses then raise exception 'Join code has already been used'; end if;
  if exists (select 1 from public.company_join_code_redemptions where code = join_code.code and user_id = auth.uid()) then
    raise exception 'Join code has already been used by this account';
  end if;
  insert into public.company_join_code_redemptions (code, user_id) values (join_code.code, auth.uid());
  update public.company_join_codes set used_count = used_count + 1 where code = join_code.code;
  return query select join_code.company_id, join_code.role;
end;
$$;
revoke all on function public.redeem_company_join_code(text) from public;
grant execute on function public.redeem_company_join_code(text) to authenticated;

create policy "company rows are readable" on public.demo_records for select to authenticated using (owner_id = auth.uid() or company_id = public.current_company_id());
create policy "own demo records can be inserted" on public.demo_records for insert to authenticated with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own demo records can change" on public.demo_records for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own demo records can be removed" on public.demo_records for delete to authenticated using (owner_id = auth.uid());

create policy "company notes are readable" on public.notes for select to authenticated using (company_id = public.current_company_id());
create policy "own notes can be inserted" on public.notes for insert to authenticated with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own notes can change" on public.notes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own notes can be removed" on public.notes for delete to authenticated using (owner_id = auth.uid());

create policy "company notebook rows are readable" on public.notebook_entries for select to authenticated using (company_id = public.current_company_id());
create policy "own notebook rows can be inserted" on public.notebook_entries for insert to authenticated with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own notebook rows can change" on public.notebook_entries for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own notebook rows can be removed" on public.notebook_entries for delete to authenticated using (owner_id = auth.uid());

create policy "company workflow rows are readable" on public.workflow_overrides for select to authenticated using (company_id = public.current_company_id());
create policy "own workflow rows can be inserted" on public.workflow_overrides for insert to authenticated with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own workflow rows can change" on public.workflow_overrides for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own workflow rows can be removed" on public.workflow_overrides for delete to authenticated using (owner_id = auth.uid());

create policy "company plan decisions are readable" on public.plan_decisions for select to authenticated using (company_id = public.current_company_id());
create policy "own plan decisions can be inserted" on public.plan_decisions for insert to authenticated with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own plan decisions can change" on public.plan_decisions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own plan decisions can be removed" on public.plan_decisions for delete to authenticated using (owner_id = auth.uid());

create policy "company routine approvals are readable" on public.routine_approvals for select to authenticated using (company_id = public.current_company_id());
create policy "own routine approvals can be inserted" on public.routine_approvals for insert to authenticated with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own routine approvals can change" on public.routine_approvals for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and company_id = public.current_company_id());
create policy "own routine approvals can be removed" on public.routine_approvals for delete to authenticated using (owner_id = auth.uid());

-- Seed the fictional static-demo company. No user data or secrets are included.
insert into public.companies (id, name, industry) values
  ('co_altygen', 'Altygen Biopharm', 'Synthetic nephrology-pharma operations')
on conflict (id) do update set name = excluded.name, industry = excluded.industry;

insert into public.company_join_codes (code, company_id, role, purpose, max_uses) values
  ('ALTADM', 'co_altygen', 'business_head', 'Admin and company manager', 3),
  ('ALTEMP', 'co_altygen', 'account_manager', 'General employee', 20),
  ('ALTOPS', 'co_altygen', 'operations_manager', 'Operations department', 10),
  ('ALTACC', 'co_altygen', 'account_manager', 'Accounts department', 10),
  ('ALTSAL', 'co_altygen', 'sales_manager', 'Sales department', 10),
  ('ALTSUP', 'co_altygen', 'support_manager', 'Support department', 10),
  ('ALTQA1', 'co_altygen', 'qa_head', 'Quality assurance department', 10)
on conflict (code) do update set
  company_id = excluded.company_id, role = excluded.role, purpose = excluded.purpose,
  max_uses = excluded.max_uses, active = true;
