-- =====================================================================
-- Salesforce clone: Row Level Security, business logic, views, RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.organization_members enable row level security;

create policy "Members can view their organizations"
  on public.organizations for select to authenticated
  using (id in (select private.user_org_ids()));

create policy "Admins can update their organizations"
  on public.organizations for update to authenticated
  using (id in (select private.admin_org_ids()))
  with check (id in (select private.admin_org_ids()));

create policy "Users can view profiles in their organizations"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select m.user_id from public.organization_members m
      where m.org_id in (select private.user_org_ids())
    )
  );

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (default_org_id is null or default_org_id in (select private.user_org_ids()))
  );

create policy "Members can view memberships in their organizations"
  on public.organization_members for select to authenticated
  using (org_id in (select private.user_org_ids()));

create policy "Admins can add members"
  on public.organization_members for insert to authenticated
  with check (org_id in (select private.admin_org_ids()));

create policy "Admins can change member roles"
  on public.organization_members for update to authenticated
  using (org_id in (select private.admin_org_ids()))
  with check (org_id in (select private.admin_org_ids()));

create policy "Admins can remove members"
  on public.organization_members for delete to authenticated
  using (org_id in (select private.admin_org_ids()) and user_id <> (select auth.uid()));

-- Every CRM object: members read/create/edit, owner or admin deletes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'contacts', 'campaigns', 'leads', 'opportunities', 'products',
    'opportunity_line_items', 'cases', 'campaign_members', 'activities', 'notes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "Org members can view" on public.%I for select to authenticated
      using (org_id in (select private.user_org_ids()))$p$, t);
    execute format($p$create policy "Org members can create" on public.%I for insert to authenticated
      with check (org_id in (select private.user_org_ids()))$p$, t);
    execute format($p$create policy "Org members can edit" on public.%I for update to authenticated
      using (org_id in (select private.user_org_ids()))
      with check (org_id in (select private.user_org_ids()))$p$, t);
    execute format($p$create policy "Owners and admins can delete" on public.%I for delete to authenticated
      using (owner_id = (select auth.uid()) or org_id in (select private.admin_org_ids()))$p$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Business logic triggers
-- ---------------------------------------------------------------------

-- Opportunity: default probability per stage, closed / won flags.
create or replace function private.opportunity_stage_defaults()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    if tg_op = 'INSERT' and new.probability is not null then
      null; -- respect an explicit probability on insert
    else
      new.probability := case new.stage
        when 'Prospecting'    then 10
        when 'Qualification'  then 20
        when 'Needs Analysis' then 40
        when 'Proposal'       then 60
        when 'Negotiation'    then 80
        when 'Closed Won'     then 100
        when 'Closed Lost'    then 0
      end;
    end if;
    new.is_closed := new.stage in ('Closed Won', 'Closed Lost');
    new.is_won    := new.stage = 'Closed Won';
    new.closed_at := case when new.is_closed then coalesce(new.closed_at, now()) else null end;
  end if;
  return new;
end;
$$;

create trigger opportunity_stage_defaults
  before insert or update on public.opportunities
  for each row execute function private.opportunity_stage_defaults();

-- Opportunity amount = sum of line items (when the opportunity has products).
create or replace function private.rollup_opportunity_amount()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  opp uuid := coalesce(new.opportunity_id, old.opportunity_id);
begin
  update public.opportunities o
     set amount = coalesce((select sum(li.total_price) from public.opportunity_line_items li
                            where li.opportunity_id = opp), 0)
   where o.id = opp;
  if tg_op = 'UPDATE' and new.opportunity_id is distinct from old.opportunity_id then
    update public.opportunities o
       set amount = coalesce((select sum(li.total_price) from public.opportunity_line_items li
                              where li.opportunity_id = old.opportunity_id), 0)
     where o.id = old.opportunity_id;
  end if;
  return null;
end;
$$;

create trigger rollup_opportunity_amount
  after insert or update or delete on public.opportunity_line_items
  for each row execute function private.rollup_opportunity_amount();

-- Line item: default unit price from the product's list price.
create or replace function private.line_item_default_price()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.unit_price is null then
    select p.unit_price into new.unit_price from public.products p where p.id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger line_item_default_price
  before insert on public.opportunity_line_items
  for each row execute function private.line_item_default_price();

-- Case: stamp closed_at.
create or replace function private.case_closed_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'Closed' then
    new.closed_at := coalesce(new.closed_at, now());
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger case_closed_at
  before insert or update on public.cases
  for each row execute function private.case_closed_at();

-- Activity: stamp completed_at.
create or replace function private.activity_completed_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'Completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger activity_completed_at
  before insert or update on public.activities
  for each row execute function private.activity_completed_at();

-- ---------------------------------------------------------------------
-- RPC: convert a lead into account + contact (+ opportunity)
-- Runs as the caller, so RLS still applies.
-- ---------------------------------------------------------------------
create or replace function public.convert_lead(
  p_lead_id             uuid,
  p_account_id          uuid    default null,
  p_create_opportunity  boolean default true,
  p_opportunity_name    text    default null
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  l        public.leads;
  acc_id   uuid := p_account_id;
  con_id   uuid;
  opp_id   uuid;
begin
  select * into l from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;
  if l.status = 'Converted' then
    raise exception 'Lead has already been converted' using errcode = 'P0001';
  end if;

  if acc_id is null then
    insert into public.accounts (org_id, owner_id, name, industry, phone, annual_revenue, employees, billing_city, billing_country, type)
    values (l.org_id, coalesce(l.owner_id, auth.uid()), l.company, l.industry, l.phone, l.annual_revenue, l.employees, l.city, l.country, 'Prospect')
    returning id into acc_id;
  end if;

  insert into public.contacts (org_id, owner_id, account_id, salutation, first_name, last_name, title, email, phone, lead_source, mailing_city, mailing_country, description)
  values (l.org_id, coalesce(l.owner_id, auth.uid()), acc_id, l.salutation, l.first_name, l.last_name, l.title, l.email, l.phone, l.lead_source, l.city, l.country, l.description)
  returning id into con_id;

  if p_create_opportunity then
    insert into public.opportunities (org_id, owner_id, account_id, contact_id, campaign_id, name, lead_source, stage)
    values (l.org_id, coalesce(l.owner_id, auth.uid()), acc_id, con_id, l.campaign_id,
            coalesce(nullif(trim(p_opportunity_name), ''), l.company || ' - New Business'),
            l.lead_source, 'Prospecting')
    returning id into opp_id;
  end if;

  -- Carry the lead's history over to the new contact.
  update public.activities set contact_id = con_id, account_id = coalesce(account_id, acc_id), lead_id = null where lead_id = l.id;
  update public.notes      set contact_id = con_id, lead_id = null where lead_id = l.id;
  update public.campaign_members set contact_id = con_id, lead_id = null
   where lead_id = l.id
     and not exists (select 1 from public.campaign_members cm2
                     where cm2.campaign_id = campaign_members.campaign_id and cm2.contact_id = con_id);

  update public.leads
     set status = 'Converted',
         converted_at = now(),
         converted_account_id = acc_id,
         converted_contact_id = con_id,
         converted_opportunity_id = opp_id
   where id = l.id;

  return jsonb_build_object('account_id', acc_id, 'contact_id', con_id, 'opportunity_id', opp_id);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: global search across main objects
-- ---------------------------------------------------------------------
create or replace function public.global_search(p_query text, p_limit integer default 25)
returns table (object_type text, id uuid, title text, subtitle text)
language sql stable security invoker set search_path = ''
as $$
  with q as (select '%' || replace(replace(trim(p_query), '%', '\%'), '_', '\_') || '%' as pat)
  select * from (
    select 'accounts'::text, a.id, a.name, concat_ws(' · ', a.industry, a.billing_city)
      from public.accounts a, q where a.name ilike q.pat or a.website ilike q.pat
    union all
    select 'contacts', c.id, concat_ws(' ', c.first_name, c.last_name), concat_ws(' · ', c.title, c.email)
      from public.contacts c, q
     where concat_ws(' ', c.first_name, c.last_name) ilike q.pat or c.email ilike q.pat
    union all
    select 'leads', l.id, concat_ws(' ', l.first_name, l.last_name), concat_ws(' · ', l.company, l.status::text)
      from public.leads l, q
     where concat_ws(' ', l.first_name, l.last_name) ilike q.pat or l.company ilike q.pat or l.email ilike q.pat
    union all
    select 'opportunities', o.id, o.name, concat_ws(' · ', o.stage::text, to_char(o.close_date, 'DD Mon YYYY'))
      from public.opportunities o, q where o.name ilike q.pat
    union all
    select 'cases', s.id, '#' || s.case_number || ' ' || s.subject, concat_ws(' · ', s.status::text, s.priority::text)
      from public.cases s, q where s.subject ilike q.pat or s.case_number::text = trim(p_query)
  ) r
  where char_length(trim(p_query)) >= 2
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------
-- RPC: switch the active organization
-- ---------------------------------------------------------------------
create or replace function public.set_active_org(p_org_id uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.profiles set default_org_id = p_org_id where id = auth.uid();
end;
$$;

-- RPC: create another organization (caller becomes admin and switches to it)
create or replace function public.create_organization(p_name text, p_seed_demo boolean default false)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_org uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  insert into public.organizations (name) values (coalesce(nullif(trim(p_name), ''), 'My Company')) returning id into new_org;
  insert into public.organization_members (org_id, user_id, role) values (new_org, uid, 'admin');
  update public.profiles set default_org_id = new_org where id = uid;
  if p_seed_demo then
    perform private.seed_demo_data(new_org, uid);
  end if;
  return new_org;
end;
$$;

-- ---------------------------------------------------------------------
-- Reporting views (security_invoker so RLS applies to the caller)
-- ---------------------------------------------------------------------
create view public.opportunity_pipeline with (security_invoker = true) as
select
  o.org_id,
  o.stage,
  count(*)::int                                   as deal_count,
  coalesce(sum(o.amount), 0)                      as total_amount,
  coalesce(sum(o.amount * o.probability / 100.0), 0) as weighted_amount
from public.opportunities o
group by o.org_id, o.stage;

create view public.lead_funnel with (security_invoker = true) as
select l.org_id, l.status, count(*)::int as lead_count
from public.leads l
group by l.org_id, l.status;

create view public.cases_by_status with (security_invoker = true) as
select c.org_id, c.status, c.priority, count(*)::int as case_count
from public.cases c
group by c.org_id, c.status, c.priority;

create view public.monthly_closed_won with (security_invoker = true) as
select
  o.org_id,
  date_trunc('month', o.close_date)::date as month,
  count(*)::int                           as deal_count,
  coalesce(sum(o.amount), 0)              as total_amount
from public.opportunities o
where o.is_won
group by o.org_id, date_trunc('month', o.close_date);

-- ---------------------------------------------------------------------
-- Demo data for a new organization
-- ---------------------------------------------------------------------
create or replace function private.seed_demo_data(_org uuid, _owner uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; o6 uuid;
  p1 uuid; p2 uuid; p3 uuid;
  k1 uuid; k2 uuid;
  l1 uuid; l2 uuid; l3 uuid;
  s1 uuid;
begin
  -- Products
  insert into public.products (org_id, owner_id, name, product_code, family, unit_price, description)
  values (_org, _owner, 'Sales Cloud Starter', 'SC-START', 'Licenses', 300, 'Per-seat annual licence')
  returning id into p1;
  insert into public.products (org_id, owner_id, name, product_code, family, unit_price, description)
  values (_org, _owner, 'Sales Cloud Enterprise', 'SC-ENT', 'Licenses', 1980, 'Per-seat annual licence, enterprise tier')
  returning id into p2;
  insert into public.products (org_id, owner_id, name, product_code, family, unit_price, description)
  values (_org, _owner, 'Implementation Services', 'SVC-IMPL', 'Services', 15000, 'Fixed-fee onboarding package')
  returning id into p3;

  -- Campaigns
  insert into public.campaigns (org_id, owner_id, name, type, status, start_date, end_date, budgeted_cost, actual_cost, expected_revenue)
  values (_org, _owner, 'Retail Innovation Summit', 'Event', 'In Progress', current_date - 20, current_date + 10, 25000, 18000, 250000)
  returning id into k1;
  insert into public.campaigns (org_id, owner_id, name, type, status, start_date, end_date, budgeted_cost, expected_revenue)
  values (_org, _owner, 'Q1 Email Nurture', 'Email', 'Planned', current_date + 15, current_date + 75, 5000, 80000)
  returning id into k2;

  -- Accounts
  insert into public.accounts (org_id, owner_id, name, type, industry, website, phone, annual_revenue, employees, billing_city, billing_country, description)
  values (_org, _owner, 'Acme Retail Group', 'Customer', 'Retail', 'https://acme.example.com', '+65 6123 4567', 120000000, 850, 'Singapore', 'Singapore', 'Regional omnichannel retailer with 40 stores.')
  returning id into a1;
  insert into public.accounts (org_id, owner_id, name, type, industry, website, phone, annual_revenue, employees, billing_city, billing_country)
  values (_org, _owner, 'Globex Foods', 'Prospect', 'Food & Beverage', 'https://globex.example.com', '+65 6234 5678', 45000000, 320, 'Singapore', 'Singapore')
  returning id into a2;
  insert into public.accounts (org_id, owner_id, name, type, industry, website, phone, annual_revenue, employees, billing_city, billing_country)
  values (_org, _owner, 'Initech Logistics', 'Customer', 'Logistics', 'https://initech.example.com', '+60 3 2345 6789', 78000000, 1200, 'Kuala Lumpur', 'Malaysia')
  returning id into a3;
  insert into public.accounts (org_id, owner_id, name, type, industry, website, phone, annual_revenue, employees, billing_city, billing_country)
  values (_org, _owner, 'Umbrella Pharmacy', 'Prospect', 'Healthcare', 'https://umbrella.example.com', '+65 6345 6789', 30000000, 210, 'Singapore', 'Singapore')
  returning id into a4;
  insert into public.accounts (org_id, owner_id, name, type, industry, website, billing_city, billing_country)
  values (_org, _owner, 'Stark Partners', 'Partner', 'Consulting', 'https://stark.example.com', 'Jakarta', 'Indonesia')
  returning id into a5;

  -- Contacts
  insert into public.contacts (org_id, owner_id, account_id, first_name, last_name, title, email, phone, lead_source, mailing_city, mailing_country)
  values (_org, _owner, a1, 'Rachel', 'Tan', 'Chief Digital Officer', 'rachel.tan@acme.example.com', '+65 9123 4567', 'Event', 'Singapore', 'Singapore')
  returning id into c1;
  insert into public.contacts (org_id, owner_id, account_id, first_name, last_name, title, email, phone, lead_source, mailing_city, mailing_country)
  values (_org, _owner, a1, 'Marcus', 'Lim', 'Head of Procurement', 'marcus.lim@acme.example.com', '+65 9234 5678', 'Referral', 'Singapore', 'Singapore')
  returning id into c2;
  insert into public.contacts (org_id, owner_id, account_id, first_name, last_name, title, email, phone, lead_source, mailing_city, mailing_country)
  values (_org, _owner, a2, 'Priya', 'Nair', 'VP Operations', 'priya.nair@globex.example.com', '+65 9345 6789', 'Web', 'Singapore', 'Singapore')
  returning id into c3;
  insert into public.contacts (org_id, owner_id, account_id, first_name, last_name, title, email, phone, lead_source, mailing_city, mailing_country)
  values (_org, _owner, a3, 'Ahmad', 'Rahman', 'IT Director', 'ahmad.rahman@initech.example.com', '+60 12 345 6789', 'Partner', 'Kuala Lumpur', 'Malaysia')
  returning id into c4;
  insert into public.contacts (org_id, owner_id, account_id, first_name, last_name, title, email, phone, lead_source, mailing_city, mailing_country)
  values (_org, _owner, a4, 'Sarah', 'Goh', 'Managing Director', 'sarah.goh@umbrella.example.com', '+65 9456 7890', 'Cold Call', 'Singapore', 'Singapore')
  returning id into c5;

  -- Opportunities
  insert into public.opportunities (org_id, owner_id, name, account_id, contact_id, campaign_id, stage, close_date, type, lead_source, next_step)
  values (_org, _owner, 'Acme - Enterprise Rollout', a1, c1, k1, 'Negotiation', current_date + 14, 'Existing Business', 'Event', 'Final pricing review with procurement')
  returning id into o1;
  insert into public.opportunities (org_id, owner_id, name, account_id, contact_id, stage, amount, close_date, type, lead_source, next_step)
  values (_org, _owner, 'Globex - Starter Pilot', a2, c3, 'Proposal', 36000, current_date + 30, 'New Business', 'Web', 'Send proposal deck')
  returning id into o2;
  insert into public.opportunities (org_id, owner_id, name, account_id, contact_id, stage, amount, close_date, type, lead_source)
  values (_org, _owner, 'Initech - Renewal 2027', a3, c4, 'Closed Won', 142000, current_date - 10, 'Renewal', 'Partner')
  returning id into o3;
  insert into public.opportunities (org_id, owner_id, name, account_id, contact_id, stage, amount, close_date, type, lead_source, next_step)
  values (_org, _owner, 'Umbrella - Discovery', a4, c5, 'Qualification', 60000, current_date + 45, 'New Business', 'Cold Call', 'Book discovery workshop')
  returning id into o4;
  insert into public.opportunities (org_id, owner_id, name, account_id, stage, amount, close_date, type)
  values (_org, _owner, 'Initech - Warehouse Add-on', a3, 'Needs Analysis', 48000, current_date + 60, 'Existing Business')
  returning id into o5;
  insert into public.opportunities (org_id, owner_id, name, account_id, stage, amount, close_date, type)
  values (_org, _owner, 'Globex - Analytics', a2, 'Closed Lost', 25000, current_date - 25, 'New Business')
  returning id into o6;

  -- Line items (Acme amount rolls up automatically)
  insert into public.opportunity_line_items (org_id, owner_id, opportunity_id, product_id, quantity, unit_price, discount_pct)
  values (_org, _owner, o1, p2, 120, 1980, 10),
         (_org, _owner, o1, p3, 1, 15000, 0);

  -- Leads
  insert into public.leads (org_id, owner_id, first_name, last_name, company, title, email, phone, status, rating, lead_source, industry, city, country, campaign_id)
  values (_org, _owner, 'Daniel', 'Wong', 'Wayne Department Stores', 'COO', 'daniel.wong@wayne.example.com', '+65 9567 8901', 'Working', 'Hot', 'Event', 'Retail', 'Singapore', 'Singapore', k1)
  returning id into l1;
  insert into public.leads (org_id, owner_id, first_name, last_name, company, title, email, status, rating, lead_source, industry, city, country)
  values (_org, _owner, 'Mei Ling', 'Chua', 'Oceanic Apparel', 'E-commerce Lead', 'meiling@oceanic.example.com', 'New', 'Warm', 'Web', 'Fashion', 'Singapore', 'Singapore')
  returning id into l2;
  insert into public.leads (org_id, owner_id, first_name, last_name, company, title, email, status, rating, lead_source, industry, city, country)
  values (_org, _owner, 'Kenji', 'Sato', 'Hooli Electronics', 'Store Ops Manager', 'kenji.sato@hooli.example.com', 'Nurturing', 'Cold', 'Advertisement', 'Electronics', 'Tokyo', 'Japan')
  returning id into l3;
  insert into public.leads (org_id, owner_id, first_name, last_name, company, title, status, rating, lead_source, industry, city, country)
  values (_org, _owner, 'Aisha', 'Binte Ali', 'Soylent Grocers', 'Founder', 'Qualified', 'Hot', 'Referral', 'Grocery', 'Singapore', 'Singapore');

  insert into public.campaign_members (org_id, owner_id, campaign_id, lead_id, status) values (_org, _owner, k1, l1, 'Attended');
  insert into public.campaign_members (org_id, owner_id, campaign_id, contact_id, status) values (_org, _owner, k1, c1, 'Responded');

  -- Cases
  insert into public.cases (org_id, owner_id, subject, account_id, contact_id, status, priority, origin, type, description)
  values (_org, _owner, 'Unable to sync POS data', a1, c2, 'Working', 'High', 'Email', 'Problem', 'Nightly sync from store POS fails for 3 outlets.')
  returning id into s1;
  insert into public.cases (org_id, owner_id, subject, account_id, contact_id, status, priority, origin, type)
  values (_org, _owner, 'Request for additional user licences', a3, c4, 'New', 'Medium', 'Web', 'Question'),
         (_org, _owner, 'Report export timing out', a3, c4, 'Escalated', 'Critical', 'Phone', 'Problem'),
         (_org, _owner, 'Password reset not received', a1, c1, 'Closed', 'Low', 'Chat', 'Problem');

  -- Activities
  insert into public.activities (org_id, owner_id, type, subject, status, priority, due_date, opportunity_id, account_id, contact_id)
  values (_org, _owner, 'Call', 'Pricing call with Marcus', 'Not Started', 'High', current_date + 1, o1, a1, c2),
         (_org, _owner, 'Email', 'Send proposal to Priya', 'Not Started', 'Normal', current_date + 3, o2, a2, c3),
         (_org, _owner, 'Meeting', 'Quarterly business review', 'Completed', 'Normal', current_date - 7, o3, a3, c4),
         (_org, _owner, 'Task', 'Prepare discovery agenda', 'In Progress', 'Normal', current_date, o4, a4, c5);
  insert into public.activities (org_id, owner_id, type, subject, status, priority, due_date, lead_id)
  values (_org, _owner, 'Call', 'Follow up after summit', 'Not Started', 'High', current_date + 2, l1);
  insert into public.activities (org_id, owner_id, type, subject, status, priority, due_date, case_id, account_id)
  values (_org, _owner, 'Task', 'Check POS connector logs', 'In Progress', 'High', current_date, s1, a1);

  -- Notes
  insert into public.notes (org_id, owner_id, title, body, opportunity_id, account_id)
  values (_org, _owner, 'Procurement feedback', 'Marcus wants a 3-year price lock. Legal reviewing MSA redlines.', o1, a1);
end;
$$;

-- ---------------------------------------------------------------------
-- New user onboarding: profile + organization + demo data
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  new_org  uuid;
  v_name   text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  v_company text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'company'), ''), v_name || '''s Company');
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, v_name, new.email);

  insert into public.organizations (name) values (left(v_company, 200)) returning id into new_org;
  insert into public.organization_members (org_id, user_id, role) values (new_org, new.id, 'admin');
  update public.profiles set default_org_id = new_org where id = new.id;

  if coalesce((new.raw_user_meta_data ->> 'seed_demo')::boolean, true) then
    begin
      perform private.seed_demo_data(new_org, new.id);
    exception when others then
      raise warning 'Demo data seeding failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- API grants: anon gets nothing, authenticated goes through RLS
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.convert_lead(uuid, uuid, boolean, text)  to authenticated;
grant execute on function public.global_search(text, integer)             to authenticated;
grant execute on function public.set_active_org(uuid)                     to authenticated;
grant execute on function public.create_organization(text, boolean)       to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on function private.user_org_ids()   to authenticated;
grant execute on function private.admin_org_ids()  to authenticated;
grant execute on function private.current_org_id() to authenticated;
