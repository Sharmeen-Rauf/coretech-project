-- CoreTECH Database Schema Extensions for Phase 2 Web Portal

-- 1. Expenses Table (Employee submits, Admin/Approver reviews)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric not null,
  category text not null,
  date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  description text,
  created_at timestamptz default now()
);

-- 2. Gate Passes Table (Employee/Admin issues, driver/vehicle details)
create table if not exists public.gate_passes (
  id uuid primary key default gen_random_uuid(),
  pass_code text not null unique,
  order_id uuid references public.orders(id) on delete cascade,
  issued_by uuid references public.profiles(id) on delete cascade,
  driver_name text not null,
  vehicle_no text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- 3. Invoices/Payments Table (Linked to orders, tracks payment state)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_code text not null unique,
  order_id uuid references public.orders(id) on delete cascade,
  distributor_id uuid references public.profiles(id) on delete cascade,
  amount numeric not null,
  due_date date not null,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  created_at timestamptz default now()
);

-- 4. Support Tickets Table (Consignment support and inquiries)
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  created_at timestamptz default now()
);

-- 5. Activity Logs Table (System audit trails)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.expenses enable row level security;
alter table public.gate_passes enable row level security;
alter table public.invoices enable row level security;
alter table public.support_tickets enable row level security;
alter table public.activity_logs enable row level security;

-- Policies (Simplified policies for authentication context)
-- Expenses
create policy "Allow read access to auth" on public.expenses for select using (true);
create policy "Allow insert access to auth" on public.expenses for insert with check (true);
create policy "Allow update access to auth" on public.expenses for update using (true);

-- Gate Passes
create policy "Allow read access to auth" on public.gate_passes for select using (true);
create policy "Allow insert access to auth" on public.gate_passes for insert with check (true);
create policy "Allow update access to auth" on public.gate_passes for update using (true);

-- Invoices
create policy "Allow read access to auth" on public.invoices for select using (true);
create policy "Allow insert access to auth" on public.invoices for insert with check (true);
create policy "Allow update access to auth" on public.invoices for update using (true);

-- Support Tickets
create policy "Allow read access to auth" on public.support_tickets for select using (true);
create policy "Allow insert access to auth" on public.support_tickets for insert with check (true);
create policy "Allow update access to auth" on public.support_tickets for update using (true);

-- Activity Logs
create policy "Allow read access to auth" on public.activity_logs for select using (true);
create policy "Allow read access to auth" on public.activity_logs for select using (true);
create policy "Allow insert access to auth" on public.activity_logs for insert with check (true);

-- 6. Regions Table
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  region_code text not null unique,
  name text not null,
  warehouse text not null,
  distributors integer default 0,
  sub_dealers integer default 0,
  status text not null default 'active',
  created_at timestamptz default now()
);

alter table public.regions enable row level security;
create policy "Allow read access to auth" on public.regions for select using (true);
create policy "Allow insert access to auth" on public.regions for insert with check (true);
create policy "Allow update access to auth" on public.regions for update using (true);

-- 7. Announcements / Broadcasts Table
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  role_target text not null default 'all', -- 'all', 'employee', 'distributor', 'sub_dealer', 'installer'
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;
create policy "Allow read access to auth" on public.announcements for select using (true);
create policy "Allow insert access to auth" on public.announcements for insert with check (true);
create policy "Allow update access to auth" on public.announcements for update using (true);

-- Append columns to installer_jobs for job details
ALTER TABLE public.installer_jobs ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE public.installer_jobs ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.installer_jobs ADD COLUMN IF NOT EXISTS incentive numeric;


