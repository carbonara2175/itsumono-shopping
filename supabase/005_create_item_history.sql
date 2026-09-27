create table public.item_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  count integer not null default 1,
  last_quantity numeric null,
  last_unit text not null default '',
  last_category text not null default 'その他',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint item_history_household_id_name_key unique (household_id, name),
  constraint item_history_name_check
    check (char_length(name) between 1 and 50 and char_length(btrim(name)) > 0),
  constraint item_history_count_check
    check (count >= 1),
  constraint item_history_last_quantity_check
    check (last_quantity >= 0)
);

create index item_history_household_id_count_idx
  on public.item_history (household_id, count desc);

create function public.set_item_history_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger set_item_history_updated_at
before update on public.item_history
for each row
execute function public.set_item_history_updated_at();

alter table public.item_history enable row level security;

create policy "Household members can view item history"
on public.item_history
for select
to authenticated
using (private.is_household_member(household_id));

create policy "Household members can add item history"
on public.item_history
for insert
to authenticated
with check (private.is_household_member(household_id));

create policy "Household members can update item history"
on public.item_history
for update
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

revoke all on table public.item_history from anon;
revoke all on table public.item_history from authenticated;
grant select, insert on table public.item_history to authenticated;
grant update (count, last_quantity, last_unit, last_category)
on table public.item_history
to authenticated;
