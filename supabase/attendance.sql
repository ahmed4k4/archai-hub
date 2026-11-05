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

create or replace function public.archai_is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

-- ===== v2: إغلاق تلقائي + غياب + عطلات + صلاحيات المدير (ترقية آمنة) =====
alter table public.attendance_rules add column if not exists fixed_grace_minutes int not null default 120 check (fixed_grace_minutes between 0 and 720);   -- إغلاق تلقائي بعد نهاية الدوام الثابت بهذه المدة
alter table public.attendance_rules add column if not exists early_window_minutes int not null default 120 check (early_window_minutes between 0 and 720);  -- أقصى تبكير مسموح للبدء
alter table public.attendance_rules add column if not exists absent_is_red boolean not null default true;                                                 -- الغياب = نقطة حمراء
alter table public.work_days add column if not exists absent boolean not null default false;
create table if not exists public.attendance_holidays(day date primary key, note text, created_at timestamptz not null default now());
alter table public.attendance_holidays enable row level security;
drop policy if exists "archai att holi read" on public.attendance_holidays;
create policy "archai att holi read" on public.attendance_holidays for select to authenticated using (true);
drop policy if exists "archai att holi admin" on public.attendance_holidays;
create policy "archai att holi admin" on public.attendance_holidays for all to authenticated using (public.archai_is_admin()) with check (public.archai_is_admin());

-- ---------- مساعد: هل المستخدم مدير؟ ----------

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
drop function if exists public.att_autoclose(uuid);
create or replace function public.att_now() returns timestamptz language sql stable as $$ select now() $$;
create or replace function public.att_dot(p_delta int, p_late int, p_early int) returns text language sql immutable as
$$ select case when p_delta >= p_late then 'red' when p_delta <= -p_early then 'green' else 'blue' end $$;

-- إعادة حساب يوم كامل (المدة، الحضور، الانصراف، الفروق، النقطة) — يحترم تعديل المدير اليدوي للنقطة
create or replace function public.att_recalc_day(p_day uuid) returns public.work_days language plpgsql security definer set search_path = public as $$
declare r attendance_rules; d work_days; tot int; fs timestamptz; le timestamptz; hasopen boolean; delta int; endd int; nd text;
begin
  select * into r from attendance_rules where id = 1;
  select * into d from work_days where id = p_day;
  select coalesce(sum(extract(epoch from (ended_at - started_at))) filter (where ended_at is not null), 0)::int, min(started_at), max(ended_at), coalesce(bool_or(ended_at is null), false)
    into tot, fs, le, hasopen from work_sessions where day_id = p_day;
  if fs is null then
    update work_days set worked_seconds = 0, first_start = null, last_end = null, start_delta = null, end_delta = null where id = p_day;
  else
    if d.mode = 'fixed' and not d.off_day then
      delta := round(extract(epoch from ((fs at time zone r.tz) - (d.work_date + d.sched_start))) / 60)::int;
      nd := public.att_dot(delta, r.late_threshold, r.early_threshold);
      if d.closed and not hasopen then endd := round(extract(epoch from ((le at time zone r.tz) - (d.work_date + d.sched_end))) / 60)::int; end if;
    elsif d.mode = 'flexible' and not d.off_day and d.closed then
      nd := public.att_dot(coalesce(d.target_minutes, 0) - round(tot / 60.0)::int, r.late_threshold, r.early_threshold);
    end if;
    update work_days set worked_seconds = tot, first_start = fs, last_end = case when hasopen then null else le end,
      start_delta = delta, end_delta = endd, absent = false,
      dot = case when dot_note is not null then dot else coalesce(nd, dot) end
    where id = p_day;
  end if;
  select * into d from work_days where id = p_day;
  return d;
end $$;

-- إغلاق يوم تلقائيًا عند وقت محدد (يُنهي الجلسة المفتوحة عنده ويحسب النقاط)
create or replace function public.att_close_day(p_day uuid, p_end timestamptz, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare r attendance_rules;
begin
  select * into r from attendance_rules where id = 1;
  update work_sessions set ended_at = greatest(started_at, least(p_end, started_at + make_interval(hours => r.max_session_hours))) where day_id = p_day and ended_at is null;
  update work_days set closed = true, auto_closed = true, summary = coalesce(summary, 'أُغلق تلقائيًا (' || p_reason || ') — لم يُسجَّل الإنهاء') where id = p_day;
  perform public.att_recalc_day(p_day);
end $$;

-- الكنس التلقائي: يُستدعى من التطبيق ومن pg_cron (إن وُجد). آمن للتكرار.
create or replace function public.att_sweep() returns void language plpgsql security definer set search_path = public as $$
declare r attendance_rules; d work_days; s work_schedules; loc timestamp; tdy date; k date; lim timestamp;
begin
  select * into r from attendance_rules where id = 1;
  loc := now() at time zone r.tz; tdy := loc::date;
  -- 1) أيام سابقة لم تُغلق: تُغلق عند منتصف الليل وتُحسب نقاطها
  for d in select * from work_days where closed = false and work_date < tdy loop
    perform public.att_close_day(d.id, ((d.work_date + 1)::timestamp at time zone r.tz), 'منتصف الليل');
  end loop;
  -- 2) الدوام الثابت: تجاوز نهاية الدوام بأكثر من فترة السماح
  for d in select * from work_days where closed = false and mode = 'fixed' and not off_day and work_date = tdy
           and loc > (work_date + sched_end + make_interval(mins => r.fixed_grace_minutes)) loop
    lim := d.work_date + d.sched_end + make_interval(mins => r.fixed_grace_minutes);
    perform public.att_close_day(d.id, lim at time zone r.tz, 'تجاوز نهاية الدوام');
  end loop;
  -- 3) جلسة مفتوحة أطول من الحد الأقصى
  update work_sessions set ended_at = started_at + make_interval(hours => r.max_session_hours)
   where ended_at is null and now() > started_at + make_interval(hours => r.max_session_hours);
  -- 4) الغياب: يوم عمل مجدول انتهى بدون أي حضور (آخر 7 أيام فقط، ولا يشمل العطلات)
  if r.absent_is_red then
    for s in select * from work_schedules where active loop
      for k in select g::date from generate_series(greatest((s.created_at at time zone r.tz)::date, tdy - 7), tdy - 1, interval '1 day') g loop
        if extract(dow from k)::int = any (s.work_days)
           and not exists (select 1 from attendance_holidays h where h.day = k)
           and not exists (select 1 from work_days w where w.user_id = s.user_id and w.work_date = k) then
          insert into work_days(user_id, work_date, mode, sched_start, sched_end, target_minutes, dot, summary, closed, auto_closed, absent)
          values (s.user_id, k, s.mode, s.start_time, s.end_time, s.daily_minutes, 'red', 'غياب — لم يُسجَّل أي حضور', true, true, true)
          on conflict (user_id, work_date) do nothing;
        end if;
      end loop;
    end loop;
  end if;
end $$;

create or replace function public.att_start() returns public.work_days language plpgsql security definer set search_path = public as $$
declare r attendance_rules; s work_schedules; d work_days; loc timestamp; tdy date; delta int; dt text; off boolean;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  perform public.att_sweep();
  select * into r from attendance_rules where id = 1;
  select * into s from work_schedules where user_id = auth.uid() and active;
  if s.user_id is null then raise exception 'لا يوجد جدول عمل مفعّل لك — تواصل مع المدير'; end if;
  if exists (select 1 from work_sessions where user_id = auth.uid() and ended_at is null) then raise exception 'لديك جلسة عمل مفتوحة بالفعل'; end if;
  loc := now() at time zone r.tz; tdy := loc::date;
  select * into d from work_days where user_id = auth.uid() and work_date = tdy;
  if d.id is not null and d.closed then raise exception 'تم إنهاء يوم العمل بالفعل — اطلب من المدير إعادة فتحه'; end if;
  if d.id is null then
    off := not (extract(dow from loc)::int = any (s.work_days)) or exists (select 1 from attendance_holidays where day = tdy);
    if s.mode = 'fixed' and not off then
      delta := round(extract(epoch from (loc - (tdy + s.start_time))) / 60)::int;
      if delta < -r.early_window_minutes then raise exception 'لا يمكن بدء العمل قبل موعدك بأكثر من % دقيقة', r.early_window_minutes; end if;
      dt := public.att_dot(delta, r.late_threshold, r.early_threshold);
    end if;
    insert into work_days(user_id, work_date, mode, sched_start, sched_end, target_minutes, first_start, start_delta, dot, off_day)
      values (auth.uid(), tdy, s.mode, s.start_time, s.end_time, s.daily_minutes, now(), delta, dt, off) returning * into d;
  end if;
  insert into work_sessions(day_id, user_id) values (d.id, auth.uid());
  return d;
end $$;

create or replace function public.att_stop(p_comment text default null, p_close boolean default false) returns public.work_days language plpgsql security definer set search_path = public as $$
declare d work_days; ss work_sessions; closing boolean; cm text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  perform public.att_sweep();
  select * into d from work_days where user_id = auth.uid() and closed = false order by work_date desc limit 1;
  if d.id is null then raise exception 'لا يوجد يوم عمل مفتوح — ربما أُغلق تلقائيًا (منتصف الليل أو بعد نهاية الدوام)'; end if;
  select * into ss from work_sessions where day_id = d.id and ended_at is null;
  closing := p_close or d.mode = 'fixed';
  cm := nullif(trim(coalesce(p_comment, '')), '');
  if closing and (cm is null or length(cm) < 2) then raise exception 'اكتب ما تم إنجازه قبل الإنهاء'; end if;
  if ss.id is null and not closing then raise exception 'لا توجد جلسة مفتوحة'; end if;
  if ss.id is not null then update work_sessions set ended_at = now(), comment = cm where id = ss.id; end if;
  if closing then update work_days set closed = true, summary = cm where id = d.id; end if;
  return public.att_recalc_day(d.id);
end $$;

-- ===== صلاحيات المدير (كلها تتحقق من أنه مدير) =====
create or replace function public.att_admin_stop(p_user uuid, p_comment text default null, p_close boolean default false) returns public.work_days language plpgsql security definer set search_path = public as $$
declare d work_days; cm text;
begin
  if not public.archai_is_admin() then raise exception 'للمدير فقط'; end if;
  perform public.att_sweep();
  select * into d from work_days where user_id = p_user and closed = false order by work_date desc limit 1;
  if d.id is null then raise exception 'لا يوجد يوم عمل مفتوح لهذا الموظف'; end if;
  cm := nullif(trim(coalesce(p_comment, '')), '');
  update work_sessions set ended_at = now(), comment = case when cm is not null then 'أوقفه المدير: ' || cm else 'أوقفه المدير' end where day_id = d.id and ended_at is null;
  if p_close or d.mode = 'fixed' then
    update work_days set closed = true, summary = coalesce(summary, case when cm is not null then 'أنهاه المدير: ' || cm else 'أنهى المدير اليوم' end) where id = d.id;
  end if;
  return public.att_recalc_day(d.id);
end $$;

create or replace function public.att_admin_add_session(p_day uuid, p_start timestamp, p_end timestamp, p_comment text default null) returns public.work_days language plpgsql security definer set search_path = public as $$
declare r attendance_rules; d work_days; st timestamptz; en timestamptz;
begin
  if not public.archai_is_admin() then raise exception 'للمدير فقط'; end if;
  select * into r from attendance_rules where id = 1; select * into d from work_days where id = p_day;
  if d.id is null then raise exception 'اليوم غير موجود'; end if;
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'حدد وقت بداية ونهاية صحيحين'; end if;
  st := p_start at time zone r.tz; en := p_end at time zone r.tz;
  if st < (d.work_date::timestamp at time zone r.tz) or en > ((d.work_date + 1)::timestamp at time zone r.tz) then raise exception 'الفترة يجب أن تكون داخل يوم العمل نفسه'; end if;
  if exists (select 1 from work_sessions where user_id = d.user_id and tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz)) && tstzrange(st, en)) then raise exception 'الفترة تتداخل مع فترة أخرى'; end if;
  insert into work_sessions(day_id, user_id, started_at, ended_at, comment) values (d.id, d.user_id, st, en, nullif(trim(coalesce(p_comment, '')), ''));
  return public.att_recalc_day(d.id);
end $$;

create or replace function public.att_admin_edit_session(p_session uuid, p_start timestamp, p_end timestamp, p_comment text default null) returns public.work_days language plpgsql security definer set search_path = public as $$
declare r attendance_rules; s work_sessions; d work_days; st timestamptz; en timestamptz;
begin
  if not public.archai_is_admin() then raise exception 'للمدير فقط'; end if;
  select * into r from attendance_rules where id = 1; select * into s from work_sessions where id = p_session;
  if s.id is null then raise exception 'الفترة غير موجودة'; end if;
  select * into d from work_days where id = s.day_id;
  if p_start is null or (p_end is not null and p_end <= p_start) then raise exception 'حدد وقت بداية ونهاية صحيحين'; end if;
  if p_end is null and s.ended_at is not null then raise exception 'حدد وقت النهاية'; end if;
  st := p_start at time zone r.tz; en := p_end at time zone r.tz;
  if st < (d.work_date::timestamp at time zone r.tz) or coalesce(en, st) > ((d.work_date + 1)::timestamp at time zone r.tz) then raise exception 'الفترة يجب أن تكون داخل يوم العمل نفسه'; end if;
  if exists (select 1 from work_sessions where user_id = s.user_id and id <> s.id and tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz)) && tstzrange(st, coalesce(en, 'infinity'::timestamptz))) then raise exception 'الفترة تتداخل مع فترة أخرى'; end if;
  update work_sessions set started_at = st, ended_at = en, comment = nullif(trim(coalesce(p_comment, '')), '') where id = s.id;
  return public.att_recalc_day(d.id);
end $$;

create or replace function public.att_admin_delete_session(p_session uuid) returns public.work_days language plpgsql security definer set search_path = public as $$
declare s work_sessions;
begin
  if not public.archai_is_admin() then raise exception 'للمدير فقط'; end if;
  select * into s from work_sessions where id = p_session;
  if s.id is null then raise exception 'الفترة غير موجودة'; end if;
  delete from work_sessions where id = s.id;
  return public.att_recalc_day(s.day_id);
end $$;

create or replace function public.att_admin_recalc(p_day uuid) returns public.work_days language plpgsql security definer set search_path = public as $$
begin
  if not public.archai_is_admin() then raise exception 'للمدير فقط'; end if;
  return public.att_recalc_day(p_day);
end $$;

create or replace function public.att_admin_reopen(p_day uuid) returns public.work_days language plpgsql security definer set search_path = public as $$
declare r attendance_rules; d work_days;
begin
  if not public.archai_is_admin() then raise exception 'للمدير فقط'; end if;
  select * into r from attendance_rules where id = 1; select * into d from work_days where id = p_day;
  if d.id is null then raise exception 'اليوم غير موجود'; end if;
  if d.work_date <> (now() at time zone r.tz)::date then raise exception 'يمكن إعادة فتح يوم اليوم فقط — لأيام سابقة عدّل الفترات يدويًا'; end if;
  update work_days set closed = false, auto_closed = false where id = p_day;
  select * into d from work_days where id = p_day;
  return d;
end $$;

revoke all on function public.att_now(), public.att_start(), public.att_stop(text, boolean), public.att_sweep(), public.att_recalc_day(uuid), public.att_close_day(uuid, timestamptz, text),
  public.att_admin_stop(uuid, text, boolean), public.att_admin_add_session(uuid, timestamp, timestamp, text), public.att_admin_edit_session(uuid, timestamp, timestamp, text),
  public.att_admin_delete_session(uuid), public.att_admin_recalc(uuid), public.att_admin_reopen(uuid) from public, anon;
grant execute on function public.att_now(), public.att_start(), public.att_stop(text, boolean), public.att_sweep(),
  public.att_admin_stop(uuid, text, boolean), public.att_admin_add_session(uuid, timestamp, timestamp, text), public.att_admin_edit_session(uuid, timestamp, timestamp, text),
  public.att_admin_delete_session(uuid), public.att_admin_recalc(uuid), public.att_admin_reopen(uuid) to authenticated;

-- تحديث لحظي (إن كان الـ publication موجودًا):
do $$ begin alter publication supabase_realtime add table public.work_days;      exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.work_sessions;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.work_schedules; exception when others then null; end $$;
-- إغلاق تلقائي مضمون كل 10 دقائق حتى لو لم يفتح أحد التطبيق (يعمل تلقائيًا إن كان pg_cron مفعّلًا، وإلا يُتجاهل بلا أي خطأ):
do $$ begin perform cron.schedule('archai-att-sweep', '*/10 * * * *', 'select public.att_sweep()'); exception when others then null; end $$;
