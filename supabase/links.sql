-- شغّله مرة واحدة: يفعّل ربط الروابط بالمهام (آمن لإعادة التشغيل)
alter table public.resources add column if not exists task_id uuid references public.tasks(id) on delete cascade;
create index if not exists idx_resources_project on public.resources(project_id);
create index if not exists idx_resources_task on public.resources(task_id);
