-- =====================================================================
-- Salesforce clone: core schema
-- Multi-tenant CRM. Every business record belongs to an organization
-- (org_id) and Row Level Security limits access to that org's members.
-- =====================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Enums (Salesforce-style picklists)
-- ---------------------------------------------------------------------
create type public.org_role               as enum ('admin', 'manager', 'user');
create type public.account_type           as enum ('Prospect', 'Customer', 'Partner', 'Competitor', 'Other');
create type public.lead_source            as enum ('Web', 'Referral', 'Event', 'Partner', 'Advertisement', 'Cold Call', 'Other');
create type public.lead_status            as enum ('New', 'Working', 'Nurturing', 'Qualified', 'Unqualified', 'Converted');
create type public.lead_rating            as enum ('Hot', 'Warm', 'Cold');
create type public.opportunity_stage      as enum ('Prospecting', 'Qualification', 'Needs Analysis', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost');
create type public.opportunity_type       as enum ('New Business', 'Existing Business', 'Renewal');
create type public.case_status            as enum ('New', 'Working', 'Escalated', 'Closed');
create type public.case_priority          as enum ('Low', 'Medium', 'High', 'Critical');
create type public.case_origin            as enum ('Email', 'Phone', 'Web', 'Chat');
create type public.activity_type          as enum ('Task', 'Call', 'Email', 'Meeting');
create type public.activity_status        as enum ('Not Started', 'In Progress', 'Completed', 'Deferred');
create type public.activity_priority      as enum ('Low', 'Normal', 'High');
create type public.campaign_type          as enum ('Email', 'Event', 'Webinar', 'Advertisement', 'Social', 'Other');
create type public.campaign_status        as enum ('Planned', 'In Progress', 'Completed', 'Aborted');
create type public.campaign_member_status as enum ('Sent', 'Responded', 'Attended');

-- ---------------------------------------------------------------------
-- Tenancy: organizations, profiles, memberships
-- ---------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  currency    text not null default 'SGD',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text,
  email           text,
  title           text,
  avatar_url      text,
  default_org_id  uuid references public.organizations (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_default_org_id_idx on public.profiles (default_org_id);

create table public.organization_members (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.org_role not null default 'user',
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members (user_id);

-- ---------------------------------------------------------------------
-- Security helpers (private schema is not exposed through the API)
-- ---------------------------------------------------------------------
create or replace function private.user_org_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.org_id from public.organization_members m where m.user_id = (select auth.uid());
$$;

create or replace function private.admin_org_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.org_id from public.organization_members m
  where m.user_id = (select auth.uid()) and m.role = 'admin';
$$;

-- Org new records default to: the user's selected org
create or replace function private.current_org_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.default_org_id from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

grant execute on function private.user_org_ids()   to authenticated;
grant execute on function private.admin_org_ids()  to authenticated;
grant execute on function private.current_org_id() to authenticated;

-- ---------------------------------------------------------------------
-- CRM objects
-- Common columns: id, org_id, owner_id, created_at, updated_at
-- ---------------------------------------------------------------------
create table public.accounts (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id             uuid default auth.uid() references public.profiles (id) on delete set null,
  name                 text not null check (char_length(name) between 1 and 255),
  type                 public.account_type default 'Prospect',
  industry             text,
  website              text,
  phone                text,
  annual_revenue       numeric(18, 2),
  employees            integer check (employees >= 0),
  parent_account_id    uuid references public.accounts (id) on delete set null,
  billing_street       text,
  billing_city         text,
  billing_state        text,
  billing_postal_code  text,
  billing_country      text,
  description          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.contacts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id         uuid default auth.uid() references public.profiles (id) on delete set null,
  account_id       uuid references public.accounts (id) on delete set null,
  salutation       text,
  first_name       text,
  last_name        text not null check (char_length(last_name) between 1 and 120),
  title            text,
  department       text,
  email            text,
  phone            text,
  mobile           text,
  lead_source      public.lead_source,
  mailing_street   text,
  mailing_city     text,
  mailing_country  text,
  birthdate        date,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.campaigns (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id          uuid default auth.uid() references public.profiles (id) on delete set null,
  name              text not null check (char_length(name) between 1 and 255),
  type              public.campaign_type default 'Email',
  status            public.campaign_status not null default 'Planned',
  start_date        date,
  end_date          date,
  budgeted_cost     numeric(18, 2),
  actual_cost       numeric(18, 2),
  expected_revenue  numeric(18, 2),
  description       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.leads (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id                  uuid default auth.uid() references public.profiles (id) on delete set null,
  salutation                text,
  first_name                text,
  last_name                 text not null check (char_length(last_name) between 1 and 120),
  company                   text not null check (char_length(company) between 1 and 255),
  title                     text,
  email                     text,
  phone                     text,
  status                    public.lead_status not null default 'New',
  rating                    public.lead_rating,
  lead_source               public.lead_source,
  industry                  text,
  annual_revenue            numeric(18, 2),
  employees                 integer check (employees >= 0),
  city                      text,
  country                   text,
  campaign_id               uuid references public.campaigns (id) on delete set null,
  description               text,
  converted_at              timestamptz,
  converted_account_id      uuid references public.accounts (id) on delete set null,
  converted_contact_id      uuid references public.contacts (id) on delete set null,
  converted_opportunity_id  uuid,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table public.opportunities (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  name         text not null check (char_length(name) between 1 and 255),
  account_id   uuid references public.accounts (id) on delete set null,
  contact_id   uuid references public.contacts (id) on delete set null,
  campaign_id  uuid references public.campaigns (id) on delete set null,
  stage        public.opportunity_stage not null default 'Prospecting',
  amount       numeric(18, 2) check (amount >= 0),
  probability  integer check (probability between 0 and 100),
  close_date   date not null default (current_date + 30),
  type         public.opportunity_type default 'New Business',
  lead_source  public.lead_source,
  next_step    text,
  description  text,
  is_closed    boolean not null default false,
  is_won       boolean not null default false,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.leads
  add constraint leads_converted_opportunity_id_fkey
  foreign key (converted_opportunity_id) references public.opportunities (id) on delete set null;

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id      uuid default auth.uid() references public.profiles (id) on delete set null,
  name          text not null check (char_length(name) between 1 and 255),
  product_code  text,
  family        text,
  unit_price    numeric(18, 2) not null default 0 check (unit_price >= 0),
  is_active     boolean not null default true,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, product_code)
);

create table public.opportunity_line_items (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id        uuid default auth.uid() references public.profiles (id) on delete set null,
  opportunity_id  uuid not null references public.opportunities (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete restrict,
  quantity        numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price      numeric(18, 2) not null check (unit_price >= 0),
  discount_pct    numeric(5, 2) not null default 0 check (discount_pct between 0 and 100),
  total_price     numeric(18, 2) generated always as (round(quantity * unit_price * (1 - discount_pct / 100), 2)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.cases (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  case_number  bigint generated always as identity (start with 1001) unique,
  subject      text not null check (char_length(subject) between 1 and 255),
  account_id   uuid references public.accounts (id) on delete set null,
  contact_id   uuid references public.contacts (id) on delete set null,
  status       public.case_status not null default 'New',
  priority     public.case_priority not null default 'Medium',
  origin       public.case_origin default 'Email',
  type         text,
  description  text,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.campaign_members (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  lead_id      uuid references public.leads (id) on delete cascade,
  contact_id   uuid references public.contacts (id) on delete cascade,
  status       public.campaign_member_status not null default 'Sent',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((lead_id is null) <> (contact_id is null))
);
create unique index campaign_members_lead_uniq    on public.campaign_members (campaign_id, lead_id)    where lead_id is not null;
create unique index campaign_members_contact_uniq on public.campaign_members (campaign_id, contact_id) where contact_id is not null;

-- Activities = Salesforce Tasks + Events.
-- "Who" (lead or contact) and "What" (account, opportunity, case, campaign).
create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id        uuid default auth.uid() references public.profiles (id) on delete set null,
  type            public.activity_type not null default 'Task',
  subject         text not null check (char_length(subject) between 1 and 255),
  status          public.activity_status not null default 'Not Started',
  priority        public.activity_priority not null default 'Normal',
  due_date        date,
  start_at        timestamptz,
  end_at          timestamptz,
  description     text,
  completed_at    timestamptz,
  lead_id         uuid references public.leads (id) on delete cascade,
  contact_id      uuid references public.contacts (id) on delete cascade,
  account_id      uuid references public.accounts (id) on delete cascade,
  opportunity_id  uuid references public.opportunities (id) on delete cascade,
  case_id         uuid references public.cases (id) on delete cascade,
  campaign_id     uuid references public.campaigns (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at >= start_at)
);

create table public.notes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default private.current_org_id() references public.organizations (id) on delete cascade,
  owner_id        uuid default auth.uid() references public.profiles (id) on delete set null,
  title           text not null check (char_length(title) between 1 and 255),
  body            text,
  lead_id         uuid references public.leads (id) on delete cascade,
  contact_id      uuid references public.contacts (id) on delete cascade,
  account_id      uuid references public.accounts (id) on delete cascade,
  opportunity_id  uuid references public.opportunities (id) on delete cascade,
  case_id         uuid references public.cases (id) on delete cascade,
  campaign_id     uuid references public.campaigns (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes: tenancy, ownership, foreign keys and common sorts
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'contacts', 'campaigns', 'leads', 'opportunities', 'products',
    'opportunity_line_items', 'cases', 'campaign_members', 'activities', 'notes'
  ] loop
    execute format('create index %1$s_org_created_idx on public.%1$s (org_id, created_at desc)', t);
    execute format('create index %1$s_owner_id_idx on public.%1$s (owner_id)', t);
  end loop;
end $$;

create index accounts_parent_account_id_idx          on public.accounts (parent_account_id);
create index accounts_org_name_idx                    on public.accounts (org_id, name);
create index contacts_account_id_idx                  on public.contacts (account_id);
create index contacts_org_last_name_idx               on public.contacts (org_id, last_name);
create index leads_campaign_id_idx                    on public.leads (campaign_id);
create index leads_org_status_idx                     on public.leads (org_id, status);
create index leads_converted_account_id_idx           on public.leads (converted_account_id);
create index leads_converted_contact_id_idx           on public.leads (converted_contact_id);
create index leads_converted_opportunity_id_idx       on public.leads (converted_opportunity_id);
create index opportunities_account_id_idx             on public.opportunities (account_id);
create index opportunities_contact_id_idx             on public.opportunities (contact_id);
create index opportunities_campaign_id_idx            on public.opportunities (campaign_id);
create index opportunities_org_stage_idx              on public.opportunities (org_id, stage);
create index opportunities_org_close_date_idx         on public.opportunities (org_id, close_date);
create index opportunity_line_items_opportunity_idx   on public.opportunity_line_items (opportunity_id);
create index opportunity_line_items_product_idx       on public.opportunity_line_items (product_id);
create index cases_account_id_idx                     on public.cases (account_id);
create index cases_contact_id_idx                     on public.cases (contact_id);
create index cases_org_status_idx                     on public.cases (org_id, status);
create index campaign_members_lead_id_idx             on public.campaign_members (lead_id);
create index campaign_members_contact_id_idx          on public.campaign_members (contact_id);
create index activities_lead_id_idx                   on public.activities (lead_id);
create index activities_contact_id_idx                on public.activities (contact_id);
create index activities_account_id_idx                on public.activities (account_id);
create index activities_opportunity_id_idx            on public.activities (opportunity_id);
create index activities_case_id_idx                   on public.activities (case_id);
create index activities_campaign_id_idx               on public.activities (campaign_id);
create index activities_owner_due_idx                 on public.activities (owner_id, status, due_date);
create index notes_lead_id_idx                        on public.notes (lead_id);
create index notes_contact_id_idx                     on public.notes (contact_id);
create index notes_account_id_idx                     on public.notes (account_id);
create index notes_opportunity_id_idx                 on public.notes (opportunity_id);
create index notes_case_id_idx                        on public.notes (case_id);
create index notes_campaign_id_idx                    on public.notes (campaign_id);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'accounts', 'contacts', 'campaigns', 'leads', 'opportunities',
    'products', 'opportunity_line_items', 'cases', 'campaign_members', 'activities', 'notes'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;
