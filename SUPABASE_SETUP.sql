-- Jalankan file ini di Supabase SQL Editor.
-- Setelah itu buat 1 user admin di Supabase Auth, lalu matikan public signup supaya orang lain tidak bisa daftar sendiri.
-- File ini aman untuk setup baru atau migrasi dari versi Codexa sebelumnya.

create extension if not exists pgcrypto;

-- 1) Table untuk brief dari form kontak
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_type text not null,
  message text not null,
  source text default 'codexa-portfolio',
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

drop policy if exists "Anyone can send leads" on public.leads;
create policy "Anyone can send leads"
on public.leads
for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated can read leads" on public.leads;
create policy "Authenticated can read leads"
on public.leads
for select
to authenticated
using (true);

-- 2) Table kategori project, supaya kategori bisa ditambah dari dashboard admin
create table if not exists public.project_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Table project portfolio
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'website',
  short_description text not null,
  subtitle text not null,
  features text[] not null default '{}',
  note text,
  image_url text,
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migrasi dari versi lama: hapus batas kategori website/dashboard/uiux agar kategori custom bisa dipakai.
alter table public.portfolio_projects drop constraint if exists portfolio_projects_category_check;

-- Kolom baru untuk multi foto dan pilihan tampilan desktop/mobile.
alter table public.portfolio_projects add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.portfolio_projects add column if not exists display_device text not null default 'desktop';
alter table public.portfolio_projects drop constraint if exists portfolio_projects_display_device_check;
alter table public.portfolio_projects add constraint portfolio_projects_display_device_check check (display_device in ('desktop', 'mobile'));

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_portfolio_projects_updated_at on public.portfolio_projects;
create trigger set_portfolio_projects_updated_at
before update on public.portfolio_projects
for each row execute function public.set_updated_at();

drop trigger if exists set_project_categories_updated_at on public.project_categories;
create trigger set_project_categories_updated_at
before update on public.project_categories
for each row execute function public.set_updated_at();

-- Pindahkan image_url lama ke media supaya project lama tetap muncul sebagai carousel.
update public.portfolio_projects
set media = jsonb_build_array(jsonb_build_object(
  'url', image_url,
  'path', coalesce(image_path, ''),
  'device', display_device,
  'name', coalesce(title, 'Foto project')
))
where jsonb_array_length(media) = 0
  and image_url is not null
  and image_url <> '';

alter table public.project_categories enable row level security;
alter table public.portfolio_projects enable row level security;

-- Policies kategori
drop policy if exists "Public can read active categories" on public.project_categories;
create policy "Public can read active categories"
on public.project_categories
for select
to anon, authenticated
using (is_active = true or auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage categories" on public.project_categories;
create policy "Authenticated can manage categories"
on public.project_categories
for all
to authenticated
using (true)
with check (true);

-- Policies project
drop policy if exists "Public can read active projects" on public.portfolio_projects;
create policy "Public can read active projects"
on public.portfolio_projects
for select
to anon, authenticated
using (is_active = true or auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage projects" on public.portfolio_projects;
create policy "Authenticated can manage projects"
on public.portfolio_projects
for all
to authenticated
using (true)
with check (true);

-- 4) Storage bucket untuk foto project
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'codexa-projects',
  'codexa-projects',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read codexa project images" on storage.objects;
create policy "Public can read codexa project images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'codexa-projects');

drop policy if exists "Authenticated can upload codexa project images" on storage.objects;
create policy "Authenticated can upload codexa project images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'codexa-projects');

drop policy if exists "Authenticated can update codexa project images" on storage.objects;
create policy "Authenticated can update codexa project images"
on storage.objects
for update
to authenticated
using (bucket_id = 'codexa-projects')
with check (bucket_id = 'codexa-projects');

drop policy if exists "Authenticated can delete codexa project images" on storage.objects;
create policy "Authenticated can delete codexa project images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'codexa-projects');

-- 5) Data awal kategori
insert into public.project_categories (name, slug, sort_order, is_active)
values
  ('Website', 'website', 1, true),
  ('Dashboard', 'dashboard', 2, true),
  ('UI/UX', 'uiux', 3, true)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- 6) Contoh data awal. Boleh dihapus kalau tidak perlu.
insert into public.portfolio_projects
(title, category, short_description, subtitle, features, note, sort_order, is_active, display_device)
select 'LuxeStay Booking Hotel', 'website', 'Flow booking hotel dengan tampilan mobile yang bersih.', 'Konsep website booking hotel dengan flow customer yang lebih ringkas.', array['Cari kamar dan lihat detail', 'Booking mobile-friendly', 'Status pembayaran lebih jelas', 'CTA login dan WhatsApp'], 'Project ini cocok untuk memperlihatkan kemampuan membuat sistem pemesanan yang tidak membingungkan customer.', 1, true, 'desktop'
where not exists (select 1 from public.portfolio_projects where title = 'LuxeStay Booking Hotel');

insert into public.portfolio_projects
(title, category, short_description, subtitle, features, note, sort_order, is_active, display_device)
select 'Dabsen Admin Panel', 'dashboard', 'Dashboard ringkas untuk data dan monitoring.', 'Dashboard absensi untuk melihat data kehadiran dan status aktivitas.', array['Statistik ringkas', 'Table kehadiran', 'Status online/offline', 'Tampilan admin responsive'], 'Cocok untuk menunjukkan kemampuan membuat dashboard fungsional tanpa terlihat penuh.', 2, true, 'desktop'
where not exists (select 1 from public.portfolio_projects where title = 'Dabsen Admin Panel');
