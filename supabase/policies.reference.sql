-- مرجع فقط — لا تشغّله على مشروع عنده سياسات تعمل بالفعل.
-- يستخدم drop policy if exists لذلك يستبدل أي سياسة بنفس الاسم (قد يغيّر سلوك نظامك الحالي).
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create or replace function public.is_member(pid uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from project_members where project_id=pid and user_id=auth.uid()) $$;
-- مثال لسياسة واحدة بصيغة آمنة لإعادة التشغيل:
drop policy if exists "projects read" on public.projects;
create policy "projects read" on public.projects for select using (is_admin() or is_member(id));
-- كرر نفس النمط (drop policy if exists ثم create policy) لباقي الجداول إن احتجت.
-- Storage: bucket خاص اسمه project-files، والمسار المتوقع projects/<project_uuid>/...
