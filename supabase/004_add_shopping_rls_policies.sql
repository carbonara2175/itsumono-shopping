create schema private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create function private.is_household_member(target_household_id uuid)
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
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.is_household_member(uuid) from anon;
grant execute on function private.is_household_member(uuid) to authenticated;

grant select on table public.households to authenticated;
grant select on table public.household_members to authenticated;

create policy "Household members can view memberships"
on public.household_members
for select
to authenticated
using (private.is_household_member(household_id));

create policy "Household members can view households"
on public.households
for select
to authenticated
using (private.is_household_member(id));

create policy "Household members can view shopping items"
on public.shopping_items
for select
to authenticated
using (private.is_household_member(household_id));

create policy "Household members can create shopping items"
on public.shopping_items
for insert
to authenticated
with check (
  private.is_household_member(household_id)
  and (created_by is null or created_by = (select auth.uid()))
);

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
