-- آمن للتشغيل أكثر من مرة: لا يلمس سياساتك ولا بياناتك الحالية.
create index if not exists idx_tasks_project  on public.tasks(project_id);
create index if not exists idx_tasks_assignee on public.tasks(assigned_to);
create index if not exists idx_files_project  on public.files(project_id);
create index if not exists idx_logs_created   on public.activity_logs(created_at desc);

-- تنظيف مرة واحدة لسجل النشاط الأقدم من 60 يومًا (يقلل حجم الـ Database):
delete from public.activity_logs where created_at < now() - interval '60 days';

-- (اختياري) تنظيف تلقائي يوميًا: فعّل امتداد pg_cron من Database > Extensions أولًا، ثم أزل التعليق:
-- select cron.schedule('trim-activity-logs','0 3 * * *',$$delete from public.activity_logs where created_at < now() - interval '60 days'$$);
