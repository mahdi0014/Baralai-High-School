-- =====================================================================
-- BARALAI HIGH SCHOOL - COMPLETE UPDATED SUPABASE SQL SCHEMA
-- Project: Baralai High School Admin/Public System
-- Version: 2026-05-18 Clean Deployment Schema
--
-- This script is safe for an existing Supabase project:
-- - Creates tables if missing
-- - Adds/updates missing columns using ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- - Replaces existing functions with CREATE OR REPLACE FUNCTION
-- - Recreates RLS policies
-- - Adds indexes and constraints where possible
-- - Seeds classes, academic years, and class/group-wise subjects
-- =====================================================================

-- =====================================================================
-- 01. EXTENSIONS
-- =====================================================================
create extension if not exists "pgcrypto";


-- =====================================================================
-- 02. COMMON UPDATED_AT TRIGGER FUNCTION
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =====================================================================
-- 03. BASE TABLES - CREATE IF MISSING
-- =====================================================================

create table if not exists public.school_settings (
  id uuid primary key default gen_random_uuid(),
  school_name text not null default 'Baralai High School',
  school_email text,
  school_phone text,
  school_address text,
  principal_name text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  year_name text not null unique,
  is_current boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  class_name text not null unique,
  display_name text not null,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text,
  name text not null,
  roll text not null,
  class_name text not null,
  section_name text not null default 'General',
  academic_year text not null,
  guardian_name text,
  phone text,
  address text,
  religion text not null default 'Islam',
  optional_subject_name text,
  optional_subject_code text,
  status text not null default 'active',
  promotion_status text,
  promoted_from jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  teacher_code text not null unique,
  image_data_url text,
  name text not null,
  phone text not null unique,
  email text,
  subject text not null,
  designation text not null,
  qualification text,
  joining_date date,
  status text not null default 'Active',
  retired_date date,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  staff_code text not null unique,
  image_data_url text,
  name text not null,
  phone text not null unique,
  email text,
  designation text not null,
  qualification text,
  joining_date date,
  status text not null default 'Active',
  retired_date date,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  section_name text not null default 'General',
  subject_name text not null,
  subject_code text,
  subject_type text not null default 'compulsory',
  total_marks integer not null default 100,
  mcq_marks integer default 0,
  written_marks integer default 100,
  practical_marks integer default 0,
  sort_order integer default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  name_snapshot text not null,
  roll_snapshot text not null,
  class_name text not null,
  section_name text not null default 'General',
  academic_year text not null,
  exam_name text not null default 'Final Exam',
  subjects jsonb not null default '[]'::jsonb,
  marks jsonb not null default '{}'::jsonb,
  subject_grades jsonb not null default '{}'::jsonb,
  total_marks numeric not null default 0,
  average numeric not null default 0,
  gpa numeric not null default 0,
  total_point numeric not null default 0,
  ranking_score numeric not null default 0,
  final_grade text,
  completed_subjects integer not null default 0,
  total_subjects integer not null default 0,
  publish_status text not null default 'draft',
  is_published boolean not null default false,
  published_at timestamptz,
  last_edited_after_publish_at timestamptz,
  unpublished_at timestamptz,
  unpublished_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_promotions (
  id uuid primary key default gen_random_uuid(),
  from_student_id uuid references public.students(id) on delete set null,
  to_student_id uuid references public.students(id) on delete set null,
  result_id uuid references public.results(id) on delete set null,
  from_year text not null,
  from_class text not null,
  from_section text,
  to_year text not null,
  to_class text not null,
  to_section text,
  from_optional_subject text,
  to_optional_subject text,
  old_roll text,
  new_roll text,
  rank integer,
  total_marks numeric default 0,
  gpa numeric default 0,
  grade text,
  remarks text,
  status text not null default 'promoted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  notice_date date not null default current_date,
  status text not null default 'published',
  priority text not null default 'normal',
  is_important boolean not null default false,
  description text not null,
  attachment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  designation text not null default 'Administrator',
  role text not null default 'admin',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =====================================================================
-- 04. MIGRATION COLUMNS FOR EXISTING DATABASES
-- =====================================================================

alter table public.school_settings
  add column if not exists school_email text,
  add column if not exists school_phone text,
  add column if not exists school_address text,
  add column if not exists principal_name text,
  add column if not exists logo_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.academic_years
  add column if not exists is_current boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.classes
  add column if not exists display_name text,
  add column if not exists sort_order integer,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.classes
set display_name = coalesce(display_name, 'Class ' || class_name),
    sort_order = coalesce(sort_order, nullif(regexp_replace(class_name, '[^0-9]', '', 'g'), '')::integer, 0)
where display_name is null or sort_order is null;

alter table public.classes alter column display_name set not null;
alter table public.classes alter column sort_order set not null;

alter table public.students
  add column if not exists student_code text,
  add column if not exists section_name text not null default 'General',
  add column if not exists religion text not null default 'Islam',
  add column if not exists optional_subject_name text,
  add column if not exists optional_subject_code text,
  add column if not exists promotion_status text,
  add column if not exists promoted_from jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.students
set section_name = 'General'
where section_name is null or trim(section_name) = '';

update public.students
set religion = 'Islam'
where religion is null or trim(religion) = '';

alter table public.teachers
  add column if not exists image_data_url text,
  add column if not exists email text,
  add column if not exists qualification text,
  add column if not exists joining_date date,
  add column if not exists retired_date date,
  add column if not exists address text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.staff
  add column if not exists image_data_url text,
  add column if not exists email text,
  add column if not exists qualification text,
  add column if not exists joining_date date,
  add column if not exists retired_date date,
  add column if not exists address text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.subjects
  add column if not exists section_name text not null default 'General',
  add column if not exists subject_code text,
  add column if not exists subject_type text not null default 'compulsory',
  add column if not exists total_marks integer not null default 100,
  add column if not exists mcq_marks integer default 0,
  add column if not exists written_marks integer default 100,
  add column if not exists practical_marks integer default 0,
  add column if not exists sort_order integer default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.subjects
set section_name = 'General'
where section_name is null or trim(section_name) = '';

update public.subjects
set subject_type = 'compulsory'
where subject_type is null or trim(subject_type) = '';

alter table public.results
  add column if not exists section_name text not null default 'General',
  add column if not exists subject_grades jsonb not null default '{}'::jsonb,
  add column if not exists total_point numeric not null default 0,
  add column if not exists ranking_score numeric not null default 0,
  add column if not exists last_edited_after_publish_at timestamptz,
  add column if not exists unpublished_at timestamptz,
  add column if not exists unpublished_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.results r
set section_name = coalesce(nullif(s.section_name, ''), 'General')
from public.students s
where r.student_id = s.id
  and (r.section_name is null or trim(r.section_name) = '' or r.section_name = 'General');

update public.results
set ranking_score = coalesce(ranking_score, gpa, 0),
    total_point = coalesce(total_point, 0),
    subject_grades = coalesce(subject_grades, '{}'::jsonb)
where ranking_score is null or subject_grades is null or total_point is null;

alter table public.student_promotions
  add column if not exists from_section text,
  add column if not exists to_section text,
  add column if not exists from_optional_subject text,
  add column if not exists to_optional_subject text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.notices
  add column if not exists attachment jsonb,
  add column if not exists is_important boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.admin_profiles
  add column if not exists designation text not null default 'Administrator',
  add column if not exists role text not null default 'admin',
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();


-- =====================================================================
-- 05. DATA NORMALIZATION BEFORE CONSTRAINTS
-- =====================================================================

update public.students
set
  section_name = case
    when class_name in ('6','7','8') then 'General'
    when class_name in ('9','10') and section_name not in ('Science','Arts','Commerce') then section_name
    else coalesce(nullif(section_name, ''), 'General')
  end,
  religion = case
    when religion ilike 'hindu%' then 'Hindu'
    else 'Islam'
  end;

update public.teachers set status = 'Active' where status is null or status not in ('Active','Retired');
update public.staff set status = 'Active' where status is null or status not in ('Active','Retired');
update public.notices set status = 'published' where status is null or status not in ('published','draft');
update public.notices set priority = 'normal' where priority is null or priority not in ('normal','important');
update public.results set publish_status = 'draft' where publish_status is null or publish_status not in ('draft','published');
update public.admin_profiles set role = 'admin' where role is null or role not in ('super_admin','admin','editor');
update public.admin_profiles set status = 'active' where status is null or status not in ('active','inactive');
update public.subjects set subject_type = 'compulsory' where subject_type is null or subject_type not in ('compulsory','religion','group_required','optional_4th','non_gpa');

-- Deduplicate subjects so the class + section + subject ON CONFLICT works.
with ranked_subjects as (
  select id,
         row_number() over (
           partition by class_name, section_name, subject_name
           order by updated_at desc nulls last, created_at desc nulls last, id desc
         ) as rn
  from public.subjects
)
delete from public.subjects s
using ranked_subjects r
where s.id = r.id and r.rn > 1;

-- Deduplicate results so the result upsert conflict key works.
with ranked_results as (
  select id,
         row_number() over (
           partition by student_id, academic_year, class_name, exam_name
           order by updated_at desc nulls last, created_at desc nulls last, id desc
         ) as rn
  from public.results
  where student_id is not null
)
delete from public.results r
using ranked_results d
where r.id = d.id and d.rn > 1;


-- =====================================================================
-- 06. CONSTRAINTS
-- =====================================================================

do $$
begin
  alter table public.students drop constraint if exists students_status_check;
  alter table public.students add constraint students_status_check
    check (status in ('active','inactive','transferred','promoted','graduated'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.students drop constraint if exists students_religion_check;
  alter table public.students add constraint students_religion_check
    check (religion in ('Islam','Hindu'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.teachers drop constraint if exists teachers_status_check;
  alter table public.teachers add constraint teachers_status_check
    check (status in ('Active','Retired'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.staff drop constraint if exists staff_status_check;
  alter table public.staff add constraint staff_status_check
    check (status in ('Active','Retired'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.subjects drop constraint if exists subjects_type_check;
  alter table public.subjects add constraint subjects_type_check
    check (subject_type in ('compulsory','religion','group_required','optional_4th','non_gpa'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.results drop constraint if exists results_publish_status_check;
  alter table public.results add constraint results_publish_status_check
    check (publish_status in ('draft','published'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.notices drop constraint if exists notices_status_check;
  alter table public.notices add constraint notices_status_check
    check (status in ('published','draft'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.notices drop constraint if exists notices_priority_check;
  alter table public.notices add constraint notices_priority_check
    check (priority in ('normal','important'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.admin_profiles drop constraint if exists admin_role_check;
  alter table public.admin_profiles add constraint admin_role_check
    check (role in ('super_admin','admin','editor'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.admin_profiles drop constraint if exists admin_status_check;
  alter table public.admin_profiles add constraint admin_status_check
    check (status in ('active','inactive'));
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.student_promotions drop constraint if exists promotion_status_check;
  alter table public.student_promotions add constraint promotion_status_check
    check (status in ('promoted','skipped','failed','manual'));
exception when duplicate_object then null;
end;
$$;

-- Subjects need this unique constraint because results.js uses:
-- upsert(..., { onConflict: "class_name,section_name,subject_name" })
do $$
begin
  alter table public.subjects drop constraint if exists unique_subject_per_class;
  alter table public.subjects drop constraint if exists unique_subject_per_class_section;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'unique_subject_per_class_section'
      and conrelid = 'public.subjects'::regclass
  ) then
    alter table public.subjects
      add constraint unique_subject_per_class_section
      unique (class_name, section_name, subject_name);
  end if;
end;
$$;

-- Results need this unique constraint because results.js uses:
-- upsert(..., { onConflict: "student_id,academic_year,class_name,exam_name" })
do $$
begin
  alter table public.results drop constraint if exists unique_student_exam_result;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'unique_student_exam_result'
      and conrelid = 'public.results'::regclass
  ) then
    alter table public.results
      add constraint unique_student_exam_result
      unique (student_id, academic_year, class_name, exam_name);
  end if;
end;
$$;

-- Student roll is intended to be unique per academic year + class.
-- If old duplicate test data exists, this constraint will be skipped instead of failing the whole script.
do $$
begin
  alter table public.students drop constraint if exists unique_student_roll_per_class_year_section;
  alter table public.students drop constraint if exists unique_student_roll_per_class_year;

  if not exists (
    select 1
    from public.students
    group by academic_year, class_name, roll
    having count(*) > 1
  ) then
    alter table public.students
      add constraint unique_student_roll_per_class_year
      unique (academic_year, class_name, roll);
  else
    raise notice 'Skipped unique_student_roll_per_class_year because duplicate academic_year + class_name + roll values exist. Clean duplicate rolls and rerun this schema.';
  end if;
end;
$$;

-- Notice duplicate rule from project. It is skipped if old duplicate notices exist.
do $$
begin
  alter table public.notices drop constraint if exists unique_notice_title_date;

  if not exists (
    select 1
    from public.notices
    group by title, notice_date
    having count(*) > 1
  ) then
    alter table public.notices
      add constraint unique_notice_title_date
      unique (title, notice_date);
  else
    raise notice 'Skipped unique_notice_title_date because duplicate title + notice_date values exist.';
  end if;
end;
$$;


-- =====================================================================
-- 07. TRIGGERS
-- =====================================================================

drop trigger if exists set_school_settings_updated_at on public.school_settings;
create trigger set_school_settings_updated_at before update on public.school_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_academic_years_updated_at on public.academic_years;
create trigger set_academic_years_updated_at before update on public.academic_years
for each row execute function public.set_updated_at();

drop trigger if exists set_classes_updated_at on public.classes;
create trigger set_classes_updated_at before update on public.classes
for each row execute function public.set_updated_at();

drop trigger if exists set_students_updated_at on public.students;
create trigger set_students_updated_at before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists set_teachers_updated_at on public.teachers;
create trigger set_teachers_updated_at before update on public.teachers
for each row execute function public.set_updated_at();

drop trigger if exists set_staff_updated_at on public.staff;
create trigger set_staff_updated_at before update on public.staff
for each row execute function public.set_updated_at();

drop trigger if exists set_subjects_updated_at on public.subjects;
create trigger set_subjects_updated_at before update on public.subjects
for each row execute function public.set_updated_at();

drop trigger if exists set_results_updated_at on public.results;
create trigger set_results_updated_at before update on public.results
for each row execute function public.set_updated_at();

drop trigger if exists set_student_promotions_updated_at on public.student_promotions;
create trigger set_student_promotions_updated_at before update on public.student_promotions
for each row execute function public.set_updated_at();

drop trigger if exists set_notices_updated_at on public.notices;
create trigger set_notices_updated_at before update on public.notices
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_profiles_updated_at on public.admin_profiles;
create trigger set_admin_profiles_updated_at before update on public.admin_profiles
for each row execute function public.set_updated_at();


-- =====================================================================
-- 08. INDEXES
-- =====================================================================

create index if not exists idx_students_year_class on public.students (academic_year, class_name);
create index if not exists idx_students_year_class_section on public.students (academic_year, class_name, section_name, roll);
create index if not exists idx_students_roll on public.students (roll);
create index if not exists idx_students_year_class_religion on public.students (academic_year, class_name, section_name, religion);
create index if not exists idx_students_optional_subject on public.students (academic_year, class_name, section_name, optional_subject_code);

create index if not exists idx_subjects_class on public.subjects (class_name);
create index if not exists idx_subjects_class_section on public.subjects (class_name, section_name, sort_order, subject_name);
create index if not exists idx_subjects_type on public.subjects (class_name, section_name, subject_type);

create index if not exists idx_results_year_class on public.results (academic_year, class_name);
create index if not exists idx_results_year_class_section_publish on public.results (academic_year, class_name, section_name, publish_status, is_published);
create index if not exists idx_results_publish_status on public.results (publish_status, is_published);
create index if not exists idx_results_ranking_score on public.results (academic_year, class_name, ranking_score desc, total_marks desc);
create index if not exists idx_results_group_ranking on public.results (academic_year, class_name, section_name, ranking_score desc, total_marks desc);
create index if not exists idx_results_gpa_ranking on public.results (academic_year, class_name, gpa desc, total_point desc, total_marks desc);

create index if not exists idx_promotions_from on public.student_promotions (from_year, from_class, from_section);
create index if not exists idx_promotions_to on public.student_promotions (to_year, to_class, to_section);

create index if not exists idx_notices_status_date on public.notices (status, notice_date desc);
create index if not exists idx_teachers_status on public.teachers (status);
create index if not exists idx_staff_status on public.staff (status);
create index if not exists idx_admin_profiles_email on public.admin_profiles (email);
create index if not exists idx_admin_profiles_role_status on public.admin_profiles (role, status);


-- =====================================================================
-- 09. ADMIN RPC FUNCTIONS
-- =====================================================================

create or replace function public.is_head_of_administration()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
      and status = 'active'
      and (
        lower(trim(designation)) = 'head of administration'
        or role = 'super_admin'
      )
  );
$$;

revoke all on function public.is_head_of_administration() from public;
grant execute on function public.is_head_of_administration() to authenticated;


create or replace function public.is_active_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to anon, authenticated;

create or replace function public.can_manage_school_data()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_active_admin();
$$;

revoke all on function public.can_manage_school_data() from public;
grant execute on function public.can_manage_school_data() to authenticated;


create or replace function public.update_my_admin_profile(
  p_full_name text,
  p_email text
)
returns public.admin_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.admin_profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Full name is required';
  end if;

  update public.admin_profiles
  set
    full_name = trim(p_full_name),
    email = lower(trim(coalesce(nullif(p_email, ''), email))),
    updated_at = now()
  where id = auth.uid()
    and status = 'active'
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Admin profile not found or inactive';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.update_my_admin_profile(text, text) from public;
grant execute on function public.update_my_admin_profile(text, text) to authenticated;


create or replace function public.head_list_admin_profiles()
returns table (
  id uuid,
  full_name text,
  email text,
  designation text,
  role text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_head_of_administration() then
    raise exception 'Only Head of Administration can manage admin profiles';
  end if;

  return query
  select
    ap.id,
    ap.full_name,
    ap.email,
    ap.designation,
    ap.role,
    ap.status,
    ap.created_at,
    ap.updated_at
  from public.admin_profiles ap
  order by ap.created_at asc;
end;
$$;

revoke all on function public.head_list_admin_profiles() from public;
grant execute on function public.head_list_admin_profiles() to authenticated;


create or replace function public.head_update_admin_profile(
  p_target_user_id uuid,
  p_full_name text,
  p_email text,
  p_designation text,
  p_role text,
  p_status text
)
returns public.admin_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.admin_profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_head_of_administration() then
    raise exception 'Only Head of Administration can update admin profiles';
  end if;

  if p_target_user_id is null then
    raise exception 'Target user ID is required';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Full name is required';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'Email is required';
  end if;

  if p_role not in ('super_admin', 'admin', 'editor') then
    raise exception 'Invalid role';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'Invalid status';
  end if;

  update public.admin_profiles
  set
    full_name = trim(p_full_name),
    email = lower(trim(p_email)),
    designation = coalesce(nullif(trim(p_designation), ''), 'Administrator'),
    role = p_role,
    status = p_status,
    updated_at = now()
  where id = p_target_user_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Admin profile not found';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.head_update_admin_profile(uuid, text, text, text, text, text) from public;
grant execute on function public.head_update_admin_profile(uuid, text, text, text, text, text) to authenticated;


-- Optional helper for connecting an existing Supabase Auth user to admin_profiles.
-- The frontend mostly uses Edge Functions for creating/deleting Auth users.
create or replace function public.head_create_admin_profile(
  p_target_user_id uuid,
  p_full_name text,
  p_email text,
  p_designation text default 'Administrator',
  p_role text default 'admin',
  p_status text default 'active'
)
returns public.admin_profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  created_row public.admin_profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_head_of_administration() then
    raise exception 'Only Head of Administration can add admin profiles';
  end if;

  if p_target_user_id is null then
    raise exception 'Auth user UID is required';
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'Auth user not found. Create the user first from Authentication -> Users or Edge Function.';
  end if;

  if p_role not in ('super_admin','admin','editor') then
    raise exception 'Invalid role';
  end if;

  if p_status not in ('active','inactive') then
    raise exception 'Invalid status';
  end if;

  insert into public.admin_profiles (
    id, full_name, email, designation, role, status
  ) values (
    p_target_user_id,
    trim(p_full_name),
    lower(trim(p_email)),
    coalesce(nullif(trim(p_designation), ''), 'Administrator'),
    p_role,
    p_status
  )
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    email = excluded.email,
    designation = excluded.designation,
    role = excluded.role,
    status = excluded.status,
    updated_at = now()
  returning * into created_row;

  return created_row;
end;
$$;

revoke all on function public.head_create_admin_profile(uuid, text, text, text, text, text) from public;
grant execute on function public.head_create_admin_profile(uuid, text, text, text, text, text) to authenticated;


create or replace function public.bhs_grade_from_gpa(p_gpa numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_gpa, 0) >= 5.00 then 'A+'
    when coalesce(p_gpa, 0) >= 4.00 then 'A'
    when coalesce(p_gpa, 0) >= 3.50 then 'A-'
    when coalesce(p_gpa, 0) >= 3.00 then 'B'
    when coalesce(p_gpa, 0) >= 2.00 then 'C'
    when coalesce(p_gpa, 0) >= 1.00 then 'D'
    else 'F'
  end;
$$;

revoke all on function public.bhs_grade_from_gpa(numeric) from public;
grant execute on function public.bhs_grade_from_gpa(numeric) to authenticated;

create or replace function public.delete_subject_and_cleanup_results(
  p_class_name text,
  p_section_name text,
  p_subject_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_subjects integer := 0;
  v_updated_results integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_manage_school_data() then
    raise exception 'Only active admins can delete subjects';
  end if;

  if nullif(trim(p_class_name), '') is null or nullif(trim(p_subject_name), '') is null then
    raise exception 'Class name and subject name are required';
  end if;

  delete from public.subjects
  where class_name = trim(p_class_name)
    and coalesce(section_name, 'General') = coalesce(nullif(trim(p_section_name), ''), 'General')
    and subject_name = trim(p_subject_name);

  get diagnostics v_deleted_subjects = row_count;

  with cleaned as (
    select
      r.id,
      coalesce(r.marks, '{}'::jsonb) - trim(p_subject_name) as new_marks,
      coalesce(r.subject_grades, '{}'::jsonb) - trim(p_subject_name) as new_subject_grades,
      coalesce((
        select jsonb_agg(value order by ord)
        from jsonb_array_elements_text(coalesce(r.subjects, '[]'::jsonb)) with ordinality as arr(value, ord)
        where value <> trim(p_subject_name)
      ), '[]'::jsonb) as new_subjects
    from public.results r
    where r.class_name = trim(p_class_name)
      and coalesce(r.section_name, 'General') = coalesce(nullif(trim(p_section_name), ''), 'General')
      and (
        coalesce(r.marks, '{}'::jsonb) ? trim(p_subject_name)
        or coalesce(r.subject_grades, '{}'::jsonb) ? trim(p_subject_name)
        or coalesce(r.subjects, '[]'::jsonb) ? trim(p_subject_name)
      )
  ), mark_stats as (
    select
      c.id,
      c.new_marks,
      c.new_subject_grades,
      c.new_subjects,
      coalesce(sum(
        case when (m.value->>'total') ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (m.value->>'total')::numeric
          else 0
        end
      ), 0) as total_marks,
      count(m.key) as completed_subjects
    from cleaned c
    left join lateral jsonb_each(c.new_marks) as m(key, value) on true
    group by c.id, c.new_marks, c.new_subject_grades, c.new_subjects
  ), grade_stats as (
    select
      ms.id,
      ms.new_marks,
      ms.new_subject_grades,
      ms.new_subjects,
      ms.total_marks,
      ms.completed_subjects,
      coalesce(sum(
        case
          when g.key is null then 0
          when coalesce(g.value->>'type', 'compulsory') = 'non_gpa' then 0
          when coalesce(g.value->>'type', 'compulsory') = 'optional_4th' then greatest(0,
            case when (g.value->>'point') ~ '^-?[0-9]+(\.[0-9]+)?$' then (g.value->>'point')::numeric else 0 end - 2
          )
          else case when (g.value->>'point') ~ '^-?[0-9]+(\.[0-9]+)?$' then (g.value->>'point')::numeric else 0 end
        end
      ), 0) as total_point,
      coalesce(sum(
        case when g.key is not null and coalesce(g.value->>'type', 'compulsory') not in ('non_gpa', 'optional_4th') then 1 else 0 end
      ), 0) as denominator,
      coalesce(bool_or(
        g.key is not null
        and coalesce(g.value->>'type', 'compulsory') not in ('non_gpa', 'optional_4th')
        and (case when (g.value->>'point') ~ '^-?[0-9]+(\.[0-9]+)?$' then (g.value->>'point')::numeric else 0 end) = 0
      ), false) as has_required_fail
    from mark_stats ms
    left join lateral jsonb_each(ms.new_subject_grades) as g(key, value) on true
    group by ms.id, ms.new_marks, ms.new_subject_grades, ms.new_subjects, ms.total_marks, ms.completed_subjects
  ), final_stats as (
    select
      gs.*,
      case
        when gs.denominator <= 0 then 0::numeric
        when gs.has_required_fail then 0::numeric
        else least(5::numeric, round((gs.total_point / gs.denominator)::numeric, 2))
      end as new_gpa
    from grade_stats gs
  )
  update public.results r
  set
    marks = fs.new_marks,
    subject_grades = fs.new_subject_grades,
    subjects = fs.new_subjects,
    total_marks = round(fs.total_marks::numeric, 2),
    completed_subjects = fs.completed_subjects,
    total_subjects = jsonb_array_length(fs.new_subjects),
    average = case when fs.completed_subjects > 0 then round((fs.total_marks / fs.completed_subjects)::numeric, 2) else 0 end,
    total_point = round(fs.total_point::numeric, 2),
    gpa = fs.new_gpa,
    ranking_score = fs.new_gpa,
    final_grade = public.bhs_grade_from_gpa(fs.new_gpa),
    last_edited_after_publish_at = case when r.is_published then now() else r.last_edited_after_publish_at end,
    updated_at = now()
  from final_stats fs
  where r.id = fs.id;

  get diagnostics v_updated_results = row_count;

  return jsonb_build_object(
    'deleted_subjects', v_deleted_subjects,
    'updated_results', v_updated_results
  );
end;
$$;

revoke all on function public.delete_subject_and_cleanup_results(text, text, text) from public;
grant execute on function public.delete_subject_and_cleanup_results(text, text, text) to authenticated;


-- =====================================================================
-- 10. STUDENT PROMOTION + CLEANUP RPC FUNCTIONS
-- =====================================================================

create or replace function public.promote_students_transaction(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_student_data jsonb;
  v_history jsonb;
  v_student_id uuid;
  v_result_id uuid;
  v_rank integer;
  v_updated_student public.students%rowtype;
  v_updated_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Promotion rows must be a JSON array.';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_student_id := nullif(v_item->>'student_id', '')::uuid;
    v_student_data := coalesce(v_item->'student', '{}'::jsonb);
    v_history := coalesce(v_item->'history', '{}'::jsonb);

    if v_student_id is null then
      raise exception 'Student ID missing in promotion row.';
    end if;

    v_result_id := case
      when coalesce(v_history->>'result_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (v_history->>'result_id')::uuid
      else null
    end;

    v_rank := case
      when coalesce(v_history->>'rank', '') ~ '^[0-9]+$'
      then (v_history->>'rank')::integer
      else null
    end;

    update public.students
    set
      name = coalesce(nullif(v_student_data->>'name', ''), name),
      roll = coalesce(nullif(v_student_data->>'roll', ''), roll),
      class_name = coalesce(nullif(v_student_data->>'class_name', ''), class_name),
      section_name = coalesce(nullif(v_student_data->>'section_name', ''), section_name),
      academic_year = coalesce(nullif(v_student_data->>'academic_year', ''), academic_year),
      religion = coalesce(nullif(v_student_data->>'religion', ''), religion),
      optional_subject_name = nullif(v_student_data->>'optional_subject_name', ''),
      optional_subject_code = nullif(v_student_data->>'optional_subject_code', ''),
      guardian_name = coalesce(v_student_data->>'guardian_name', guardian_name),
      phone = coalesce(v_student_data->>'phone', phone),
      address = coalesce(v_student_data->>'address', address),
      status = coalesce(nullif(v_student_data->>'status', ''), 'active'),
      promotion_status = coalesce(nullif(v_student_data->>'promotion_status', ''), 'promoted'),
      promoted_from = coalesce(v_student_data->'promoted_from', promoted_from),
      updated_at = now()
    where id = v_student_id
    returning * into v_updated_student;

    if not found then
      raise exception 'Student not found for promotion: %', v_student_id;
    end if;

    insert into public.student_promotions (
      from_student_id,
      to_student_id,
      result_id,
      from_year,
      from_class,
      from_section,
      to_year,
      to_class,
      to_section,
      from_optional_subject,
      to_optional_subject,
      old_roll,
      new_roll,
      rank,
      total_marks,
      gpa,
      grade,
      remarks,
      status
    ) values (
      v_student_id,
      v_student_id,
      v_result_id,
      coalesce(nullif(v_history->>'from_year', ''), v_student_data->>'academic_year'),
      coalesce(nullif(v_history->>'from_class', ''), v_student_data->>'class_name'),
      nullif(v_history->>'from_section', ''),
      coalesce(nullif(v_history->>'to_year', ''), v_student_data->>'academic_year'),
      coalesce(nullif(v_history->>'to_class', ''), v_student_data->>'class_name'),
      nullif(v_history->>'to_section', ''),
      nullif(v_history->>'from_optional_subject', ''),
      nullif(v_history->>'to_optional_subject', ''),
      nullif(v_history->>'old_roll', ''),
      nullif(v_history->>'new_roll', ''),
      v_rank,
      coalesce(nullif(v_history->>'total_marks', '')::numeric, 0),
      coalesce(nullif(v_history->>'gpa', '')::numeric, 0),
      nullif(v_history->>'grade', ''),
      coalesce(nullif(v_history->>'remarks', ''), 'Manual promotion'),
      coalesce(nullif(v_history->>'status', ''), 'promoted')
    );

    v_updated_rows := v_updated_rows || jsonb_build_array(to_jsonb(v_updated_student));
  end loop;

  return v_updated_rows;
end;
$$;

grant execute on function public.promote_students_transaction(jsonb) to authenticated;
comment on function public.promote_students_transaction(jsonb)
is 'Atomically moves selected students to target class/year/section/optional subject and writes promotion history.';


create or replace function public.bulk_assign_student_group(
  p_academic_year text,
  p_class_name text,
  p_student_ids uuid[],
  p_section_name text,
  p_optional_subject_name text default null,
  p_optional_subject_code text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_class_name not in ('9','10') then
    raise exception 'Bulk group assignment is only for Class 9 and Class 10.';
  end if;

  if p_section_name not in ('Science','Arts','Commerce') then
    raise exception 'Section must be Science, Arts, or Commerce.';
  end if;

  update public.students
  set
    section_name = p_section_name,
    optional_subject_name = nullif(p_optional_subject_name, ''),
    optional_subject_code = nullif(p_optional_subject_code, ''),
    updated_at = now()
  where academic_year = p_academic_year
    and class_name = p_class_name
    and id = any(p_student_ids);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

grant execute on function public.bulk_assign_student_group(text, text, uuid[], text, text, text) to authenticated;


-- =====================================================================
-- 11. ROW LEVEL SECURITY POLICIES
-- =====================================================================

alter table public.school_settings enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.staff enable row level security;
alter table public.subjects enable row level security;
alter table public.results enable row level security;
alter table public.student_promotions enable row level security;
alter table public.notices enable row level security;
alter table public.admin_profiles enable row level security;

-- Remove old/conflicting policies on project tables and recreate clean policies.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'school_settings','academic_years','classes','students','teachers','staff',
        'subjects','results','student_promotions','notices','admin_profiles'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-- Public read policies.
create policy "Public can read school settings"
on public.school_settings for select
to anon, authenticated
using (true);

create policy "Public can read active academic years"
on public.academic_years for select
to anon, authenticated
using (is_active = true or public.is_active_admin());

create policy "Public can read active classes"
on public.classes for select
to anon, authenticated
using (is_active = true or public.is_active_admin());

create policy "Public can read active teachers"
on public.teachers for select
to anon, authenticated
using (status = 'Active' or public.is_active_admin());

create policy "Public can read active staff"
on public.staff for select
to anon, authenticated
using (status = 'Active' or public.is_active_admin());

create policy "Public can read active subjects"
on public.subjects for select
to anon, authenticated
using (is_active = true or public.is_active_admin());

create policy "Public can read published results"
on public.results for select
to anon, authenticated
using ((is_published = true and publish_status = 'published') or public.is_active_admin());

create policy "Public can read published notices"
on public.notices for select
to anon, authenticated
using (status = 'published' or public.is_active_admin());

-- Authenticated admin policies. A logged-in user must also have an active
-- admin_profiles row. This prevents random authenticated users from managing
-- school data if they are not approved admins.
create policy "Active admins can manage school settings"
on public.school_settings for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage academic years"
on public.academic_years for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage classes"
on public.classes for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage students"
on public.students for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage teachers"
on public.teachers for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage staff"
on public.staff for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage subjects"
on public.subjects for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage results"
on public.results for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage student promotions"
on public.student_promotions for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

create policy "Active admins can manage notices"
on public.notices for all
to authenticated
using (public.can_manage_school_data())
with check (public.can_manage_school_data());

-- Admin profiles are controlled: users can read/update their own profile;
-- Head of Administration / super_admin can manage profiles via RPC.
create policy "Admins can read allowed admin profiles"
on public.admin_profiles for select
to authenticated
using (auth.uid() = id or public.is_head_of_administration());

create policy "Users can insert own admin profile"
on public.admin_profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own admin profile"
on public.admin_profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- =====================================================================
-- 12. DEFAULT DATA + SUBJECT SEED
-- =====================================================================

insert into public.school_settings (
  school_name,
  school_email,
  school_phone,
  school_address,
  principal_name
)
values (
  'Baralai High School',
  null,
  null,
  null,
  null
)
on conflict do nothing;

insert into public.academic_years (year_name, is_current, is_active)
values
  ('2026', true, true),
  ('2027', false, true)
on conflict (year_name) do update set
  is_active = true,
  updated_at = now();

insert into public.classes (class_name, display_name, sort_order, is_active)
values
  ('6', 'Class 6', 6, true),
  ('7', 'Class 7', 7, true),
  ('8', 'Class 8', 8, true),
  ('9', 'Class 9', 9, true),
  ('10', 'Class 10', 10, true)
on conflict (class_name) do update set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

with subject_seed(class_name, section_name, subject_name, subject_code, subject_type, sort_order) as (
  values
  -- Class 6 General
  ('6','General','Bangla 1st Paper','101','compulsory',1),
  ('6','General','Bangla 2nd Paper','102','compulsory',2),
  ('6','General','English 1st Paper','107','compulsory',3),
  ('6','General','English 2nd Paper','108','compulsory',4),
  ('6','General','Mathematics','109','compulsory',5),
  ('6','General','Islam & Moral Education','111','religion',6),
  ('6','General','Hindu Religion & Moral Education','112','religion',7),
  ('6','General','Information & Communication Technology','154','compulsory',8),
  ('6','General','Physical Education, Health & Sports','147','compulsory',9),
  ('6','General','Arts & Crafts','148','compulsory',10),
  ('6','General','Work & Life Oriented Education','155','compulsory',11),

  -- Class 7 General
  ('7','General','Bangla 1st Paper','101','compulsory',1),
  ('7','General','Bangla 2nd Paper','102','compulsory',2),
  ('7','General','English 1st Paper','107','compulsory',3),
  ('7','General','English 2nd Paper','108','compulsory',4),
  ('7','General','Mathematics','109','compulsory',5),
  ('7','General','Islam & Moral Education','111','religion',6),
  ('7','General','Hindu Religion & Moral Education','112','religion',7),
  ('7','General','Information & Communication Technology','154','compulsory',8),
  ('7','General','Physical Education, Health & Sports','147','compulsory',9),
  ('7','General','Arts & Crafts','148','compulsory',10),
  ('7','General','Work & Life Oriented Education','155','compulsory',11),

  -- Class 8 General
  ('8','General','Bangla 1st Paper','101','compulsory',1),
  ('8','General','Bangla 2nd Paper','102','compulsory',2),
  ('8','General','English 1st Paper','107','compulsory',3),
  ('8','General','English 2nd Paper','108','compulsory',4),
  ('8','General','Mathematics','109','compulsory',5),
  ('8','General','Islam & Moral Education','111','religion',6),
  ('8','General','Hindu Religion & Moral Education','112','religion',7),
  ('8','General','Information & Communication Technology','154','compulsory',8),
  ('8','General','Physical Education, Health & Sports','147','compulsory',9),
  ('8','General','Arts & Crafts','148','compulsory',10),
  ('8','General','Work & Life Oriented Education','155','compulsory',11),

  -- Class 9 Science
  ('9','Science','Bangla 1st Paper','101','compulsory',1),
  ('9','Science','Bangla 2nd Paper','102','compulsory',2),
  ('9','Science','English 1st Paper','107','compulsory',3),
  ('9','Science','English 2nd Paper','108','compulsory',4),
  ('9','Science','Mathematics','109','compulsory',5),
  ('9','Science','Islam & Moral Education','111','religion',6),
  ('9','Science','Hindu Religion & Moral Education','112','religion',7),
  ('9','Science','Information & Communication Technology','154','compulsory',8),
  ('9','Science','Physical Education, Health & Sports','147','compulsory',9),
  ('9','Science','Career Education','156','compulsory',10),
  ('9','Science','Bangladesh & Global Studies','150','compulsory',11),
  ('9','Science','Physics','136','group_required',12),
  ('9','Science','Chemistry','137','group_required',13),
  ('9','Science','Biology','138','group_required',14),
  ('9','Science','Higher Mathematics','126','optional_4th',15),

  -- Class 9 Arts/Humanities
  ('9','Arts','Bangla 1st Paper','101','compulsory',1),
  ('9','Arts','Bangla 2nd Paper','102','compulsory',2),
  ('9','Arts','English 1st Paper','107','compulsory',3),
  ('9','Arts','English 2nd Paper','108','compulsory',4),
  ('9','Arts','Mathematics','109','compulsory',5),
  ('9','Arts','Islam & Moral Education','111','religion',6),
  ('9','Arts','Hindu Religion & Moral Education','112','religion',7),
  ('9','Arts','Information & Communication Technology','154','compulsory',8),
  ('9','Arts','Physical Education, Health & Sports','147','compulsory',9),
  ('9','Arts','Career Education','156','compulsory',10),
  ('9','Arts','Science','127','compulsory',11),
  ('9','Arts','History of Bangladesh & World Civilization','153','group_required',12),
  ('9','Arts','Geography & Environment','110','group_required',13),
  ('9','Arts','Civics & Citizenship','140','group_required',14),
  ('9','Arts','Economics','141','optional_4th',15),
  ('9','Arts','Agriculture Education','134','optional_4th',16),
  ('9','Arts','Home Science','151','optional_4th',17),

  -- Class 9 Commerce/Business Studies
  ('9','Commerce','Bangla 1st Paper','101','compulsory',1),
  ('9','Commerce','Bangla 2nd Paper','102','compulsory',2),
  ('9','Commerce','English 1st Paper','107','compulsory',3),
  ('9','Commerce','English 2nd Paper','108','compulsory',4),
  ('9','Commerce','Mathematics','109','compulsory',5),
  ('9','Commerce','Islam & Moral Education','111','religion',6),
  ('9','Commerce','Hindu Religion & Moral Education','112','religion',7),
  ('9','Commerce','Information & Communication Technology','154','compulsory',8),
  ('9','Commerce','Physical Education, Health & Sports','147','compulsory',9),
  ('9','Commerce','Career Education','156','compulsory',10),
  ('9','Commerce','Science','127','compulsory',11),
  ('9','Commerce','Accounting','146','group_required',12),
  ('9','Commerce','Finance & Banking','152','group_required',13),
  ('9','Commerce','Business Entrepreneurship','143','group_required',14),
  ('9','Commerce','Agriculture Education','134','optional_4th',15),
  ('9','Commerce','Home Science','151','optional_4th',16),

  -- Class 10 Science
  ('10','Science','Bangla 1st Paper','101','compulsory',1),
  ('10','Science','Bangla 2nd Paper','102','compulsory',2),
  ('10','Science','English 1st Paper','107','compulsory',3),
  ('10','Science','English 2nd Paper','108','compulsory',4),
  ('10','Science','Mathematics','109','compulsory',5),
  ('10','Science','Islam & Moral Education','111','religion',6),
  ('10','Science','Hindu Religion & Moral Education','112','religion',7),
  ('10','Science','Information & Communication Technology','154','compulsory',8),
  ('10','Science','Physical Education, Health & Sports','147','compulsory',9),
  ('10','Science','Career Education','156','compulsory',10),
  ('10','Science','Bangladesh & Global Studies','150','compulsory',11),
  ('10','Science','Physics','136','group_required',12),
  ('10','Science','Chemistry','137','group_required',13),
  ('10','Science','Biology','138','group_required',14),
  ('10','Science','Higher Mathematics','126','optional_4th',15),

  -- Class 10 Arts/Humanities
  ('10','Arts','Bangla 1st Paper','101','compulsory',1),
  ('10','Arts','Bangla 2nd Paper','102','compulsory',2),
  ('10','Arts','English 1st Paper','107','compulsory',3),
  ('10','Arts','English 2nd Paper','108','compulsory',4),
  ('10','Arts','Mathematics','109','compulsory',5),
  ('10','Arts','Islam & Moral Education','111','religion',6),
  ('10','Arts','Hindu Religion & Moral Education','112','religion',7),
  ('10','Arts','Information & Communication Technology','154','compulsory',8),
  ('10','Arts','Physical Education, Health & Sports','147','compulsory',9),
  ('10','Arts','Career Education','156','compulsory',10),
  ('10','Arts','Science','127','compulsory',11),
  ('10','Arts','History of Bangladesh & World Civilization','153','group_required',12),
  ('10','Arts','Geography & Environment','110','group_required',13),
  ('10','Arts','Civics & Citizenship','140','group_required',14),
  ('10','Arts','Economics','141','optional_4th',15),
  ('10','Arts','Agriculture Education','134','optional_4th',16),
  ('10','Arts','Home Science','151','optional_4th',17),

  -- Class 10 Commerce/Business Studies
  ('10','Commerce','Bangla 1st Paper','101','compulsory',1),
  ('10','Commerce','Bangla 2nd Paper','102','compulsory',2),
  ('10','Commerce','English 1st Paper','107','compulsory',3),
  ('10','Commerce','English 2nd Paper','108','compulsory',4),
  ('10','Commerce','Mathematics','109','compulsory',5),
  ('10','Commerce','Islam & Moral Education','111','religion',6),
  ('10','Commerce','Hindu Religion & Moral Education','112','religion',7),
  ('10','Commerce','Information & Communication Technology','154','compulsory',8),
  ('10','Commerce','Physical Education, Health & Sports','147','compulsory',9),
  ('10','Commerce','Career Education','156','compulsory',10),
  ('10','Commerce','Science','127','compulsory',11),
  ('10','Commerce','Accounting','146','group_required',12),
  ('10','Commerce','Finance & Banking','152','group_required',13),
  ('10','Commerce','Business Entrepreneurship','143','group_required',14),
  ('10','Commerce','Agriculture Education','134','optional_4th',15),
  ('10','Commerce','Home Science','151','optional_4th',16)
)
insert into public.subjects (
  class_name,
  section_name,
  subject_name,
  subject_code,
  subject_type,
  sort_order,
  is_active
)
select class_name, section_name, subject_name, subject_code, subject_type, sort_order, true
from subject_seed
on conflict (class_name, section_name, subject_name)
do update set
  subject_code = excluded.subject_code,
  subject_type = excluded.subject_type,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- Seed the creator/admin profile only if the Auth user already exists.
-- Change this email if your Head/Admin account uses another email.
insert into public.admin_profiles (
  id,
  full_name,
  email,
  designation,
  role,
  status
)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), 'Mahdi Hasan'),
  lower(u.email),
  'Creator Of the System',
  'super_admin',
  'active'
from auth.users u
where lower(u.email) = lower('mahdihasan0314@gmail.com')
on conflict (id)
do update set
  full_name = excluded.full_name,
  email = excluded.email,
  designation = excluded.designation,
  role = excluded.role,
  status = excluded.status,
  updated_at = now();


-- =====================================================================
-- 13. GRANTS
-- =====================================================================

grant usage on schema public to anon, authenticated;
grant select on public.school_settings to anon, authenticated;
grant select on public.academic_years to anon, authenticated;
grant select on public.classes to anon, authenticated;
grant select on public.teachers to anon, authenticated;
grant select on public.staff to anon, authenticated;
grant select on public.subjects to anon, authenticated;
grant select on public.results to anon, authenticated;
grant select on public.notices to anon, authenticated;

grant all on public.school_settings to authenticated;
grant all on public.academic_years to authenticated;
grant all on public.classes to authenticated;
grant all on public.students to authenticated;
grant all on public.teachers to authenticated;
grant all on public.staff to authenticated;
grant all on public.subjects to authenticated;
grant all on public.results to authenticated;
grant all on public.student_promotions to authenticated;
grant all on public.notices to authenticated;
grant select, insert, update on public.admin_profiles to authenticated;


-- =====================================================================
-- 14. FINAL SUCCESS MESSAGE
-- =====================================================================
select 'BHS complete updated schema applied successfully' as status;
