create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  quantity numeric null,
  unit text not null default '',
  category text not null default 'その他',
  completed boolean not null default false,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_items_name_check
    check (char_length(name) between 1 and 50 and char_length(btrim(name)) > 0),
  constraint shopping_items_quantity_check
    check (quantity >= 0)
);

create index shopping_items_household_id_created_at_idx
  on public.shopping_items (household_id, created_at);

create function public.set_shopping_items_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger set_shopping_items_updated_at
before update on public.shopping_items
for each row
execute function public.set_shopping_items_updated_at();

alter table public.shopping_items enable row level security;

revoke all on table public.shopping_items from anon;
grant select, insert, update, delete on table public.shopping_items to authenticated;
