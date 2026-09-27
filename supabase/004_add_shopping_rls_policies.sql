create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

revoke all on function private.is_household_member(uuid) from public;
grant execute on function private.is_household_member(uuid) to authenticated;

create policy "Household members can view their household"
on public.households
for select
to authenticated
using (private.is_household_member(id));

create policy "Household members can view fellow members"
on public.household_members
for select
to authenticated
using (private.is_household_member(household_id));

create policy "Household members can view shopping items"
on public.shopping_items
for select
to authenticated
using (private.is_household_member(household_id));

create policy "Household members can add shopping items"
on public.shopping_items
for insert
to authenticated
with check (
  private.is_household_member(household_id)
  and created_by = auth.uid()
);

-- Keep ownership and audit columns immutable from authenticated clients. The
-- updated_at trigger can still assign updated_at because it runs as part of an
-- otherwise permitted update rather than as a client column assignment.
revoke update on table public.shopping_items from authenticated;
grant update (name, quantity, unit, category, completed)
on table public.shopping_items
to authenticated;

create policy "Household members can update shopping items"
on public.shopping_items
for update
to authenticated
using (private.is_household_member(household_id))
with check (private.is_household_member(household_id));

create policy "Household members can delete shopping items"
on public.shopping_items
for delete
to authenticated
using (private.is_household_member(household_id));
