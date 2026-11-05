-- شغّله بعد links.sql. يسمح للموظف بإضافة روابط وتعديل/حذف روابطه فقط.
-- لا يغيّر ولا يحذف أي سياسة موجودة (السياسات تُجمع بـ OR)، وآمن لإعادة التشغيل.
create or replace function public.archai_can_add_resource(pid uuid, tid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select case when tid is null then
      exists(select 1 from project_members where project_id=pid and user_id=auth.uid())
      or exists(select 1 from tasks where project_id=pid and assigned_to=auth.uid())
    else exists(select 1 from tasks where id=tid and project_id=pid and assigned_to=auth.uid()) end
$$;

drop policy if exists "archai staff select own links" on public.resources;
create policy "archai staff select own links" on public.resources for select to authenticated
  using (created_by = auth.uid());

drop policy if exists "archai staff insert own links" on public.resources;
create policy "archai staff insert own links" on public.resources for insert to authenticated
  with check (created_by = auth.uid() and target_user_id is null and public.archai_can_add_resource(project_id, task_id));

drop policy if exists "archai staff update own links" on public.resources;
create policy "archai staff update own links" on public.resources for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and public.archai_can_add_resource(project_id, task_id));

drop policy if exists "archai staff delete own links" on public.resources;
create policy "archai staff delete own links" on public.resources for delete to authenticated
  using (created_by = auth.uid());
