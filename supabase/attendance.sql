-- ============================================================
-- نظام الحضور والانصراف وتتبّع وقت العمل — شغّله مرة واحدة (آمن لإعادة التشغيل)
-- لا يغيّر أي جدول أو سياسة موجودة. الأوقات تُسجَّل من وقت السيرفر فقط (لا يمكن التلاعب بها من المتصفح).
-- ============================================================
create table if not exists public.attendance_rules(
  id int primary key default 1 check (id = 1),
  tz text not null default 'Africa/Cairo',
  late_threshold int not null default 5 check (late_threshold >= 1),    -- دقائق التأخير لتصبح نقطة حمراء
  early_threshold int not null default 5 check (early_threshold >= 1),  -- دقائق التبكير لتصبح نقطة خضراء
  greens_per_red int not null default 2 check (greens_per_red >= 1),    -- كم نقطة خضراء تلغي نقطة حمراء
  max_session_hours int not null default 14 check (max_session_hours >= 1),
  updated_at timestamptz not null default now());
insert into public.attendance_rules(id) values (1) on conflict (id) do nothing;

create table if not exists public.work_schedules(
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('fixed','flexible')),
  start_time time, end_time time,                       -- للدوام الثابت
  daily_minutes int check (daily_minutes between 15 and 960),  -- للفترة المرنة (الهدف اليومي)
  work_days int[] not null default '{0,1,2,3,4}',        -- 0=الأحد ... 6=السبت
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mode <> 'fixed' or (start_time is not null and end_time is not null and end_time > start_time)),
  check (mode <> 'flexible' or daily_minutes is not null));

create table if not exists public.work_days(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  mode text not null,
  sched_start time, sched_end time, target_minutes int,
  first_start timestamptz, last_end timestamptz,
  worked_seconds int not null default 0,
  start_delta int,            -- دقائق: موجب = تأخير ، سالب = تبكير (الدوام الثابت)
  end_delta int,              -- دقائق: موجب = خروج متأخر/إضافي ، سالب = خروج مبكر
  dot text check (dot in ('red','green','blue')),
  dot_note text,
  summary text,               -- ما تم إنجازه
  closed boolean not null default false,
  auto_closed boolean not null default false,
  off_day boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, work_date));

create table if not exists public.work_sessions(
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.work_days(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  comment text);
create index if not exists idx_wd_user_date on public.work_days(user_id, work_date desc);
create index if not exists idx_ws_user_start on public.work_sessions(user_id, started_at desc);
create index if not exists idx_ws_day on public.work_sessions(day_id);
create unique index if not exists uq_ws_one_open on public.work_sessions(user_id) where ended_at is null;

-- ---------- مساعد: هل المستخدم مدير؟ ----------
create or replace function public.archai_is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

-- ---------- RLS ----------
alter table public.attendance_rules enable row level security;
alter table public.work_schedules  enable row level security;
alter table public.work_days       enable row level security;
alter table public.work_sessions   enable row level security;

drop policy if exists "archai att rules read"  on public.attendance_rules;
create policy "archai att rules read"  on public.attendance_rules for select to authenticated using (true);
drop policy if exists "archai att rules admin" on public.attendance_rules;
create policy "archai att rules admin" on public.attendance_rules for update to authenticated using (public.archai_is_admin()) with check (public.archai_is_admin());

drop policy if exists "archai att sched read"  on public.work_schedules;
create policy "archai att sched read"  on public.work_schedules for select to authenticated using (user_id = auth.uid() or public.archai_is_admin());
drop policy if exists "archai att sched admin" on public.work_schedules;
create policy "archai att sched admin" on public.work_schedules for all to authenticated using (public.archai_is_admin()) with check (public.archai_is_admin());

drop policy if exists "archai att days read"  on public.work_days;
create policy "archai att days read"  on public.work_days for select to authenticated using (user_id = auth.uid() or public.archai_is_admin());
drop policy if exists "archai att days admin" on public.work_days;
create policy "archai att days admin" on public.work_days for all to authenticated using (public.archai_is_admin()) with check (public.archai_is_admin());

drop policy if exists "archai att sess read"  on public.work_sessions;
create policy "archai att sess read"  on public.work_sessions for select to authenticated using (user_id = auth.uid() or public.archai_is_admin());
drop policy if exists "archai att sess admin" on public.work_sessions;
create policy "archai att sess admin" on public.work_sessions for all to authenticated using (public.archai_is_admin()) with check (public.archai_is_admin());
-- الموظف لا يكتب مباشرة في الجداول؛ الكتابة عبر الدوال أدناه فقط.

-- ---------- دوال ----------
create or replace function public.att_now() returns timestamptz language sql stable as $$ select now() $$;

create or replace function public.att_autoclose(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare r attendance_rules; d work_days; tdy date; tot int;
begin
  select * into r from attendance_rules where id = 1;
  tdy := (now() at time zone r.tz)::date;
  for d in select * from work_days where user_id = p_user and closed = false and work_date < tdy loop
    update work_sessions set ended_at = least(now(), started_at + make_interval(hours => r.max_session_hours)) where day_id = d.id and ended_at is null;
    select coalesce(sum(extract(epoch from (ended_at - started_at))), 0)::int into tot from work_sessions where day_id = d.id;
    -- الإغلاق التلقائي لا يمنح نقطة (لا يُعرف وقت الانتهاء الحقيقي) ويُعلَّم لمراجعة المدير
    update work_days set closed = true, auto_closed = true, worked_seconds = tot,
      last_end = (select max(ended_at) from work_sessions where day_id = d.id),
      summary = coalesce(summary, 'أُغلق تلقائيًا — لم يُسجَّل الإنهاء')
    where id = d.id;
  end loop;
end $$;

create or replace function public.att_start() returns public.work_days language plpgsql security definer set search_path = public as $$
declare r attendance_rules; s work_schedules; d work_days; loc timestamp; tdy date; delta int; dt text; dow int; off boolean;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  perform public.att_autoclose(auth.uid());
  select * into r from attendance_rules where id = 1;
  select * into s from work_schedules where user_id = auth.uid() and active;
  if s.user_id is null then raise exception 'لا يوجد جدول عمل مفعّل لك — تواصل مع المدير'; end if;
  if exists (select 1 from work_sessions where user_id = auth.uid() and ended_at is null) then raise exception 'لديك جلسة عمل مفتوحة بالفعل'; end if;
  loc := now() at time zone r.tz; tdy := loc::date; dow := extract(dow from loc)::int;
  select * into d from work_days where user_id = auth.uid() and work_date = tdy;
  if d.id is not null and d.closed then raise exception 'تم إنهاء يوم العمل بالفعل — اطلب من المدير إعادة فتحه'; end if;
  if d.id is null then
    off := not (dow = any (s.work_days));
    if s.mode = 'fixed' and not off then
      delta := round(extract(epoch from (loc - (tdy + s.start_time))) / 60)::int;
      dt := case when delta >= r.late_threshold then 'red' when delta <= -r.early_threshold then 'green' else 'blue' end;
    end if;
    insert into work_days(user_id, work_date, mode, sched_start, sched_end, target_minutes, first_start, start_delta, dot, off_day)
      values (auth.uid(), tdy, s.mode, s.start_time, s.end_time, s.daily_minutes, now(), delta, dt, off) returning * into d;
  end if;
  insert into work_sessions(day_id, user_id) values (d.id, auth.uid());
  return d;
end $$;

create or replace function public.att_stop(p_comment text default null, p_close boolean default false) returns public.work_days language plpgsql security definer set search_path = public as $$
declare r attendance_rules; d work_days; ss work_sessions; loc timestamp; tot int; endd int; diff int; closing boolean; cm text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  perform public.att_autoclose(auth.uid());
  select * into r from attendance_rules where id = 1;
  select * into d from work_days where user_id = auth.uid() and closed = false order by work_date desc limit 1;
  if d.id is null then raise exception 'لا يوجد يوم عمل مفتوح'; end if;
  select * into ss from work_sessions where day_id = d.id and ended_at is null;
  closing := p_close or d.mode = 'fixed';
  cm := nullif(trim(coalesce(p_comment, '')), '');
  if closing and (cm is null or length(cm) < 2) then raise exception 'اكتب ما تم إنجازه قبل الإنهاء'; end if;
  if ss.id is null and not closing then raise exception 'لا توجد جلسة مفتوحة'; end if;
  if ss.id is not null then update work_sessions set ended_at = now(), comment = cm where id = ss.id; end if;
  select coalesce(sum(extract(epoch from (ended_at - started_at))), 0)::int into tot from work_sessions where day_id = d.id and ended_at is not null;
  update work_days set worked_seconds = tot, last_end = now() where id = d.id;
  if closing then
    loc := now() at time zone r.tz;
    endd := case when d.mode = 'fixed' and not d.off_day then round(extract(epoch from (loc - (d.work_date + d.sched_end))) / 60)::int end;
    diff := case when d.mode = 'flexible' then round(tot / 60.0)::int - coalesce(d.target_minutes, 0) end;
    update work_days set closed = true, summary = cm, end_delta = endd,
      dot = case when d.mode = 'flexible' and not d.off_day then
              (case when diff <= -r.late_threshold then 'red' when diff >= r.early_threshold then 'green' else 'blue' end) else dot end
    where id = d.id;
  end if;
  select * into d from work_days where id = d.id;
  return d;
end $$;

revoke all on function public.att_now(), public.att_start(), public.att_stop(text, boolean), public.att_autoclose(uuid) from public, anon;
grant execute on function public.att_now(), public.att_start(), public.att_stop(text, boolean) to authenticated;

-- تحديث لحظي (إن كان الـ publication موجودًا):
do $$ begin alter publication supabase_realtime add table public.work_days;      exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.work_sessions;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.work_schedules; exception when others then null; end $$;
