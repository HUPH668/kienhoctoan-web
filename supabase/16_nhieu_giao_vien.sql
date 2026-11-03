-- Nhiều giáo viên: mỗi giáo viên chỉ quản lí lớp, học sinh, bài giao, buổi live của mình.
-- Ngân hàng câu hỏi, video ôn tập, báo lỗi câu hỏi và việc duyệt giáo viên mới do quản trị (thầy Hùng) quản lí. Chạy được nhiều lần.

-- ---------------------------------------------------------------- BẢNG
alter table public.teachers add column if not exists email text;
alter table public.teachers add column if not exists full_name text;
alter table public.teachers add column if not exists title text;            -- cách học sinh gọi: "Thầy", "Cô Lan"...
alter table public.teachers add column if not exists phone text;
alter table public.teachers add column if not exists role text not null default 'teacher';   -- 'admin' | 'teacher'
alter table public.teachers add column if not exists active boolean not null default true;
do $$
begin
  if not exists (select 1 from public.teachers where role = 'admin') then
    update public.teachers set role = 'admin', title = coalesce(title, 'Thầy'), full_name = coalesce(full_name, 'Lê Văn Hùng');
  end if;
end $$;
update public.teachers t set email = u.email from auth.users u where u.id = t.user_id and t.email is null;

create table if not exists public.teacher_rejects (      -- tài khoản đăng kí giáo viên đã bị từ chối
  user_id uuid primary key,
  at timestamptz not null default now()
);
alter table public.teacher_rejects enable row level security;

alter table public.classes add column if not exists owner uuid;
alter table public.live_sessions add column if not exists owner uuid;
update public.classes set owner = (select user_id from public.teachers where role = 'admin' order by created_at limit 1) where owner is null;
update public.live_sessions set owner = (select user_id from public.teachers where role = 'admin' order by created_at limit 1) where owner is null;
create index if not exists classes_owner_idx on public.classes(owner);
create index if not exists live_sessions_owner_idx on public.live_sessions(owner);

-- ---------------------------------------------------------------- QUYỀN
create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teachers where user_id = auth.uid() and active)
$$;
create or replace function public._is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teachers where user_id = auth.uid() and active and role = 'admin')
$$;
create or replace function public._need_teacher() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then
    raise exception 'Tài khoản này chưa được cấp quyền giáo viên';
  end if;
end $$;
create or replace function public._need_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
  if not public._is_admin() then raise exception 'Chỉ quản trị (thầy Hùng) mới làm được việc này'; end if;
end $$;
-- lớp có thuộc giáo viên đang đăng nhập không (quản trị được làm với mọi lớp)
create or replace function public._can(p_class bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public._is_admin() or (p_class is not null and exists (select 1 from public.classes where id = p_class and owner = auth.uid()))
$$;
-- dùng để lọc danh sách: chỉ lớp của chính mình (học sinh chưa có lớp thuộc quản trị)
create or replace function public._mine(p_class bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_class is null then public._is_admin()
              else exists (select 1 from public.classes where id = p_class and owner = auth.uid()) end
$$;
create or replace function public._own_class(p_class bigint) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_class is not null and not public._can(p_class) then raise exception 'Lớp này không thuộc quyền quản lí của bạn'; end if;
end $$;
create or replace function public._own_assignment(p_id bigint) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.assignments where id = p_id) and not public._can((select class_id from public.assignments where id = p_id)) then
    raise exception 'Bài kiểm tra này không thuộc lớp của bạn';
  end if;
end $$;
create or replace function public._own_student(p_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare cid bigint;
begin
  select class_id into cid from public.students where id = p_id;
  if found and not public._is_admin() and not public._can(cid) then raise exception 'Học sinh này không thuộc lớp của bạn'; end if;
end $$;
create or replace function public._own_attempt(p_id bigint) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._own_student((select student_id from public.attempts where id = p_id));
end $$;
create or replace function public._own_live(p_id bigint) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.live_sessions where id = p_id and owner is distinct from auth.uid()) and not public._is_admin() then
    raise exception 'Buổi học này không phải của bạn';
  end if;
end $$;
-- giáo viên phụ trách học sinh / lớp (dùng cho phía học sinh)
create or replace function public._class_owner(p_class bigint) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select owner from public.classes where id = p_class), (select user_id from public.teachers where role = 'admin' order by created_at limit 1))
$$;

-- bảng dữ liệu: chỉ quản trị đọc/ghi trực tiếp; giáo viên làm mọi việc qua các hàm ở trên (đã kiểm tra quyền)
do $$
declare t text;
begin
  foreach t in array array['questions','answers','figs','classes','students','assignments','attempts','attempt_items','review_items','settings'] loop
    execute format('drop policy if exists teacher_all on public.%I', t);
    execute format('create policy teacher_all on public.%I for all to authenticated using (public._is_admin()) with check (public._is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- TÀI KHOẢN GIÁO VIÊN
-- trạng thái của người đang đăng nhập (gọi được cả khi chưa được duyệt)
create or replace function public.t_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.teachers; u record;
begin
  if auth.uid() is null then return jsonb_build_object('status', 'none'); end if;
  select * into t from public.teachers where user_id = auth.uid();
  if found then
    return jsonb_build_object('status', case when t.active then 'teacher' else 'locked' end, 'role', t.role,
      'name', t.full_name, 'title', t.title, 'email', t.email);
  end if;
  if exists (select 1 from public.teacher_rejects where user_id = auth.uid()) then return jsonb_build_object('status', 'rejected'); end if;
  return jsonb_build_object('status', 'pending');
end $$;

create or replace function public.t_admin_teachers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_admin();
  return jsonb_build_object(
    'teachers', coalesce((select jsonb_agg(jsonb_build_object('id', t.user_id, 'email', coalesce(t.email, u.email), 'name', t.full_name, 'title', t.title,
          'phone', t.phone, 'role', t.role, 'active', t.active, 'at', t.created_at, 'me', t.user_id = auth.uid(),
          'classes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade,
                         'n', (select count(*) from public.students s where s.class_id = c.id and s.status <> 'pending')) order by c.name)
                       from public.classes c where c.owner = t.user_id), '[]'::jsonb),
          'n_assign', (select count(*) from public.assignments a join public.classes c on c.id = a.class_id where c.owner = t.user_id),
          'last', (select max(a.created_at) from public.assignments a join public.classes c on c.id = a.class_id where c.owner = t.user_id))
        order by (t.role = 'admin') desc, t.created_at)
      from public.teachers t left join auth.users u on u.id = t.user_id), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'at', u.created_at,
          'name', u.raw_user_meta_data ->> 'full_name', 'title', u.raw_user_meta_data ->> 'title',
          'phone', u.raw_user_meta_data ->> 'phone', 'note', u.raw_user_meta_data ->> 'note') order by u.created_at desc)
      from auth.users u
      where not exists (select 1 from public.teachers t where t.user_id = u.id)
        and not exists (select 1 from public.teacher_rejects r where r.user_id = u.id)), '[]'::jsonb));
end $$;

create or replace function public.t_admin_teacher_set(p_user uuid, p_action text, p_name text default null, p_title text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare u record;
begin
  perform public._need_admin();
  if p_user = auth.uid() and p_action in ('lock', 'reject') then return jsonb_build_object('error', 'Không thể khoá chính tài khoản của mình.'); end if;
  if p_action = 'approve' then
    select * into u from auth.users where id = p_user;
    if not found then return jsonb_build_object('error', 'Không tìm thấy tài khoản.'); end if;
    insert into public.teachers(user_id, email, full_name, title, phone, role, active)
    values (p_user, u.email,
            coalesce(nullif(btrim(p_name), ''), u.raw_user_meta_data ->> 'full_name', u.email),
            coalesce(nullif(btrim(p_title), ''), u.raw_user_meta_data ->> 'title', 'Thầy/Cô'),
            u.raw_user_meta_data ->> 'phone', 'teacher', true)
    on conflict (user_id) do update set active = true;
    delete from public.teacher_rejects where user_id = p_user;
  elsif p_action = 'reject' then
    insert into public.teacher_rejects(user_id) values (p_user) on conflict do nothing;
  elsif p_action = 'lock' then
    update public.teachers set active = false where user_id = p_user and role <> 'admin';
  elsif p_action = 'unlock' then
    update public.teachers set active = true where user_id = p_user;
  elsif p_action = 'edit' then
    update public.teachers set full_name = coalesce(nullif(btrim(p_name), ''), full_name), title = coalesce(nullif(btrim(p_title), ''), title)
     where user_id = p_user;
  else
    return jsonb_build_object('error', 'Thao tác không hợp lệ.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- CÁC HÀM CŨ: THÊM KIỂM TRA QUYỀN
-- t_deactivate_except
CREATE OR REPLACE FUNCTION public.t_deactivate_except(p_ids jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare n int;
begin
  perform public._need_admin();
  update public.questions set active = false
   where active and not (id = any(array(select jsonb_array_elements_text(p_ids))));
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$
;
-- t_import_figs
CREATE OR REPLACE FUNCTION public.t_import_figs(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare n int;
begin
  perform public._need_admin();
  insert into public.figs(id, svg) select r.id, r.svg from jsonb_to_recordset(p_rows) as r(id text, svg text)
  on conflict (id) do update set svg = excluded.svg;
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$
;
-- t_import_passages
CREATE OR REPLACE FUNCTION public.t_import_passages(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare n int;
begin
  perform public._need_admin();
  insert into public.passages(id, html) select r.id, r.html from jsonb_to_recordset(p_rows) as r(id text, html text)
  on conflict (id) do update set html = excluded.html, updated_at = now();
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$
;
-- t_import_questions
CREATE OR REPLACE FUNCTION public.t_import_questions(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare n int;
begin
  perform public._need_admin();
  insert into public.questions(id, g, l, lv, lg, t, q, o, s, src, tag, exam, sec, grp, ord, active, updated_at)
  select r.id, r.g, r.l, coalesce(r.lv, 'TH'), coalesce(r.lg, false), r.t, r.q, coalesce(r.o, '[]'::jsonb), coalesce(r.s, ''), r.src, r.tag, r.exam, r.sec, r.grp, r.ord, true, now()
  from jsonb_to_recordset(p_rows) as r(id text, g int, l int, lv text, lg boolean, t text, q text, o jsonb, s text, src text, tag text,
                                       exam text, sec text, grp text, ord int)
  on conflict (id) do update set g = excluded.g, l = excluded.l, lv = excluded.lv, lg = excluded.lg, t = excluded.t, q = excluded.q,
     o = excluded.o, s = excluded.s, src = excluded.src, tag = excluded.tag, exam = excluded.exam, sec = excluded.sec, grp = excluded.grp, ord = excluded.ord, active = not questions.manual_off, updated_at = now();
  get diagnostics n = row_count;
  insert into public.answers(qid, k)
  select r.id, r.k from jsonb_to_recordset(p_rows) as r(id text, k jsonb)
  on conflict (qid) do update set k = case when answers.manual then answers.k else excluded.k end;
  return jsonb_build_object('n', n);
end $$
;
-- t_question_fix
CREATE OR REPLACE FUNCTION public.t_question_fix(p_qid text, p_key jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare q public.questions;
begin
  perform public._need_admin();
  select * into q from public.questions where id = p_qid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy câu hỏi.'); end if;
  if q.t = 'MC' and not (jsonb_typeof(p_key) = 'number' and (p_key #>> '{}')::int between 0 and jsonb_array_length(q.o) - 1) then
    return jsonb_build_object('error', 'Đáp án không hợp lệ.'); end if;
  if q.t = 'TF' and not (jsonb_typeof(p_key) = 'array' and jsonb_array_length(p_key) = 4
       and not exists (select 1 from jsonb_array_elements(p_key) e where jsonb_typeof(e) <> 'boolean')) then
    return jsonb_build_object('error', 'Cần chọn Đúng/Sai cho cả 4 ý.'); end if;
  if q.t = 'SA' and not (jsonb_typeof(p_key) = 'string' and btrim(p_key #>> '{}') <> '') then
    return jsonb_build_object('error', 'Nhập đáp số.'); end if;
  insert into public.answers(qid, k, manual) values (p_qid, p_key, true)
  on conflict (qid) do update set k = excluded.k, manual = true;
  update public.questions set updated_at = now(), manual_off = false, active = true where id = p_qid;
  return public._after_fix(p_qid, 'fixed');
end $$
;
-- t_question_hide
CREATE OR REPLACE FUNCTION public.t_question_hide(p_qid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_admin();
  update public.questions set active = false, manual_off = true, updated_at = now() where id = p_qid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy câu hỏi.'); end if;
  return public._after_fix(p_qid, 'deleted');
end $$
;
-- t_set_active
CREATE OR REPLACE FUNCTION public.t_set_active(p_ids jsonb, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare n int;
begin
  perform public._need_admin();
  update public.questions set active = p_active, updated_at = now()
   where id = any(array(select jsonb_array_elements_text(p_ids))) and (not p_active or not manual_off);
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$
;
-- t_register_open
CREATE OR REPLACE FUNCTION public.t_register_open(p_open boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_admin();
  insert into public.settings(key, value) values ('register_open', p_open::text)
  on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('open', p_open);
end $$
;
-- t_reports
CREATE OR REPLACE FUNCTION public.t_reports(p_status text DEFAULT 'open'::text, p_qid text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_admin();
  return coalesce((select jsonb_agg(x order by (x ->> 'n')::int desc, x ->> 'last' desc) from (
    select jsonb_build_object(
      'qid', q.id, 'g', q.g, 'l', q.l, 'lv', q.lv, 't', q.t, 'q', q.q, 'o', q.o, 's', q.s, 'src', q.src, 'tag', q.tag,
      'active', q.active, 'manual_off', q.manual_off, 'key', an.k, 'key_manual', coalesce(an.manual, false),
      'n', (select count(*) from public.question_reports r where r.qid = q.id and (p_qid is not null or r.status = p_status)),
      'last', (select max(created_at) from public.question_reports r where r.qid = q.id),
      'reports', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'suggest', r.suggest, 'ans', r.ans, 'note', r.note,
                 'status', r.status, 'at', r.created_at, 'name', st.full_name, 'code', st.code,
                 'class', (select name from public.classes c where c.id = st.class_id)) order by r.created_at desc)
                 from public.question_reports r join public.students st on st.id = r.student_id
                 where r.qid = q.id and (p_qid is not null or r.status = p_status)), '[]'::jsonb),
      -- học sinh đã chọn gì ở câu này (mọi bài đã nộp)
      'stats', (select jsonb_build_object(
                 'n', count(*),
                 'ok', count(*) filter (where ai.status = 'ok'),
                 'mc', case when q.t = 'MC' then (select jsonb_object_agg(v, c) from (
                          select public._ans_orig('MC', ai2.ans, ai2.perm) #>> '{}' v, count(*) c
                          from public.attempt_items ai2 join public.attempts a2 on a2.id = ai2.attempt_id
                          where ai2.qid = q.id and a2.status = 'done' and jsonb_typeof(ai2.ans) = 'number' group by 1) z) end,
                 'tf', case when q.t = 'TF' then (select jsonb_agg(jsonb_build_object('t', t, 'f', f) order by i) from (
                          select i, count(*) filter (where ai2.ans -> i = 'true'::jsonb) t, count(*) filter (where ai2.ans -> i = 'false'::jsonb) f
                          from public.attempt_items ai2 join public.attempts a2 on a2.id = ai2.attempt_id cross join generate_series(0, 3) i
                          where ai2.qid = q.id and a2.status = 'done' and jsonb_typeof(ai2.ans) = 'array' group by i) z) end,
                 'sa', case when q.t = 'SA' then (select jsonb_agg(jsonb_build_object('v', v, 'c', c) order by c desc) from (
                          select btrim(ai2.ans #>> '{}') v, count(*) c
                          from public.attempt_items ai2 join public.attempts a2 on a2.id = ai2.attempt_id
                          where ai2.qid = q.id and a2.status = 'done' and public._answered(ai2.ans) group by 1 order by 2 desc limit 6) z) end)
               from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id
               where ai.qid = q.id and a.status = 'done'),
      'figs', coalesce((select jsonb_object_agg(f.id, f.svg) from public.figs f
                        where f.id in (select (regexp_matches(q.q || ' ' || q.o::text || ' ' || q.s, 'data-fig=\\?"([0-9a-f]+)', 'g'))[1])), '{}'::jsonb)
    ) x
    from public.questions q left join public.answers an on an.qid = q.id
    where (p_qid is not null and q.id = p_qid)
       or (p_qid is null and exists (select 1 from public.question_reports r where r.qid = q.id and r.status = p_status))
    limit 300) z), '[]'::jsonb);
end $$
;
-- t_report_dismiss
CREATE OR REPLACE FUNCTION public.t_report_dismiss(p_qid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare n int;
begin
  perform public._need_admin();
  update public.question_reports set status = 'dismissed', resolved_at = now() where qid = p_qid and status = 'open';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end $$
;
-- t_video_save
CREATE OR REPLACE FUNCTION public.t_video_save(p_g integer, p_l integer, p_url text, p_title text DEFAULT ''::text, p_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare pv text[]; nid bigint;
begin
  perform public._need_admin();
  pv := public._video_parse(p_url);
  if pv is null then
    return jsonb_build_object('error', 'Không đọc được link. Dán link đầy đủ dạng https://www.tiktok.com/@kenh/video/123… hoặc link YouTube.');
  end if;
  if p_g is null or p_l is null then return jsonb_build_object('error', 'Chọn khối và bài.'); end if;
  if p_id is not null then
    update public.lesson_videos set g = p_g, l = p_l, provider = pv[1], vid = pv[2], url = btrim(p_url), title = left(btrim(coalesce(p_title, '')), 150)
     where id = p_id returning id into nid;
  else
    insert into public.lesson_videos(g, l, provider, vid, url, title, sort)
    values (p_g, p_l, pv[1], pv[2], btrim(p_url), left(btrim(coalesce(p_title, '')), 150),
            coalesce((select max(sort) + 1 from public.lesson_videos where g = p_g and l = p_l), 0))
    on conflict (provider, vid, g, l) do update set title = excluded.title, url = excluded.url
    returning id into nid;
  end if;
  return jsonb_build_object('ok', true, 'id', nid);
end $$
;
-- t_video_delete
CREATE OR REPLACE FUNCTION public.t_video_delete(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_admin();
  delete from public.lesson_videos where id = p_id;
  return jsonb_build_object('ok', true);
end $$
;
-- t_reports_count
CREATE OR REPLACE FUNCTION public.t_reports_count()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  if not public._is_admin() then return 0; end if;
  return (select count(distinct qid) from public.question_reports where status = 'open');
end $$
;
-- t_assign
CREATE OR REPLACE FUNCTION public.t_assign(p_class bigint, p_title text, p_kind text, p_grade integer, p_blueprint jsonb, p_opens timestamp with time zone, p_closes timestamp with time zone, p_max integer DEFAULT 1, p_show boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare nid bigint;
begin
  perform public._need_teacher();
  perform public._own_class(p_class);
  if p_closes <= p_opens then raise exception 'Giờ đóng phải sau giờ mở'; end if;
  insert into public.assignments(class_id, title, kind, grade, blueprint, opens_at, closes_at, max_attempts, show_answers)
  values (p_class, p_title, p_kind, p_grade, p_blueprint, p_opens, p_closes, greatest(p_max, 1), p_show) returning id into nid;
  return jsonb_build_object('id', nid);
end $$
;
-- t_assignment_extend
CREATE OR REPLACE FUNCTION public.t_assignment_extend(p_id bigint, p_closes timestamp with time zone, p_max integer DEFAULT NULL::integer, p_extend_doing boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare a public.assignments; mins int; n int := 0;
begin
  perform public._need_teacher();
  perform public._own_assignment(p_id);
  select * into a from public.assignments where id = p_id;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài kiểm tra.'); end if;
  if p_closes is null or p_closes <= now() then return jsonb_build_object('error', 'Giờ đóng mới phải sau thời điểm hiện tại.'); end if;
  if p_closes <= a.opens_at then return jsonb_build_object('error', 'Giờ đóng phải sau giờ mở bài.'); end if;
  update public.assignments set closes_at = p_closes, max_attempts = coalesce(least(greatest(p_max, 1), 50), max_attempts) where id = p_id;
  mins := coalesce((a.blueprint ->> 'minutes')::int, 45);
  update public.attempts t
     set ends_at = least(case when p_extend_doing then greatest(t.ends_at, t.started_at + make_interval(mins => mins)) else t.ends_at end, p_closes)
   where t.assignment_id = p_id and t.status = 'doing';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'doing', n, 'closes_at', p_closes,
                            'max_attempts', (select max_attempts from public.assignments where id = p_id));
end $$
;
-- t_assignment_update
CREATE OR REPLACE FUNCTION public.t_assignment_update(p_id bigint, p_closes timestamp with time zone DEFAULT NULL::timestamp with time zone, p_show boolean DEFAULT NULL::boolean, p_delete boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_assignment(p_id);
  if p_delete then delete from public.assignments where id = p_id; return '{"ok":true}'::jsonb; end if;
  update public.assignments set closes_at = coalesce(p_closes, closes_at), show_answers = coalesce(p_show, show_answers) where id = p_id;
  if p_closes is not null and p_closes <= now() then   -- đóng bài: thu bài các em đang làm
    perform public._grade(t.id) from public.attempts t where t.assignment_id = p_id and t.status = 'doing';
  end if;
  return '{"ok":true}'::jsonb;
end $$
;
-- t_attempt
CREATE OR REPLACE FUNCTION public.t_attempt(p_attempt bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_attempt(p_attempt);
  return public._payload(p_attempt, true);
end $$
;
-- t_attempt_extend
CREATE OR REPLACE FUNCTION public.t_attempt_extend(p_attempt bigint, p_minutes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare t public.attempts;
begin
  perform public._need_teacher();
  perform public._own_attempt(p_attempt);
  select * into t from public.attempts where id = p_attempt for update;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài làm.'); end if;
  if t.status <> 'doing' then return jsonb_build_object('error', 'Em này đã nộp bài, không cộng giờ được.'); end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 240 then return jsonb_build_object('error', 'Số phút từ 1 đến 240.'); end if;
  update public.attempts set ends_at = greatest(ends_at, now()) + make_interval(mins => p_minutes) where id = p_attempt
  returning * into t;
  return jsonb_build_object('ok', true, 'ends_at', t.ends_at);
end $$
;
-- t_class_delete
CREATE OR REPLACE FUNCTION public.t_class_delete(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_class(p_id);
  delete from public.classes where id = p_id;
  return '{"ok":true}'::jsonb;
end $$
;
-- t_class_stats
CREATE OR REPLACE FUNCTION public.t_class_stats(p_class bigint, p_days integer DEFAULT 120, p_assignment bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 120), 7), 3650));
begin
  perform public._need_teacher();
  perform public._own_class(p_class); if p_assignment is not null then perform public._own_assignment(p_assignment); end if;
  return (
    with st as (
      select s.id, s.code, s.full_name from public.students s where s.class_id = p_class and s.status <> 'pending'
    ), att as (
      select t.* from public.attempts t join st on st.id = t.student_id
      where t.status = 'done' and t.submitted_at >= since
        and t.kind not in ('Bài bổ sung', 'Ôn câu sai', 'Nhiệm vụ hôm nay')
        and (p_assignment is null or t.assignment_id = p_assignment)
    ), items as (
      select ai.*, q.g, q.l, q.lv, q.t, t.student_id from public.attempt_items ai join att t on t.id = ai.attempt_id join public.questions q on q.id = ai.qid
    ), per_sl as (
      select student_id, g, l, sum(coalesce(m, 0) * coalesce(w, 1)) / nullif(sum(coalesce(w, 1)), 0) m, count(*) n
      from items group by student_id, g, l
    ), rem as (
      select r.* from public.remedials r join st on st.id = r.student_id
      where r.created_at >= since and (p_assignment is null or r.assignment_id = p_assignment)
    )
    select jsonb_build_object(
      'n_students', (select count(*) from st),
      'n_attempts', (select count(*) from att),
      'avg', (select round(avg(score), 2) from att),
      'scores', coalesce((select jsonb_agg(score) from att), '[]'::jsonb),
      'weekly', coalesce((select jsonb_agg(jsonb_build_object('w', w, 'avg', av, 'n', n) order by w) from (
          select date_trunc('week', submitted_at at time zone 'Asia/Ho_Chi_Minh')::date w, round(avg(score), 2) av, count(*) n
          from att group by 1) z), '[]'::jsonb),
      'lessons', coalesce((select jsonb_agg(jsonb_build_object('key', g || '-' || l, 'g', g, 'l', l, 'm', round(m, 3), 'n', n, 'ns', ns,
                                                               'weak', nw) order by g, l) from (
          select i.g, i.l, sum(coalesce(i.m, 0) * coalesce(i.w, 1)) / nullif(sum(coalesce(i.w, 1)), 0) m, count(*) n,
                 count(distinct i.student_id) ns,
                 (select count(*) from per_sl p where p.g = i.g and p.l = i.l and p.m < 0.5 and p.n >= 2) nw
          from items i group by i.g, i.l) z), '[]'::jsonb),
      'levels', coalesce((select jsonb_agg(jsonb_build_object('lv', lv, 'm', round(m, 3), 'n', n)) from (
          select lv, sum(coalesce(m, 0) * coalesce(w, 1)) / nullif(sum(coalesce(w, 1)), 0) m, count(*) n from items group by lv) z), '[]'::jsonb),
      'types', coalesce((select jsonb_agg(jsonb_build_object('t', t, 'm', round(m, 3), 'n', n)) from (
          select t, sum(coalesce(m, 0) * coalesce(w, 1)) / nullif(sum(coalesce(w, 1)), 0) m, count(*) n from items group by t) z), '[]'::jsonb),
      'remedial', jsonb_build_object(
          'pending', (select count(*) from rem where status = 'pending'),
          'done', (select count(*) from rem where status = 'done'),
          'avg', (select round(avg(score), 2) from rem where status = 'done')),
      'students', coalesce((select jsonb_agg(x order by x ->> 'name') from (
          select jsonb_build_object('id', s.id, 'code', s.code, 'name', s.full_name,
            'n', (select count(*) from att where att.student_id = s.id),
            'avg', (select round(avg(score), 2) from att where att.student_id = s.id),
            'last', (select max(submitted_at) from att where att.student_id = s.id),
            'trend', coalesce((select jsonb_agg(sc order by ts) from (select score sc, submitted_at ts from att where att.student_id = s.id order by submitted_at desc limit 10) z), '[]'::jsonb),
            'weak', coalesce((select jsonb_agg(jsonb_build_object('key', p.g || '-' || p.l, 'm', round(p.m, 3)) order by p.m) from
                      (select * from per_sl p where p.student_id = s.id and p.m < 0.5 and p.n >= 2 order by p.m limit 3) p), '[]'::jsonb),
            'rem_pending', (select count(*) from rem where rem.student_id = s.id and rem.status = 'pending'),
            'rem_done', (select count(*) from rem where rem.student_id = s.id and rem.status = 'done')) x
          from st s) y), '[]'::jsonb)
    ));
end $$
;
-- t_monitor
CREATE OR REPLACE FUNCTION public.t_monitor(p_assignment bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare a public.assignments;
begin
  perform public._need_teacher();
  perform public._own_assignment(p_assignment);
  perform public._finalize_expired();
  select * into a from public.assignments where id = p_assignment;
  return jsonb_build_object(
    'server_now', now(),
    'assignment', jsonb_build_object('id', a.id, 'title', a.title, 'kind', a.kind, 'grade', a.grade, 'opens_at', a.opens_at,
                                     'closes_at', a.closes_at, 'blueprint', a.blueprint, 'max_attempts', a.max_attempts, 'show_answers', a.show_answers,
                                     'class', (select name from public.classes where id = a.class_id)),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'student_id', s.id, 'code', s.code, 'name', s.full_name,
        'attempt', t.id, 'status', t.status, 'n_answered', t.n_answered, 'n_items', t.n_items, 'score', t.score,
        'started_at', t.started_at, 'submitted_at', t.submitted_at, 'ends_at', t.ends_at, 'last_seen', t.last_seen,
        'leaves', t.leaves, 'away_s', t.away_s, 'copy_n', t.copy_n,
        'flags', case when t.id is not null then public._flags(t.id) else '[]'::jsonb end,
        'n_attempts', (select count(*) from public.attempts x where x.assignment_id = a.id and x.student_id = s.id)
      ) order by s.code)
      from public.students s
      left join lateral (select * from public.attempts x where x.assignment_id = a.id and x.student_id = s.id
                         order by (x.status = 'doing') desc, x.score desc nulls last, x.id desc limit 1) t on true
      where s.class_id = a.class_id and s.active), '[]'::jsonb));
end $$
;
-- t_report
CREATE OR REPLACE FUNCTION public.t_report(p_assignment bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_assignment(p_assignment);
  return jsonb_build_object(
    'mastery', coalesce((select jsonb_agg(jsonb_build_object('g', g, 'l', l, 'lv', lv, 't', t, 'm', m, 'w', w)) from (
        select q.g, q.l, q.lv, q.t, sum(ai.m * case q.t when 'TF' then 4 when 'SA' then 2 else 1 end) m,
               sum(case q.t when 'TF' then 4 when 'SA' then 2 else 1 end) w
        from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id join public.questions q on q.id = ai.qid
        where a.assignment_id = p_assignment and a.status = 'done' group by q.g, q.l, q.lv, q.t) z), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('qid', qid, 't', t, 'lv', lv, 'g', g, 'l', l, 'n', n, 'm', m, 'cw', cw, 'q', qq, 'o', oo, 'tag', tag)
                           order by m, n desc) from (
        select q.id qid, q.t, q.lv, q.g, q.l, q.q qq, q.o oo, q.tag, count(*) n, round(avg(ai.m), 3) m,
               count(*) filter (where ai.conf = 1 and ai.status in ('bad', 'part')) cw
        from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id join public.questions q on q.id = ai.qid
        where a.assignment_id = p_assignment and a.status = 'done' group by q.id) y), '[]'::jsonb),
    'scores', coalesce((select jsonb_agg(score) from public.attempts where assignment_id = p_assignment and status = 'done'), '[]'::jsonb));
end $$
;
-- t_student_update
CREATE OR REPLACE FUNCTION public.t_student_update(p_id uuid, p_name text DEFAULT NULL::text, p_reset_pin boolean DEFAULT false, p_unlock boolean DEFAULT false, p_active boolean DEFAULT NULL::boolean, p_delete boolean DEFAULT false, p_hide_rank boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_student(p_id);
  if p_delete then delete from public.students where id = p_id; return '{"ok":true}'::jsonb; end if;
  update public.students set
    full_name = coalesce(nullif(btrim(p_name), ''), full_name),
    pin = case when p_reset_pin then lpad((floor(random() * 1000000))::int::text, 6, '0') else pin end,
    failed = case when p_unlock or p_reset_pin then 0 else failed end,
    active = coalesce(p_active, active),
    hide_rank = coalesce(p_hide_rank, hide_rank)
  where id = p_id;
  if p_reset_pin or p_active = false then delete from public.student_sessions where student_id = p_id; end if;
  return '{"ok":true}'::jsonb;
end $$
;
-- t_students
CREATE OR REPLACE FUNCTION public.t_students(p_class bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_class(p_class);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'code', code, 'pin', pin, 'name', full_name,
                  'failed', failed, 'active', active, 'xp', xp, 'hide_rank', hide_rank) order by code) from public.students where class_id = p_class and status <> 'pending'), '[]'::jsonb);
end $$
;
-- t_students_add
CREATE OR REPLACE FUNCTION public.t_students_add(p_class bigint, p_names jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare cname text; pre text; nm text; k int; code text;
begin
  perform public._need_teacher();
  perform public._own_class(p_class);
  select name into cname from public.classes where id = p_class;
  if cname is null then raise exception 'Không tìm thấy lớp'; end if;
  pre := upper(regexp_replace(cname, '[^A-Za-z0-9]', '', 'g'));
  if pre = '' then pre := 'L' || p_class::text; end if;
  select coalesce(max(nullif(regexp_replace(s.code, '^.*-', ''), '')::int), 0) into k
    from public.students s where s.code ~ ('^' || pre || '-[0-9]+$');
  for nm in select btrim(x) from jsonb_array_elements_text(p_names) x where btrim(x) <> '' loop
    k := k + 1;
    code := pre || '-' || lpad(k::text, 2, '0');
    insert into public.students(code, pin, full_name, class_id)
    values (code, lpad((floor(random() * 1000000))::int::text, 6, '0'), nm, p_class);
  end loop;
  return public.t_students(p_class);
end $$
;
-- t_live_poll
CREATE OR REPLACE FUNCTION public.t_live_poll(p_id bigint, p_seconds integer, p_qid text DEFAULT NULL::text, p_q text DEFAULT NULL::text, p_o jsonb DEFAULT NULL::jsonb, p_key integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare q public.questions; k int; nid bigint; secs int := least(greatest(coalesce(p_seconds, 30), 10), 600);
begin
  perform public._need_teacher();
  perform public._own_live(p_id);
  update public.live_polls set status = 'closed', closes_at = least(closes_at, now()) where session_id = p_id and status = 'open';
  if p_qid is not null then
    select * into q from public.questions where id = p_qid and t = 'MC';
    if not found then return jsonb_build_object('error', 'Không tìm thấy câu trắc nghiệm này.'); end if;
    select (a.k #>> '{}')::int into k from public.answers a where a.qid = q.id;
    insert into public.live_polls(session_id, qid, q, o, key, seconds, closes_at)
    values (p_id, q.id, q.q, q.o, k, secs, now() + make_interval(secs => secs)) returning id into nid;
  else
    if p_o is null or jsonb_array_length(p_o) < 2 then return jsonb_build_object('error', 'Cần ít nhất 2 phương án.'); end if;
    insert into public.live_polls(session_id, q, o, key, seconds, closes_at)
    values (p_id, coalesce(p_q, ''), p_o, case when p_key between 0 and jsonb_array_length(p_o) - 1 then p_key end, secs, now() + make_interval(secs => secs))
    returning id into nid;
  end if;
  return jsonb_build_object('ok', true, 'id', nid);
end $$
;
-- t_live_state
CREATE OR REPLACE FUNCTION public.t_live_state(p_id bigint, p_after bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare s public.live_sessions;
begin
  perform public._need_teacher();
  perform public._own_live(p_id);
  select * into s from public.live_sessions where id = p_id;
  if not found then return jsonb_build_object('error', 'Không tìm thấy buổi học.'); end if;
  update public.live_polls set status = 'closed' where session_id = s.id and status = 'open' and now() > closes_at;
  return jsonb_build_object(
    'session', public._live_card(s) || jsonb_build_object('yt_url', s.yt_url, 'yt_vid', s.yt_vid, 'class_ids', to_jsonb(s.class_ids)),
    'server_now', now(),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'code', st.code, 'name', st.full_name, 'class', c.name,
                 'joined', p.student_id is not null, 'online', p.last_at > now() - interval '25 seconds', 'first_at', p.first_at,
                 'seconds', p.seconds, 'dup', coalesce(p.dup_n, 0),
                 'answered', (select count(*) from public.live_answers a join public.live_polls x on x.id = a.poll_id where x.session_id = s.id and a.student_id = st.id),
                 'correct', (select count(*) from public.live_answers a join public.live_polls x on x.id = a.poll_id where x.session_id = s.id and a.student_id = st.id and a.ok))
               order by (p.last_at > now() - interval '25 seconds') desc nulls last, st.code)
             from public.students st join public.classes c on c.id = st.class_id
             left join public.live_presence p on p.session_id = s.id and p.student_id = st.id
            where st.class_id = any(s.class_ids) and st.active), '[]'::jsonb),
    'polls', coalesce((select jsonb_agg(jsonb_build_object('id', pl.id, 'q', pl.q, 'o', pl.o, 'key', pl.key, 'status', pl.status, 'seconds', pl.seconds,
                 'left_ms', greatest(0, (extract(epoch from pl.closes_at - now()) * 1000)::int), 'opened_at', pl.opened_at,
                 'n', (select count(*) from public.live_answers a where a.poll_id = pl.id),
                 'n_ok', (select count(*) from public.live_answers a where a.poll_id = pl.id and a.ok),
                 'counts', (select coalesce(jsonb_agg(cnt order by i), '[]'::jsonb) from (
                     select i, (select count(*) from public.live_answers a where a.poll_id = pl.id and a.ans = i) cnt
                     from generate_series(0, greatest(jsonb_array_length(pl.o), 1) - 1) i) z),
                 'fastest', (select coalesce(jsonb_agg(nm), '[]'::jsonb) from (select st.full_name nm from public.live_answers a join public.students st on st.id = a.student_id
                              where a.poll_id = pl.id and a.ok order by a.ms limit 3) f))
               order by pl.id desc)
             from public.live_polls pl where pl.session_id = s.id), '[]'::jsonb),
    'chat', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 't', c.student_id is null, 'msg', c.msg, 'at', c.created_at, 'hidden', c.hidden) order by c.id)
             from (select * from public.live_chat where session_id = s.id and id > coalesce(p_after, 0) order by id desc limit 100) c), '[]'::jsonb));
end $$
;
-- t_live_status
CREATE OR REPLACE FUNCTION public.t_live_status(p_id bigint, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_live(p_id);
  if p_status = 'live' then
    if (select yt_vid from public.live_sessions where id = p_id) is null then
      return jsonb_build_object('error', 'Chưa có link YouTube của buổi live. Bấm “Sửa” để dán link trước khi bắt đầu.'); end if;
    update public.live_sessions set status = 'live', started_at = coalesce(started_at, now()), ended_at = null where id = p_id;
  elsif p_status = 'ended' then
    update public.live_sessions set status = 'ended', ended_at = now() where id = p_id;
    update public.live_polls set status = 'closed' where session_id = p_id and status = 'open';
  elsif p_status = 'delete' then
    delete from public.live_sessions where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$
;
-- t_live_poll_set
CREATE OR REPLACE FUNCTION public.t_live_poll_set(p_poll bigint, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_live((select session_id from public.live_polls where id = p_poll));
  if p_action = 'close' then update public.live_polls set status = 'closed', closes_at = least(closes_at, now()) where id = p_poll and status = 'open';
  elsif p_action = 'reveal' then update public.live_polls set status = 'revealed', closes_at = least(closes_at, now()) where id = p_poll;
  elsif p_action = 'add30' then update public.live_polls set closes_at = greatest(closes_at, now()) + interval '30 seconds', status = 'open' where id = p_poll and status <> 'revealed';
  end if;
  return jsonb_build_object('ok', true);
end $$
;
-- t_live_chat
CREATE OR REPLACE FUNCTION public.t_live_chat(p_id bigint, p_msg text DEFAULT NULL::text, p_hide bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._own_live(p_id);
  if p_hide is not null then update public.live_chat set hidden = not hidden where id = p_hide and session_id = p_id;
  elsif btrim(coalesce(p_msg, '')) <> '' then insert into public.live_chat(session_id, name, msg) values (p_id, coalesce((select nullif(btrim(title), '') from public.teachers where user_id = auth.uid()), 'Thầy'), left(btrim(p_msg), 500));
  end if;
  return jsonb_build_object('ok', true);
end $$
;
-- t_live_list
CREATE OR REPLACE FUNCTION public.t_live_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  return coalesce((select jsonb_agg(public._live_card(s) || jsonb_build_object(
      'yt_url', s.yt_url, 'class_ids', to_jsonb(s.class_ids),
      'n_students', (select count(*) from public.students x where x.class_id = any(s.class_ids) and x.active),
      'n_joined', (select count(*) from public.live_presence p where p.session_id = s.id),
      'n_polls', (select count(*) from public.live_polls p where p.session_id = s.id))
    order by (public._live_status(s) = 'live') desc, (public._live_status(s) = 'ended'), case when public._live_status(s) = 'ended' then -extract(epoch from s.starts_at) else extract(epoch from s.starts_at) end)
    from public.live_sessions s where s.starts_at > now() - interval '60 days' and s.owner = auth.uid()), '[]'::jsonb);
end $$
;
-- t_live_save
CREATE OR REPLACE FUNCTION public.t_live_save(p_id bigint, p_title text, p_classes jsonb, p_starts timestamp with time zone, p_minutes integer, p_url text, p_g integer DEFAULT NULL::integer, p_l integer DEFAULT NULL::integer, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare pv text[]; cls bigint[]; nid bigint;
begin
  perform public._need_teacher();
  if btrim(coalesce(p_title, '')) = '' then return jsonb_build_object('error', 'Nhập tên buổi học.'); end if;
  cls := array(select (jsonb_array_elements_text(coalesce(p_classes, '[]'::jsonb)))::bigint);
  if cardinality(cls) = 0 then return jsonb_build_object('error', 'Chọn ít nhất một lớp.'); end if;
  if exists (select 1 from unnest(cls) c where not public._can(c)) then return jsonb_build_object('error', 'Có lớp không thuộc quyền quản lí của bạn.'); end if;
  if p_id is not null then perform public._own_live(p_id); end if;
  if p_starts is null then return jsonb_build_object('error', 'Chọn giờ bắt đầu.'); end if;
  if btrim(coalesce(p_url, '')) <> '' then
    pv := public._video_parse(p_url);
    if pv is null or pv[1] <> 'yt' then return jsonb_build_object('error', 'Link YouTube chưa đúng. Dán link buổi live dạng https://www.youtube.com/live/… hoặc https://youtu.be/…'); end if;
  end if;
  if p_id is null then
    insert into public.live_sessions(owner, title, class_ids, g, l, yt_url, yt_vid, starts_at, minutes, note)
    values (auth.uid(), left(btrim(p_title), 150), cls, p_g, p_l, btrim(coalesce(p_url, '')), pv[2], p_starts, least(greatest(coalesce(p_minutes, 90), 10), 300), left(coalesce(p_note, ''), 500))
    returning id into nid;
  else
    update public.live_sessions set title = left(btrim(p_title), 150), class_ids = cls, g = p_g, l = p_l, yt_url = btrim(coalesce(p_url, '')), yt_vid = pv[2],
           starts_at = p_starts, minutes = least(greatest(coalesce(p_minutes, 90), 10), 300), note = left(coalesce(p_note, ''), 500)
     where id = p_id returning id into nid;
  end if;
  return jsonb_build_object('ok', true, 'id', nid);
end $$
;
-- t_flagged
CREATE OR REPLACE FUNCTION public.t_flagged(p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  return coalesce((select jsonb_agg(z order by z ->> 'submitted_at' desc) from (
    select jsonb_build_object('attempt', t.id, 'title', t.title, 'kind', t.kind, 'score', t.score, 'submitted_at', t.submitted_at,
             'code', s.code, 'name', s.full_name, 'class', c.name, 'assigned', t.assignment_id is not null,
             'leaves', t.leaves, 'away_s', t.away_s, 'copy_n', t.copy_n, 'flags', fl) z
      from public.attempts t join public.students s on s.id = t.student_id left join public.classes c on c.id = s.class_id
      cross join lateral (select public._flags(t.id) fl) f
     where t.status = 'done' and t.submitted_at > now() - make_interval(days => greatest(p_days, 1))
       and (t.leaves >= 3 or t.away_s >= 60 or t.copy_n >= 3 or t.score >= 7)
       and jsonb_array_length(fl) > 0 and public._mine(s.class_id)
     order by t.submitted_at desc limit 300) q), '[]'::jsonb);
end $$
;
-- t_pending
CREATE OR REPLACE FUNCTION public.t_pending()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  return jsonb_build_object(
    'admin', public._is_admin(),
    'open', coalesce((select (value)::boolean from public.settings where key = 'register_open'), true),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.full_name, 'class', c.name,
                   'phone', s.phone, 'note', s.note, 'at', s.created_at) order by s.created_at)
              from public.students s left join public.classes c on c.id = s.class_id where s.status = 'pending' and public._mine(s.class_id)), '[]'::jsonb));
end $$
;
-- t_approve
CREATE OR REPLACE FUNCTION public.t_approve(p_ids jsonb, p_approve boolean, p_class bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare n int;
begin
  perform public._need_teacher();
  perform public._own_class(p_class);
  if p_approve then
    update public.students set status = 'active', active = true, failed = 0, class_id = coalesce(p_class, class_id)
     where status = 'pending' and public._can(class_id) and id = any(array(select (jsonb_array_elements_text(p_ids))::uuid));
  else
    delete from public.students
     where status = 'pending' and public._can(class_id) and id = any(array(select (jsonb_array_elements_text(p_ids))::uuid));
  end if;
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$
;
-- t_student_move
CREATE OR REPLACE FUNCTION public.t_student_move(p_ids jsonb, p_class bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare n int;
begin
  perform public._need_teacher();
  perform public._own_class(p_class);
  if not exists (select 1 from public.classes where id = p_class) then
    return jsonb_build_object('error', 'Không tìm thấy lớp.');
  end if;
  update public.students set class_id = p_class
   where public._can(class_id) and id = any(array(select (jsonb_array_elements_text(p_ids))::uuid)) and class_id is distinct from p_class;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end $$
;
-- t_class_save
CREATE OR REPLACE FUNCTION public.t_class_save(p_name text, p_grade integer, p_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare nid bigint;
begin
  perform public._need_teacher();
  if p_id is null then
    if exists (select 1 from public.classes where lower(name) = lower(btrim(p_name)) and id is distinct from p_id) then
      return jsonb_build_object('error', 'Tên lớp này đã có trên hệ thống (có thể của giáo viên khác). Đặt tên khác, ví dụ ' || btrim(p_name) || '-B.');
    end if;
    insert into public.classes(name, grade, owner) values (btrim(p_name), p_grade, auth.uid()) returning id into nid;
  else
    perform public._own_class(p_id);
    if exists (select 1 from public.classes where lower(name) = lower(btrim(p_name)) and id <> p_id) then
      return jsonb_build_object('error', 'Tên lớp này đã có trên hệ thống. Đặt tên khác.');
    end if;
    update public.classes set name = btrim(p_name), grade = p_grade where id = p_id returning id into nid;
  end if;
  return jsonb_build_object('id', nid);
end $$
;
-- t_overview
CREATE OR REPLACE FUNCTION public.t_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  perform public._need_teacher();
  perform public._finalize_expired();
  return jsonb_build_object(
    'server_now', now(),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade,
        'n', (select count(*) from public.students s where s.class_id = c.id and s.status <> 'pending')) order by c.name) from public.classes c where c.owner = auth.uid()), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'kind', a.kind, 'grade', a.grade,
        'class_id', a.class_id, 'class', c.name, 'opens_at', a.opens_at, 'closes_at', a.closes_at, 'max_attempts', a.max_attempts,
        'show_answers', a.show_answers, 'minutes', (a.blueprint ->> 'minutes')::int,
        'n_students', (select count(*) from public.students s where s.class_id = a.class_id and s.active),
        'n_doing', (select count(distinct student_id) from public.attempts t where t.assignment_id = a.id and t.status = 'doing'),
        'n_done', (select count(distinct student_id) from public.attempts t where t.assignment_id = a.id and t.status = 'done'),
        'avg', (select round(avg(score), 2) from public.attempts t where t.assignment_id = a.id and t.status = 'done')
      ) order by a.created_at desc) from public.assignments a join public.classes c on c.id = a.class_id where c.owner = auth.uid()), '[]'::jsonb),
    'bank', public.bank_stats(),
    'n_figs', (select count(*) from public.figs),
    'n_pending', (select count(*) from public.students where status = 'pending' and public._mine(class_id)),
    'me', public.t_me(),
    'n_tpending', case when public._is_admin() then (select count(*) from auth.users u where not exists (select 1 from public.teachers t where t.user_id = u.id) and not exists (select 1 from public.teacher_rejects r where r.user_id = u.id)) else 0 end);
end $$
;
-- _my_rank
CREATE OR REPLACE FUNCTION public._my_rank(p_student uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  with w as (
    select s.id, coalesce(sum(t.xp), 0) wx, s.xp from public.students s
    left join public.attempts t on t.student_id = s.id and t.status = 'done' and t.submitted_at >= public._week_start()
    where s.active and not s.hide_rank and public._class_owner(s.class_id) = public._class_owner((select class_id from public.students where id = p_student))
    group by s.id, s.xp
  ), me as (select * from w where id = p_student)
  select jsonb_build_object(
    'week_xp', (select wx from me),
    'week_rank', case when (select wx from me) > 0 then (select count(*) + 1 from w where wx > (select wx from me)) end,
    'all_rank', case when (select xp from me) > 0 then (select count(*) + 1 from w where xp > (select xp from me)) end,
    'hidden', (select hide_rank from public.students where id = p_student))
$$
;
-- leaderboard
drop function if exists public.leaderboard(integer);
CREATE OR REPLACE FUNCTION public.leaderboard(p_limit integer DEFAULT 10, p_token uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare ws timestamptz := public._week_start(); lim int := least(greatest(coalesce(p_limit, 10), 1), 50); own uuid;
begin
  -- bảng xếp hạng riêng cho học sinh của từng giáo viên (trang đăng nhập: học sinh của quản trị)
  own := case when p_token is not null then public._class_owner((select class_id from public.students where id = public._sess(p_token)))
              else public._class_owner(null) end;
  return jsonb_build_object(
    'week_start', ws,
    'week', coalesce((select jsonb_agg(x order by (x ->> 'w')::int desc, x ->> 'name') from (
        select jsonb_build_object('name', public._short_name(s.full_name), 'class', c.name, 'xp', s.xp, 'w', sum(t.xp)::int) x
        from public.attempts t join public.students s on s.id = t.student_id left join public.classes c on c.id = s.class_id
        where t.status = 'done' and t.submitted_at >= ws and s.active and not s.hide_rank and public._class_owner(s.class_id) = own
        group by s.id, s.full_name, c.name, s.xp having sum(t.xp) > 0
        order by sum(t.xp) desc limit lim) z), '[]'::jsonb),
    'all', coalesce((select jsonb_agg(x order by (x ->> 'xp')::int desc, x ->> 'name') from (
        select jsonb_build_object('name', public._short_name(s.full_name), 'class', c.name, 'xp', s.xp) x
        from public.students s left join public.classes c on c.id = s.class_id
        where s.active and not s.hide_rank and s.xp > 0 and public._class_owner(s.class_id) = own
        order by s.xp desc limit lim) z), '[]'::jsonb));
end $$
;
-- register_info
CREATE OR REPLACE FUNCTION public.register_info()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  select jsonb_build_object(
    'open', coalesce((select (value)::boolean from public.settings where key = 'register_open'), true),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade, 'teacher', t.title) order by c.grade, c.name) from public.classes c left join public.teachers t on t.user_id = c.owner where t.active is not false), '[]'::jsonb))
$$
;
-- student_home
CREATE OR REPLACE FUNCTION public.student_home(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare sid uuid; s public.students; res jsonb;
begin
  sid := public._sess(p_token);
  perform public._finalize_expired();
  select * into s from public.students where id = sid;
  select jsonb_build_object(
    'student', jsonb_build_object('name', s.full_name, 'code', s.code,
                                  'class', (select name from public.classes where id = s.class_id),
                                  'teacher', (select t.title from public.classes c join public.teachers t on t.user_id = c.owner where c.id = s.class_id)),
    'server_now', now(),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'kind', a.kind, 'grade', a.grade, 'opens_at', a.opens_at, 'closes_at', a.closes_at,
        'minutes', (a.blueprint ->> 'minutes')::int, 'max_attempts', a.max_attempts,
        'n_q', coalesce((a.blueprint -> 'counts' ->> 'MC')::int, 0) + coalesce((a.blueprint -> 'counts' ->> 'TF')::int, 0) + coalesce((a.blueprint -> 'counts' ->> 'SA')::int, 0),
        'done', (select count(*) from public.attempts t where t.assignment_id = a.id and t.student_id = sid and t.status = 'done'),
        'doing', (select t.id from public.attempts t where t.assignment_id = a.id and t.student_id = sid and t.status = 'doing' limit 1),
        'best', (select max(score) from public.attempts t where t.assignment_id = a.id and t.student_id = sid and t.status = 'done'),
        'last_attempt', (select t.id from public.attempts t where t.assignment_id = a.id and t.student_id = sid and t.status = 'done' order by t.submitted_at desc limit 1),
        'remedial', (select r.id from public.remedials r where r.assignment_id = a.id and r.student_id = sid and r.status = 'pending' order by r.id desc limit 1)
      ) order by a.closes_at)
      from public.assignments a
      where a.class_id = s.class_id and a.closes_at > now() - interval '14 days'), '[]'::jsonb),
    'doing', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'ends_at', ends_at))
                       from public.attempts where student_id = sid and status = 'doing' and assignment_id is null), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(x order by x ->> 'submitted_at' desc) from (
        select jsonb_build_object('id', id, 'title', title, 'kind', kind, 'grade', grade, 'score', score,
                                  'submitted_at', submitted_at, 'n', n_items, 'assigned', assignment_id is not null) x
        from public.attempts where student_id = sid and status = 'done' order by submitted_at desc limit 60) h), '[]'::jsonb),
    'mastery', coalesce((select jsonb_agg(jsonb_build_object('g', g, 'l', l, 'lv', lv, 't', t, 'm', m, 'w', w)) from (
        select q.g, q.l, q.lv, q.t, sum(ai.m * case q.t when 'TF' then 4 when 'SA' then 2 else 1 end) m,
               sum(case q.t when 'TF' then 4 when 'SA' then 2 else 1 end) w
        from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id join public.questions q on q.id = ai.qid
        where a.student_id = sid and a.status = 'done' group by q.g, q.l, q.lv, q.t) z), '[]'::jsonb),
    'mission', (select jsonb_build_object('id', t.id, 'status', t.status, 'score', t.score, 'n', t.n_items, 'ends_at', t.ends_at)
                from public.attempts t where t.student_id = sid and t.kind = 'Nhiệm vụ hôm nay'
                 and (t.started_at at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date
                order by t.id desc limit 1),
    'review', (select jsonb_build_object(
                 'due', count(*) filter (where done_at is null and due_at <= now() + interval '6 hours'),
                 'total', count(*) filter (where done_at is null),
                 'cw', count(*) filter (where done_at is null and confident_wrong),
                 'mastered', count(*) filter (where done_at is not null),
                 'next', min(due_at) filter (where done_at is null))
               from public.review_items where student_id = sid),
    'streak', public._streak(sid),
    'remedials', coalesce((select jsonb_agg(public._remedial_json(r) order by r.id desc) from public.remedials r
                           where r.student_id = sid and r.status = 'pending'), '[]'::jsonb),
    'xp', s.xp,
    'rank', public._my_rank(sid)
  ) into res;
  return res;
end $$
;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('is_teacher', '_is_admin', '_need_teacher', '_need_admin', '_can', '_mine', '_own_class', '_own_assignment',
             '_own_student', '_own_attempt', '_own_live', '_class_owner', 't_me', 't_admin_teachers', 't_admin_teacher_set', 'leaderboard') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname = 'leaderboard' then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname like 't\_%' or f.proname in ('is_teacher', '_is_admin') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
