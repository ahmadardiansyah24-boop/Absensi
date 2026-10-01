create extension if not exists pgcrypto;

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  name text not null,
  class_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists face_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  descriptor_json jsonb not null,
  sample_count int not null default 1,
  active boolean not null default true,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_face_active on face_profiles(active);
create index if not exists idx_face_student on face_profiles(student_id);

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  attendance_date date not null,
  session text not null default 'MASUK',
  status text not null check(status in ('Hadir','Terlambat','Sakit','Izin','Alpa')),
  recorded_at time not null,
  match_distance numeric(10,7),
  device_id text,
  created_at timestamptz not null default now(),
  unique(student_id, attendance_date, session)
);
create index if not exists idx_att_date on attendance_records(attendance_date);

create or replace function record_face_attendance(
  p_student_id uuid,
  p_date date,
  p_session text,
  p_status text,
  p_recorded_at time,
  p_distance numeric,
  p_device text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r attendance_records;
begin
  insert into attendance_records(student_id,attendance_date,session,status,recorded_at,match_distance,device_id)
  values(p_student_id,p_date,p_session,p_status,p_recorded_at,p_distance,p_device)
  on conflict(student_id,attendance_date,session) do nothing
  returning * into r;

  if r.id is null then
    select * into r from attendance_records
    where student_id=p_student_id and attendance_date=p_date and session=p_session
    limit 1;
    return jsonb_build_object('ok',false,'duplicate',true,'recorded_at',r.recorded_at,'status',r.status);
  end if;
  return jsonb_build_object('ok',true,'duplicate',false,'id',r.id,'recorded_at',r.recorded_at,'status',r.status);
end;
$$;

alter table students enable row level security;
alter table face_profiles enable row level security;
alter table attendance_records enable row level security;

revoke execute on function record_face_attendance(uuid,date,text,text,time,numeric,text) from public, anon, authenticated;
