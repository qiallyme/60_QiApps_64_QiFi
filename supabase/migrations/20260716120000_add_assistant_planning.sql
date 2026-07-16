create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade default 'default',
  title text not null default 'Qi Assistant conversation',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_plans (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade default 'default',
  status text not null check (status in ('needs_clarification', 'pending_approval', 'executing', 'completed', 'partially_completed', 'failed', 'rejected')),
  summary text not null,
  questions jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  executed_at timestamptz
);

create table if not exists public.assistant_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.assistant_plans(id) on delete cascade,
  client_step_id text not null,
  position integer not null,
  action_type text not null,
  description text not null,
  payload jsonb not null default '{}'::jsonb,
  depends_on jsonb not null default '[]'::jsonb,
  confidence numeric(4,3),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'executing', 'executed', 'skipped', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, client_step_id),
  unique (plan_id, position)
);

create index if not exists assistant_messages_thread_created_idx on public.assistant_messages(thread_id, created_at);
create index if not exists assistant_plans_thread_created_idx on public.assistant_plans(thread_id, created_at desc);
create index if not exists assistant_plan_steps_plan_position_idx on public.assistant_plan_steps(plan_id, position);

alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_plans enable row level security;
alter table public.assistant_plan_steps enable row level security;

revoke all on table public.assistant_threads from anon, authenticated;
revoke all on table public.assistant_messages from anon, authenticated;
revoke all on table public.assistant_plans from anon, authenticated;
revoke all on table public.assistant_plan_steps from anon, authenticated;
grant all on table public.assistant_threads to service_role;
grant all on table public.assistant_messages to service_role;
grant all on table public.assistant_plans to service_role;
grant all on table public.assistant_plan_steps to service_role;
