-- Admins add an existing user (by email) to their organization, or change their role.
create or replace function public.add_org_member(p_org_id uuid, p_email text, p_role public.org_role default 'user')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not exists (select 1 from private.admin_org_ids() a where a = p_org_id) then
    raise exception 'Only admins can add members' using errcode = '42501';
  end if;
  select p.id into v_user from public.profiles p where lower(p.email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No user with that email has signed up yet' using errcode = 'P0002';
  end if;
  insert into public.organization_members (org_id, user_id, role)
  values (p_org_id, v_user, p_role)
  on conflict (org_id, user_id) do update set role = excluded.role;
end;
$$;

revoke execute on function public.add_org_member(uuid, text, public.org_role) from public, anon;
grant execute on function public.add_org_member(uuid, text, public.org_role) to authenticated;
