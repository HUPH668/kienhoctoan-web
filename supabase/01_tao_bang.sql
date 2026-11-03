-- =====================================================================
--  KIỂM TRA TOÁN – cơ sở dữ liệu (Supabase / PostgreSQL)
--  Cách dùng: Supabase > SQL Editor > New query > dán toàn bộ file > Run
--  Chạy lại nhiều lần được (an toàn): chỉ tạo mới cái chưa có, cập nhật hàm.
-- =====================================================================

-- ---------------------------------------------------------------- BẢNG
create table if not exists public.teachers (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id text primary key,                 -- ID duy nhất của câu
  g int not null,                      -- lớp
  l int not null,                      -- bài (số bài trong SGK)
  lv text not null default 'TH',       -- NB / TH / VD / VDC
  lg boolean not null default false,   -- mức độ là ước lượng
  t text not null check (t in ('MC','TF','SA')),
  q text not null,                     -- đề (HTML + LaTeX)
  o jsonb not null default '[]',       -- phương án / mệnh đề
  s text not null default '',          -- lời giải
  src text, tag text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists questions_gl_idx on public.questions (g, l, t) where active;

create table if not exists public.answers (     -- đáp án: tách riêng, không ai đọc trực tiếp được
  qid text primary key references public.questions(id) on delete cascade,
  k jsonb not null
);

create table if not exists public.figs (
  id text primary key,
  svg text not null
);

create table if not exists public.classes (
  id bigint generated always as identity primary key,
  name text not null unique,
  grade int,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- mã đăng nhập, vd 10A1-07
  pin text not null,                   -- mã PIN 6 số
  full_name text not null,
  class_id bigint references public.classes(id) on delete cascade,
  failed int not null default 0,       -- số lần nhập sai PIN liên tiếp
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_sessions (
  token uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 days'
);

create table if not exists public.assignments (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes(id) on delete cascade,
  title text not null,
  kind text not null,
  grade int,
  blueprint jsonb not null,            -- cấu trúc đề (khuôn đề)
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  max_attempts int not null default 1,
  show_answers boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  assignment_id bigint references public.assignments(id) on delete cascade,
  title text not null,
  kind text not null,
  grade int,
  blueprint jsonb not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'doing',   -- doing / done
  score numeric,
  n_items int not null default 0,
  n_answered int not null default 0,
  last_seen timestamptz default now()
);
create index if not exists attempts_student_idx on public.attempts (student_id);
create index if not exists attempts_assign_idx on public.attempts (assignment_id);
create index if not exists attempts_doing_idx on public.attempts (ends_at) where status = 'doing';

create table if not exists public.attempt_items (
  attempt_id bigint not null references public.attempts(id) on delete cascade,
  idx int not null,
  qid text not null references public.questions(id),
  perm int[],            -- thứ tự phương án đã xáo (câu nhiều phương án)
  ans jsonb,
  m numeric, u numeric, w numeric, status text,
  primary key (attempt_id, idx)
);
create index if not exists attempt_items_qid_idx on public.attempt_items (qid);
alter table public.attempt_items add column if not exists conf smallint;   -- 1 = chắc chắn, 0 = đoán
alter table public.attempt_items add column if not exists rv bigint;       -- câu này dùng để ôn mục nào trong sổ câu sai

-- sổ câu sai: mỗi học sinh – mỗi câu gốc một dòng; ôn theo lịch 1 – 3 – 7 – 21 ngày
create table if not exists public.review_items (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  qid text not null references public.questions(id) on delete cascade,
  box int not null default 0,              -- 0..3: số lần ôn đúng liên tiếp
  due_at timestamptz not null,             -- hẹn ôn lúc
  wrong_n int not null default 1,          -- số lần sai
  confident_wrong boolean not null default false,   -- sai dù đã chọn "chắc chắn"
  done_at timestamptz,                     -- đã thuộc (ôn đúng đủ 4 lần)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, qid)
);
create index if not exists review_due_idx on public.review_items (student_id, due_at) where done_at is null;

-- thăng cấp: tổng kinh nghiệm của học sinh, kinh nghiệm nhận được ở từng bài
alter table public.students add column if not exists xp int not null default 0;
alter table public.students add column if not exists hide_rank boolean not null default false;   -- không hiện trên bảng vinh danh
alter table public.attempts add column if not exists xp int;
create index if not exists attempts_week_idx on public.attempts (submitted_at) where status = 'done';

-- học sinh tự đăng ký: chờ giáo viên duyệt
alter table public.students add column if not exists status text not null default 'active';   -- active / pending
alter table public.students add column if not exists phone text;
alter table public.students add column if not exists note text;
create index if not exists students_pending_idx on public.students (created_at) where status = 'pending';
create table if not exists public.settings (
  key text primary key,
  value text
);

-- bài bổ sung: sau bài kiểm tra, các bài học em làm dưới 50% → phải làm bài NB–TH trước khi làm lại
create table if not exists public.remedials (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  source_attempt bigint not null unique references public.attempts(id) on delete cascade,
  assignment_id bigint references public.assignments(id) on delete cascade,
  src_kind text, src_title text, src_lessons text[], src_score numeric,
  lessons text[] not null,                 -- bài cần bổ sung, dạng 'khối-bài'
  detail jsonb,                            -- [{key, m, n}] tỉ lệ đúng của từng bài ở bài kiểm tra gốc
  attempt_id bigint references public.attempts(id) on delete set null,
  status text not null default 'pending',  -- pending / done
  score numeric,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists remedials_student_idx on public.remedials (student_id, status);
create index if not exists remedials_attempt_idx on public.remedials (attempt_id);

-- ---------------------------------------------------------------- BẢO MẬT
alter table public.teachers enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.figs enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_sessions enable row level security;
alter table public.assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_items enable row level security;
alter table public.review_items enable row level security;
alter table public.settings enable row level security;
alter table public.remedials enable row level security;
-- Không có policy cho anon => học sinh KHÔNG đọc/ghi bảng trực tiếp được;
-- mọi thao tác đi qua các hàm bên dưới (kiểm tra phiên đăng nhập).

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teachers where user_id = auth.uid())
$$;

do $$
declare t text;
begin
  foreach t in array array['questions','answers','figs','classes','students','assignments','attempts','attempt_items','review_items','settings'] loop
    execute format('drop policy if exists teacher_all on public.%I', t);
    execute format('create policy teacher_all on public.%I for all to authenticated using (public.is_teacher()) with check (public.is_teacher())', t);
  end loop;
  drop policy if exists teacher_self on public.teachers;
  create policy teacher_self on public.teachers for select to authenticated using (user_id = auth.uid());
end $$;

-- ---------------------------------------------------------------- HÀM NỘI BỘ
create or replace function public._need_teacher() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then
    raise exception 'Tài khoản này chưa được cấp quyền giáo viên';
  end if;
end $$;

create or replace function public._sess(p_token uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare sid uuid;
begin
  select s.student_id into sid from public.student_sessions s join public.students st on st.id = s.student_id
   where s.token = p_token and s.expires_at > now() and st.active;
  if sid is null then raise exception 'SESSION_EXPIRED'; end if;
  return sid;
end $$;

-- chuẩn hoá đáp số trả lời ngắn -> số (hoặc null)
create or replace function public._sa_num(x text) returns numeric
language plpgsql immutable as $$
declare s text; p text[];
begin
  s := lower(coalesce(x, ''));
  s := regexp_replace(s, '\s|\$|\\,|\\;|\\!', '', 'g');
  s := replace(replace(s, '−', '-'), '{,}', ',');
  s := regexp_replace(s, '\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}', '(\1)/(\2)', 'g');
  s := regexp_replace(s, '[{}]', '', 'g');
  s := replace(s, ',', '.');
  if s ~ '^[-+]?[0-9]+(\.[0-9]+)?$' then return s::numeric; end if;
  p := regexp_match(s, '^\(?([-+]?[0-9]+(?:\.[0-9]+)?)\)?/\(?([-+]?[0-9]+(?:\.[0-9]+)?)\)?$');
  if p is not null and p[2]::numeric <> 0 then return p[1]::numeric / p[2]::numeric; end if;
  if s ~ '^-\(?[0-9]+(\.[0-9]+)?\)?/\(?[0-9]+(\.[0-9]+)?\)?$' then
    return -public._sa_num(substr(s, 2));
  end if;
  return null;
end $$;

create or replace function public._sa_ok(a text, k text) returns boolean
language plpgsql immutable as $$
declare na numeric; nk numeric;
begin
  if a is null or btrim(a) = '' then return false; end if;
  na := public._sa_num(a); nk := public._sa_num(k);
  if na is not null and nk is not null then
    return abs(na - nk) <= 0.000000001 * greatest(1, abs(nk))
        or ((k ~ '[.,]') and abs(na - nk) < 0.005);
  end if;
  return lower(regexp_replace(a, '\s|\$', '', 'g')) = lower(regexp_replace(k, '\s|\$', '', 'g'));
end $$;

create or replace function public._answered(a jsonb) returns boolean
language sql immutable as $$
  select case
    when a is null or a = 'null'::jsonb then false
    when jsonb_typeof(a) = 'array' then jsonb_array_length(a) = 4
         and not exists (select 1 from jsonb_array_elements(a) e where e = 'null'::jsonb)
    when jsonb_typeof(a) = 'string' then length(btrim(a #>> '{}')) > 0
    else true end
$$;

-- bốc ngẫu nhiên n câu; rải đều theo (bài, mức độ); ưu tiên câu học sinh chưa gặp
create or replace function public._pick(p_student uuid, p_lessons text[], p_t text, p_g int, p_levels text[],
                                        p_n int, p_exclude text[], p_prefer_wrong boolean)
returns text[] language sql volatile security definer set search_path = public as $$
  with seen as (
    select ai.qid, count(*) as cnt, bool_or(ai.status in ('bad','part','skip')) as wrong
    from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id
    where a.student_id = p_student group by ai.qid
  ), pool as (
    select q.id, q.g, q.l, q.lv, coalesce(s.cnt, 0) as cnt,
           case when p_prefer_wrong and coalesce(s.wrong, false) then -10 else 0 end as pri
    from public.questions q left join seen s on s.qid = q.id
    where q.active and q.t = p_t
      and (q.g::text || '-' || q.l::text) = any(p_lessons)
      and (p_g is null or q.g = p_g)
      and (p_levels is null or cardinality(p_levels) = 0 or q.lv = any(p_levels))
      and not (q.id = any(coalesce(p_exclude, '{}')))
  ), ranked as (
    select id, row_number() over (partition by g, l, lv order by pri + cnt, random()) as rn, pri
    from pool
  )
  select coalesce(array(select id from ranked order by pri, rn, random() limit greatest(p_n, 0)), '{}')
$$;

-- nội dung bài làm gửi cho học sinh (có/không kèm đáp án)
create or replace function public._payload(p_attempt bigint, p_keys boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; items jsonb; fg jsonb; aname text;
begin
  select * into a from public.attempts where id = p_attempt;
  select jsonb_agg(jsonb_build_object(
      'idx', ai.idx, 'qid', ai.qid, 't', q.t, 'lv', q.lv, 'lg', q.lg, 'g', q.g, 'l', q.l, 'q', q.q,
      'o', case when q.t = 'MC' and ai.perm is not null
                then (select jsonb_agg(q.o -> ai.perm[i] order by i) from generate_subscripts(ai.perm, 1) i)
                else q.o end,
      'ans', ai.ans, 'conf', ai.conf, 'rv', ai.rv is not null
    ) || case when a.status = 'done' then jsonb_build_object('m', ai.m, 'u', ai.u, 'w', ai.w, 'status', ai.status) else '{}'::jsonb end
      || case when p_keys then jsonb_build_object(
      'key', case when q.t = 'MC' and ai.perm is not null
                  then to_jsonb(array_position(ai.perm, (an.k #>> '{}')::int) - 1) else an.k end,
      's', q.s) else '{}'::jsonb end
    order by ai.idx)
  into items
  from public.attempt_items ai join public.questions q on q.id = ai.qid
  left join public.answers an on an.qid = ai.qid
  where ai.attempt_id = p_attempt;

  select coalesce(jsonb_object_agg(f.id, f.svg), '{}'::jsonb) into fg
  from public.figs f
  where f.id in (
    select (regexp_matches(q.q || ' ' || q.o::text || case when p_keys then ' ' || q.s else '' end,
                           'data-fig=\\?"([0-9a-f]+)', 'g'))[1]
    from public.attempt_items ai join public.questions q on q.id = ai.qid
    where ai.attempt_id = p_attempt);

  select st.full_name into aname from public.students st where st.id = a.student_id;
  return jsonb_build_object(
    'id', a.id, 'title', a.title, 'kind', a.kind, 'grade', a.grade, 'assignment_id', a.assignment_id,
    'started_at', a.started_at, 'ends_at', a.ends_at, 'submitted_at', a.submitted_at, 'status', a.status,
    'score', a.score, 'n_items', a.n_items, 'xp', a.xp, 'student_xp', (select xp from public.students where id = a.student_id), 'weights', coalesce(a.blueprint -> 'weights', '{"MC":1,"TF":4,"SA":2}'::jsonb),
    'server_now', now(), 'student', aname, 'keys', p_keys,
    'remedial', (select public._remedial_json(r) from public.remedials r where r.source_attempt = a.id),
    'remedial_of', (select public._remedial_json(r) from public.remedials r where r.attempt_id = a.id),
    'retake_left', case when a.assignment_id is not null then (select greatest(x.max_attempts - (select count(*) from public.attempts y where y.assignment_id = x.id and y.student_id = a.student_id and y.status = 'done'), 0)
                         from public.assignments x where x.id = a.assignment_id and x.closes_at > now()) end,
    'items', coalesce(items, '[]'::jsonb), 'figs', fg);
end $$;

-- chấm một bài làm
create or replace function public._grade(p_attempt bigint) returns void
language plpgsql volatile security definer set search_path = public as $$
declare a public.attempts; wts jsonb; r record; k int; mm numeric; uu numeric; ww numeric; st text;
        tot_u numeric := 0; tot_w numeric := 0; nans int := 0;
begin
  select * into a from public.attempts where id = p_attempt for update;
  if a.status = 'done' then return; end if;
  wts := coalesce(a.blueprint -> 'weights', '{"MC":1,"TF":4,"SA":2}'::jsonb);
  for r in select ai.idx, ai.ans, ai.perm, q.t, an.k
           from public.attempt_items ai join public.questions q on q.id = ai.qid
           left join public.answers an on an.qid = ai.qid
           where ai.attempt_id = p_attempt loop
    ww := coalesce((wts ->> r.t)::numeric, case r.t when 'MC' then 1 when 'TF' then 4 else 2 end);
    if r.t = 'MC' then
      if r.ans is null or jsonb_typeof(r.ans) <> 'number' then st := 'skip'; mm := 0;
      else
        mm := case when coalesce(r.perm[(r.ans #>> '{}')::int + 1], (r.ans #>> '{}')::int) = (r.k #>> '{}')::int then 1 else 0 end;
        st := case when mm = 1 then 'ok' else 'bad' end;
      end if;
      uu := mm * ww;
    elsif r.t = 'TF' then
      if r.ans is null or jsonb_typeof(r.ans) <> 'array'
         or not exists (select 1 from jsonb_array_elements(r.ans) e where e <> 'null'::jsonb) then
        k := 0; st := 'skip';
      else
        select count(*) into k from generate_series(0, 3) i
         where (r.ans -> i) <> 'null'::jsonb and (r.ans -> i) = (r.k -> i);
        st := case when k = 4 then 'ok' when k = 0 then 'bad' else 'part' end;
      end if;
      mm := k / 4.0;
      uu := ww * (case k when 4 then 1 when 3 then 0.5 when 2 then 0.25 when 1 then 0.1 else 0 end);
    else
      if not public._answered(r.ans) then st := 'skip'; mm := 0;
      else
        mm := case when public._sa_ok(r.ans #>> '{}', r.k #>> '{}') then 1 else 0 end;
        st := case when mm = 1 then 'ok' else 'bad' end;
      end if;
      uu := mm * ww;
    end if;
    if st <> 'skip' then nans := nans + 1; end if;
    update public.attempt_items set m = mm, u = uu, w = ww, status = st where attempt_id = p_attempt and idx = r.idx;
    tot_u := tot_u + uu; tot_w := tot_w + ww;
  end loop;
  update public.attempts set status = 'done', submitted_at = least(now(), ends_at + interval '2 minutes'),
         score = round(10 * tot_u / nullif(tot_w, 0), 2)
   where id = p_attempt;
  perform public._review_update(p_attempt);
  perform public._xp_award(p_attempt);
  update public.remedials set status = 'done', done_at = now(), score = (select score from public.attempts where id = p_attempt)
   where attempt_id = p_attempt and status = 'pending';
  perform public._remedial_make(p_attempt);
end $$;

create or replace function public._finalize_expired() returns int
language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.attempts where status = 'doing' and ends_at < now() - interval '1 minute' loop
    perform public._grade(r.id); n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- HÀM CHO HỌC SINH
create or replace function public.student_login(p_code text, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare s public.students; tok uuid; cname text;
begin
  select * into s from public.students where upper(code) = upper(btrim(p_code));
  if found and s.status = 'pending' and s.pin = btrim(p_pin) then
    return jsonb_build_object('error', 'Tài khoản của em đang chờ thầy duyệt. Em quay lại sau khi thầy duyệt nhé.', 'pending', true);
  end if;
  if not found or not s.active then return jsonb_build_object('error', 'Sai mã học sinh hoặc mã PIN.'); end if;
  if s.failed >= 10 then return jsonb_build_object('error', 'Tài khoản tạm khoá vì nhập sai PIN nhiều lần. Em báo giáo viên mở khoá.'); end if;
  if s.pin <> btrim(p_pin) then
    update public.students set failed = failed + 1 where id = s.id;
    return jsonb_build_object('error', 'Sai mã học sinh hoặc mã PIN.');
  end if;
  update public.students set failed = 0 where id = s.id;
  delete from public.student_sessions where student_id = s.id and expires_at < now();
  insert into public.student_sessions(student_id) values (s.id) returning token into tok;
  select name into cname from public.classes where id = s.class_id;
  return jsonb_build_object('token', tok, 'name', s.full_name, 'code', s.code, 'class', cname);
end $$;

create or replace function public.student_logout(p_token uuid) returns jsonb
language sql volatile security definer set search_path = public as $$
  delete from public.student_sessions where token = p_token;
  select '{"ok":true}'::jsonb
$$;

create or replace function public.bank_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('g', g, 'l', l, 't', t, 'n', n)), '[]'::jsonb)
  from (select g, l, t, count(*) n from public.questions where active group by g, l, t) x
$$;

create or replace function public.student_home(p_token uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; s public.students; res jsonb;
begin
  sid := public._sess(p_token);
  perform public._finalize_expired();
  select * into s from public.students where id = sid;
  select jsonb_build_object(
    'student', jsonb_build_object('name', s.full_name, 'code', s.code,
                                  'class', (select name from public.classes where id = s.class_id)),
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
end $$;

create or replace function public.start_attempt(p_token uuid, p_assignment bigint default null, p_blueprint jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; s public.students; a public.assignments; bp jsonb; att bigint; ttl text; knd text; gr int;
        lessons text[]; levels text[]; tt text; n int; chosen text[] := '{}'; ct text[]; mx jsonb; want int;
        i int; nmix int; pw boolean; mins int; ends timestamptz; total int := 0; tags text[];
begin
  sid := public._sess(p_token);
  select * into s from public.students where id = sid;
  if p_assignment is not null then
    select * into a from public.assignments where id = p_assignment;
    if not found or a.class_id is distinct from s.class_id then return jsonb_build_object('error', 'Không tìm thấy bài kiểm tra.'); end if;
    select id into att from public.attempts where assignment_id = a.id and student_id = sid and status = 'doing' limit 1;
    if att is not null then
      if (select ends_at from public.attempts where id = att) < now() - interval '1 minute' then perform public._grade(att);
      else return public._payload(att, false); end if;
    end if;
    if now() < a.opens_at then return jsonb_build_object('error', 'Bài kiểm tra chưa mở.'); end if;
    if now() > a.closes_at then return jsonb_build_object('error', 'Bài kiểm tra đã đóng.'); end if;
    if (select count(*) from public.attempts where assignment_id = a.id and student_id = sid and status = 'done') >= a.max_attempts then
      return jsonb_build_object('error', 'Em đã làm hết số lần cho phép của bài này.');
    end if;
    if exists (select 1 from public.remedials r where r.student_id = sid and r.assignment_id = a.id and r.status = 'pending') then
      return jsonb_build_object('error', 'Em cần hoàn thành bài bổ sung trước khi làm lại bài kiểm tra này.',
        'remedial', (select r.id from public.remedials r where r.student_id = sid and r.assignment_id = a.id and r.status = 'pending' order by r.id desc limit 1));
    end if;
    bp := a.blueprint; ttl := a.title; knd := a.kind; gr := a.grade;
  else
    bp := p_blueprint;
    if bp is null then return jsonb_build_object('error', 'Thiếu cấu trúc đề.'); end if;
    ttl := left(coalesce(bp ->> 'title', 'Tự luyện'), 200); knd := left(coalesce(bp ->> 'kind', 'Tự luyện'), 60); gr := (bp ->> 'grade')::int;
    if coalesce((bp -> 'counts' ->> 'MC')::int, 0) + coalesce((bp -> 'counts' ->> 'TF')::int, 0) + coalesce((bp -> 'counts' ->> 'SA')::int, 0) > 60 then
      return jsonb_build_object('error', 'Đề tự luyện tối đa 60 câu.');
    end if;
    bp := bp - 'weights_override' - 'tags';   -- chọn theo ID chỉ dành cho bài giáo viên giao
    tags := array(select jsonb_array_elements_text(coalesce(bp -> 'lessons', '[]'::jsonb)));   -- tạm dùng biến tags
    select r.id into att from public.remedials r
     where r.student_id = sid and r.status = 'pending' and r.assignment_id is null and r.src_kind = knd
       and r.src_lessons @> tags and r.src_lessons <@ tags
     order by r.id desc limit 1;
    if att is not null then
      return jsonb_build_object('error', 'Em cần hoàn thành bài bổ sung trước khi làm lại bài kiểm tra này.', 'remedial', att);
    end if;
  end if;
  mins := least(greatest(coalesce((bp ->> 'minutes')::int, 45), 5), 240);
  lessons := array(select jsonb_array_elements_text(bp -> 'lessons'));
  levels := case when jsonb_typeof(bp -> 'levels') = 'array' then array(select jsonb_array_elements_text(bp -> 'levels')) else null end;
  pw := coalesce((bp ->> 'prefer_wrong')::boolean, false);
  tags := case when jsonb_typeof(bp -> 'tags') = 'array' then array(select jsonb_array_elements_text(bp -> 'tags')) else '{}' end;

  foreach tt in array array['MC', 'TF', 'SA'] loop
    n := least(coalesce((bp -> 'counts' ->> tt)::int, 0), 60);
    continue when n <= 0;
    ct := '{}';
    if cardinality(tags) > 0 then
      ct := public._pick_tags(sid, tags, tt, levels, n, chosen, pw);
      chosen := chosen || ct;
      continue;
    end if;
    if jsonb_typeof(bp -> 'mix') = 'array' and jsonb_array_length(bp -> 'mix') > 0 then
      nmix := jsonb_array_length(bp -> 'mix'); i := 0;
      for mx in select * from jsonb_array_elements(bp -> 'mix') loop
        i := i + 1;
        want := case when i = nmix then n - cardinality(ct) else least(n - cardinality(ct), round(n * (mx ->> 'share')::numeric)::int) end;
        if want > 0 then
          ct := ct || public._pick(sid, lessons, tt, (mx ->> 'g')::int, levels, want, chosen || ct, pw);
        end if;
      end loop;
    end if;
    if cardinality(ct) < n then
      ct := ct || public._pick(sid, lessons, tt, null, levels, n - cardinality(ct), chosen || ct, pw);
    end if;
    chosen := chosen || ct;
  end loop;
  total := cardinality(chosen);
  if total = 0 then return jsonb_build_object('error', 'Ngân hàng chưa có câu hỏi phù hợp với đề này.'); end if;

  ends := now() + make_interval(mins => mins);
  if a.id is not null then ends := least(ends, a.closes_at); end if;
  insert into public.attempts(student_id, assignment_id, title, kind, grade, blueprint, ends_at, n_items)
  values (sid, a.id, ttl, knd, gr, bp, ends, total) returning id into att;
  insert into public.attempt_items(attempt_id, idx, qid, perm)
  select att, (row_number() over (order by case q.t when 'MC' then 0 when 'TF' then 1 else 2 end, q.g,
                 case q.lv when 'NB' then 0 when 'TH' then 1 when 'VD' then 2 else 3 end, q.l, random()) - 1)::int,
         q.id,
         case when q.t = 'MC' then (select array_agg(x order by random()) from generate_series(0, jsonb_array_length(q.o) - 1) x) end
  from public.questions q where q.id = any(chosen);
  return public._payload(att, false);
end $$;

create or replace function public.get_attempt(p_token uuid, p_attempt bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; a public.attempts; show boolean := true;
begin
  sid := public._sess(p_token);
  select * into a from public.attempts where id = p_attempt and student_id = sid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài làm.'); end if;
  if a.status = 'doing' and a.ends_at < now() - interval '1 minute' then perform public._grade(a.id); a.status := 'done'; end if;
  if a.assignment_id is not null then select show_answers into show from public.assignments where id = a.assignment_id; end if;
  return public._payload(a.id, a.status = 'done' and coalesce(show, true));
end $$;

create or replace function public.save_answers(p_token uuid, p_attempt bigint, p_answers jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; a public.attempts; r jsonb;
begin
  sid := public._sess(p_token);
  select * into a from public.attempts where id = p_attempt and student_id = sid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài làm.'); end if;
  if a.status <> 'doing' then return jsonb_build_object('error', 'Bài đã nộp.', 'closed', true); end if;
  if now() > a.ends_at + interval '1 minute' then return jsonb_build_object('error', 'Đã hết giờ.', 'closed', true); end if;
  for r in select * from jsonb_array_elements(p_answers) loop
    update public.attempt_items set ans = r -> 'ans', conf = case when r ? 'conf' then (r ->> 'conf')::smallint else conf end
     where attempt_id = a.id and idx = (r ->> 'idx')::int;
  end loop;
  update public.attempts set last_seen = now(),
         n_answered = (select count(*) from public.attempt_items where attempt_id = a.id and public._answered(ans))
   where id = a.id;
  return jsonb_build_object('ok', true, 'server_now', now());
end $$;

create or replace function public.submit_attempt(p_token uuid, p_attempt bigint, p_answers jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; a public.attempts; r jsonb; show boolean := true;
begin
  sid := public._sess(p_token);
  select * into a from public.attempts where id = p_attempt and student_id = sid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài làm.'); end if;
  if a.status = 'doing' then
    if p_answers is not null and now() <= a.ends_at + interval '1 minute' then
      for r in select * from jsonb_array_elements(p_answers) loop
        update public.attempt_items set ans = r -> 'ans', conf = case when r ? 'conf' then (r ->> 'conf')::smallint else conf end
         where attempt_id = a.id and idx = (r ->> 'idx')::int;
      end loop;
    end if;
    update public.attempts set n_answered = (select count(*) from public.attempt_items where attempt_id = a.id and public._answered(ans)) where id = a.id;
    perform public._grade(a.id);
  end if;
  if a.assignment_id is not null then select show_answers into show from public.assignments where id = a.assignment_id; end if;
  return public._payload(a.id, coalesce(show, true));
end $$;

create or replace function public.get_figs(p_ids jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(id, svg), '{}'::jsonb) from public.figs
  where id in (select jsonb_array_elements_text(p_ids) limit 200)
$$;

-- ---------------------------------------------------------------- HÀM CHO GIÁO VIÊN
create or replace function public.t_overview() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
  perform public._finalize_expired();
  return jsonb_build_object(
    'server_now', now(),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade,
        'n', (select count(*) from public.students s where s.class_id = c.id and s.status <> 'pending')) order by c.name) from public.classes c), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'kind', a.kind, 'grade', a.grade,
        'class_id', a.class_id, 'class', c.name, 'opens_at', a.opens_at, 'closes_at', a.closes_at, 'max_attempts', a.max_attempts,
        'show_answers', a.show_answers, 'minutes', (a.blueprint ->> 'minutes')::int,
        'n_students', (select count(*) from public.students s where s.class_id = a.class_id and s.active),
        'n_doing', (select count(distinct student_id) from public.attempts t where t.assignment_id = a.id and t.status = 'doing'),
        'n_done', (select count(distinct student_id) from public.attempts t where t.assignment_id = a.id and t.status = 'done'),
        'avg', (select round(avg(score), 2) from public.attempts t where t.assignment_id = a.id and t.status = 'done')
      ) order by a.created_at desc) from public.assignments a join public.classes c on c.id = a.class_id), '[]'::jsonb),
    'bank', public.bank_stats(),
    'n_figs', (select count(*) from public.figs),
    'n_pending', (select count(*) from public.students where status = 'pending'));
end $$;

create or replace function public.t_class_save(p_name text, p_grade int, p_id bigint default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare nid bigint;
begin
  perform public._need_teacher();
  if p_id is null then
    insert into public.classes(name, grade) values (btrim(p_name), p_grade) returning id into nid;
  else
    update public.classes set name = btrim(p_name), grade = p_grade where id = p_id returning id into nid;
  end if;
  return jsonb_build_object('id', nid);
end $$;

create or replace function public.t_class_delete(p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
  delete from public.classes where id = p_id;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public.t_students(p_class bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'code', code, 'pin', pin, 'name', full_name,
                  'failed', failed, 'active', active, 'xp', xp, 'hide_rank', hide_rank) order by code) from public.students where class_id = p_class and status <> 'pending'), '[]'::jsonb);
end $$;

create or replace function public.t_students_add(p_class bigint, p_names jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare cname text; pre text; nm text; k int; code text;
begin
  perform public._need_teacher();
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
end $$;

drop function if exists public.t_student_update(uuid, text, boolean, boolean, boolean, boolean);
create or replace function public.t_student_update(p_id uuid, p_name text default null, p_reset_pin boolean default false,
                                                   p_unlock boolean default false, p_active boolean default null, p_delete boolean default false,
                                                   p_hide_rank boolean default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
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
end $$;

create or replace function public.t_assign(p_class bigint, p_title text, p_kind text, p_grade int, p_blueprint jsonb,
                                           p_opens timestamptz, p_closes timestamptz, p_max int default 1, p_show boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare nid bigint;
begin
  perform public._need_teacher();
  if p_closes <= p_opens then raise exception 'Giờ đóng phải sau giờ mở'; end if;
  insert into public.assignments(class_id, title, kind, grade, blueprint, opens_at, closes_at, max_attempts, show_answers)
  values (p_class, p_title, p_kind, p_grade, p_blueprint, p_opens, p_closes, greatest(p_max, 1), p_show) returning id into nid;
  return jsonb_build_object('id', nid);
end $$;

create or replace function public.t_assignment_update(p_id bigint, p_closes timestamptz default null, p_show boolean default null,
                                                      p_delete boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
  if p_delete then delete from public.assignments where id = p_id; return '{"ok":true}'::jsonb; end if;
  update public.assignments set closes_at = coalesce(p_closes, closes_at), show_answers = coalesce(p_show, show_answers) where id = p_id;
  if p_closes is not null and p_closes <= now() then   -- đóng bài: thu bài các em đang làm
    perform public._grade(t.id) from public.attempts t where t.assignment_id = p_id and t.status = 'doing';
  end if;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public.t_monitor(p_assignment bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare a public.assignments;
begin
  perform public._need_teacher();
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
        'n_attempts', (select count(*) from public.attempts x where x.assignment_id = a.id and x.student_id = s.id)
      ) order by s.code)
      from public.students s
      left join lateral (select * from public.attempts x where x.assignment_id = a.id and x.student_id = s.id
                         order by (x.status = 'doing') desc, x.score desc nulls last, x.id desc limit 1) t on true
      where s.class_id = a.class_id and s.active), '[]'::jsonb));
end $$;

create or replace function public.t_report(p_assignment bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
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
end $$;

create or replace function public.t_attempt(p_attempt bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
  return public._payload(p_attempt, true);
end $$;

create or replace function public.t_import_questions(p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  insert into public.questions(id, g, l, lv, lg, t, q, o, s, src, tag, active, updated_at)
  select r.id, r.g, r.l, coalesce(r.lv, 'TH'), coalesce(r.lg, false), r.t, r.q, coalesce(r.o, '[]'::jsonb), coalesce(r.s, ''), r.src, r.tag, true, now()
  from jsonb_to_recordset(p_rows) as r(id text, g int, l int, lv text, lg boolean, t text, q text, o jsonb, s text, src text, tag text)
  on conflict (id) do update set g = excluded.g, l = excluded.l, lv = excluded.lv, lg = excluded.lg, t = excluded.t, q = excluded.q,
     o = excluded.o, s = excluded.s, src = excluded.src, tag = excluded.tag, active = true, updated_at = now();
  get diagnostics n = row_count;
  insert into public.answers(qid, k)
  select r.id, r.k from jsonb_to_recordset(p_rows) as r(id text, k jsonb)
  on conflict (qid) do update set k = excluded.k;
  return jsonb_build_object('n', n);
end $$;

create or replace function public.t_import_figs(p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  insert into public.figs(id, svg) select r.id, r.svg from jsonb_to_recordset(p_rows) as r(id text, svg text)
  on conflict (id) do update set svg = excluded.svg;
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$;

-- ẩn các câu không còn trong ngân hàng mới tải lên (không xoá để giữ lịch sử)
create or replace function public.t_deactivate_except(p_ids jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  update public.questions set active = false
   where active and not (id = any(array(select jsonb_array_elements_text(p_ids))));
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$;

-- bật/ẩn một danh sách câu (dùng cho công cụ tự đồng bộ)
create or replace function public.t_set_active(p_ids jsonb, p_active boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  update public.questions set active = p_active, updated_at = now()
   where id = any(array(select jsonb_array_elements_text(p_ids)));
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$;

-- ---------------------------------------------------------------- ÔN TẬP: SỔ CÂU SAI, NHIỆM VỤ HÔM NAY
-- số ngày học liên tiếp (ngày có nộp ít nhất 1 bài), tính theo giờ Việt Nam
create or replace function public._streak(p_student uuid) returns int
language sql stable security definer set search_path = public as $$
  with d as (
    select distinct (submitted_at at time zone 'Asia/Ho_Chi_Minh')::date dd from public.attempts
    where student_id = p_student and status = 'done' and submitted_at > now() - interval '400 days'
  ), x as (select dd, dd - (row_number() over (order by dd))::int grp from d)
  select case when (select max(dd) from d) >= (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1
              then (select count(*)::int from x where grp = (select grp from x order by dd desc limit 1))
              else 0 end
$$;

-- sau khi chấm: câu sai vào sổ (hẹn ôn sau 1 ngày); ôn đúng thì hẹn xa dần 3 – 7 – 21 ngày; đúng lần thứ 4 là "đã thuộc"
create or replace function public._review_update(p_attempt bigint) returns void
language plpgsql volatile security definer set search_path = public as $$
declare a public.attempts; r record;
begin
  select * into a from public.attempts where id = p_attempt;
  for r in select ai.qid, ai.status, ai.conf, ai.rv from public.attempt_items ai where ai.attempt_id = p_attempt loop
    if r.rv is not null then                         -- câu ôn tập
      if r.status = 'ok' then
        update public.review_items set
          done_at = case when box >= 3 then now() end,
          due_at = case when box >= 3 then due_at else now() + make_interval(days => (array[3, 7, 21])[box + 1]) end,
          box = least(box + 1, 4), confident_wrong = false, updated_at = now()
        where id = r.rv and student_id = a.student_id;
      elsif r.status in ('bad', 'part') then
        update public.review_items set box = 0, due_at = now() + interval '1 day', wrong_n = wrong_n + 1,
          confident_wrong = coalesce(r.conf = 1, false), done_at = null, updated_at = now()
        where id = r.rv and student_id = a.student_id;
      end if;                                        -- bỏ trống: giữ nguyên lịch
    elsif r.status in ('bad', 'part') then
      insert into public.review_items(student_id, qid, box, due_at, confident_wrong)
      values (a.student_id, r.qid, 0, now() + interval '1 day', coalesce(r.conf = 1, false))
      on conflict (student_id, qid) do update set box = 0, due_at = now() + interval '1 day',
        wrong_n = public.review_items.wrong_n + 1, done_at = null,
        confident_wrong = public.review_items.confident_wrong or coalesce(r.conf = 1, false), updated_at = now();
    elsif r.status = 'ok' then                        -- làm đúng lại chính câu đó khi đã đến hạn: tính như ôn đúng
      update public.review_items set
        done_at = case when box >= 3 then now() end,
        due_at = case when box >= 3 then due_at else now() + make_interval(days => (array[3, 7, 21])[box + 1]) end,
        box = least(box + 1, 4), confident_wrong = false, updated_at = now()
      where student_id = a.student_id and qid = r.qid and done_at is null and due_at <= now() + interval '6 hours';
    end if;
  end loop;
end $$;

-- chọn câu ôn cho các mục đến hạn: ưu tiên câu CÙNG DẠNG (cùng bài, mức độ, kiểu câu) em chưa gặp; không có thì dùng lại câu cũ
create or replace function public._review_pick(p_student uuid, p_n int, p_exclude text[])
returns table(o_rv bigint, o_qid text) language plpgsql volatile security definer set search_path = public as $$
declare r record; used text[] := coalesce(p_exclude, '{}'); pk text;
begin
  for r in select ri.id, ri.qid, q.g, q.l, q.lv, q.t from public.review_items ri join public.questions q on q.id = ri.qid
           where ri.student_id = p_student and ri.done_at is null and ri.due_at <= now() + interval '6 hours'
           order by ri.confident_wrong desc, ri.due_at limit greatest(p_n, 0) loop
    pk := null;
    select q.id into pk from public.questions q
      where q.active and q.g = r.g and q.l = r.l and q.t = r.t and q.lv = r.lv and q.id <> r.qid and not (q.id = any(used))
      order by (select count(*) from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id
                 where ai.qid = q.id and a.student_id = p_student), random()
      limit 1;
    if pk is null and not (r.qid = any(used)) and exists (select 1 from public.questions where id = r.qid and active) then
      pk := r.qid;
    end if;
    if pk is not null then used := used || pk; o_rv := r.id; o_qid := pk; return next; end if;
  end loop;
end $$;

-- tạo bài làm từ danh sách câu đã chọn
create or replace function public._create_attempt(p_student uuid, p_title text, p_kind text, p_grade int, p_bp jsonb,
                                                  p_minutes int, p_qids text[], p_rvs bigint[])
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare att bigint;
begin
  insert into public.attempts(student_id, title, kind, grade, blueprint, ends_at, n_items)
  values (p_student, p_title, p_kind, p_grade, p_bp, now() + make_interval(mins => p_minutes), cardinality(p_qids)) returning id into att;
  insert into public.attempt_items(attempt_id, idx, qid, perm, rv)
  select att, (row_number() over (order by case q.t when 'MC' then 0 when 'TF' then 1 else 2 end, x.i) - 1)::int, q.id,
         case when q.t = 'MC' then (select array_agg(y order by random()) from generate_series(0, jsonb_array_length(q.o) - 1) y) end,
         x.rv
  from unnest(p_qids, p_rvs) with ordinality as x(qid, rv, i) join public.questions q on q.id = x.qid;
  return att;
end $$;

-- nhiệm vụ hôm nay: ~12 câu, 15 phút = câu ôn đến hạn + bài đang yếu + 2 câu khó hơn một chút
create or replace function public.daily_mission(p_token uuid, p_grade int default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; ex public.attempts; v_g int; qids text[] := '{}'; rvs bigint[] := '{}'; r record;
        weak text[]; strong text; got text[]; need int; nmc int; att bigint; today date;
begin
  sid := public._sess(p_token);
  today := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  select * into ex from public.attempts where student_id = sid and kind = 'Nhiệm vụ hôm nay'
     and (started_at at time zone 'Asia/Ho_Chi_Minh')::date = today order by id desc limit 1;
  if found then
    if ex.status = 'doing' and ex.ends_at < now() - interval '1 minute' then perform public._grade(ex.id); ex.status := 'done'; end if;
    return public._payload(ex.id, ex.status = 'done');
  end if;
  v_g := case when p_grade between 6 and 12 then p_grade
            else coalesce((select c.grade from public.students st join public.classes c on c.id = st.class_id where st.id = sid), 10) end;

  -- 1) tối đa 5 câu ôn đến hạn
  for r in select * from public._review_pick(sid, 5, '{}') loop
    qids := qids || r.o_qid; rvs := rvs || r.o_rv;
  end loop;

  -- 2) bài đang yếu: bài đã làm có tỉ lệ đạt thấp nhất; chưa làm bài nào thì lấy các bài đầu chương trình
  with ms as (
    select q.l, sum(ai.m * case q.t when 'TF' then 4 when 'SA' then 2 else 1 end)
                / sum(case q.t when 'TF' then 4 when 'SA' then 2 else 1 end) ratio,
           sum(case q.t when 'TF' then 4 when 'SA' then 2 else 1 end) w
    from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id join public.questions q on q.id = ai.qid
    where a.student_id = sid and a.status = 'done' and q.g = v_g group by q.l
  ), cand as (
    select q.l from public.questions q where q.active and q.g = v_g group by q.l having count(*) >= 3
  )
  select array(select v_g || '-' || c.l from cand c left join ms on ms.l = c.l
               order by case when ms.w >= 2 and ms.ratio < 0.85 then 0 when ms.w >= 2 then 1 else 2 end, ms.ratio, c.l limit 2),
         (select v_g || '-' || ms.l from ms join cand c on c.l = ms.l where ms.w >= 2 and ms.ratio >= 0.6 order by ms.ratio desc limit 1)
    into weak, strong;
  if cardinality(weak) = 0 and cardinality(qids) = 0 then
    return jsonb_build_object('error', 'Ngân hàng chưa có câu hỏi cho Toán ' || v_g || '.');
  end if;
  strong := coalesce(strong, weak[1]);

  -- 3) 2 câu khó hơn một chút (mức vận dụng) ở bài em đang làm khá
  got := '{}';
  if strong is not null then
    got := public._pick(sid, array[strong], 'MC', v_g, array['VD', 'VDC'], 2, qids, false);
    if cardinality(got) < 2 then
      got := got || public._pick(sid, array[strong], 'SA', v_g, array['VD', 'VDC'], 2 - cardinality(got), qids || got, false);
    end if;
  end if;
  qids := qids || got; rvs := rvs || array_fill(null::bigint, array[cardinality(got)]);

  -- 4) phần còn lại: bài đang yếu, ưu tiên câu em từng làm sai
  need := greatest(12 - cardinality(qids), 0);
  if need > 0 and cardinality(weak) > 0 then
    nmc := ceil(need * 0.7);
    got := public._pick(sid, weak, 'MC', v_g, null, nmc, qids, true);
    got := got || public._pick(sid, weak, 'SA', v_g, null, need - cardinality(got), qids || got, true);
    if cardinality(got) < need then got := got || public._pick(sid, weak, 'MC', v_g, null, need - cardinality(got), qids || got, true); end if;
    if cardinality(got) < need then got := got || public._pick(sid, weak, 'TF', v_g, null, 1, qids || got, true); end if;
    qids := qids || got; rvs := rvs || array_fill(null::bigint, array[cardinality(got)]);
  end if;
  if cardinality(qids) = 0 then return jsonb_build_object('error', 'Chưa đủ câu hỏi để tạo nhiệm vụ.'); end if;

  att := public._create_attempt(sid, 'Nhiệm vụ hôm nay ' || to_char(today, 'DD/MM'), 'Nhiệm vụ hôm nay', v_g,
           jsonb_build_object('kind', 'Nhiệm vụ hôm nay', 'grade', v_g, 'lessons', to_jsonb(array_remove(weak || strong, null)),
                              'minutes', 15, 'mission', true),
           15, qids, rvs);
  return public._payload(att, false);
end $$;

-- ôn các câu sai đã đến hạn (tối đa 20 câu)
create or replace function public.start_review(p_token uuid, p_n int default 10) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; qids text[] := '{}'; rvs bigint[] := '{}'; r record; att bigint; n int; ex bigint;
begin
  sid := public._sess(p_token);
  select id into ex from public.attempts
   where student_id = sid and kind = 'Ôn câu sai' and status = 'doing' and ends_at > now() order by id desc limit 1;
  if ex is not null then return public._payload(ex, false); end if;
  for r in select * from public._review_pick(sid, least(greatest(coalesce(p_n, 10), 1), 20), '{}') loop
    qids := qids || r.o_qid; rvs := rvs || r.o_rv;
  end loop;
  n := cardinality(qids);
  if n = 0 then return jsonb_build_object('error', 'Hôm nay chưa có câu nào đến hạn ôn. Em quay lại vào ngày hẹn nhé.'); end if;
  att := public._create_attempt(sid, 'Ôn câu sai ' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM'), 'Ôn câu sai', null,
           jsonb_build_object('kind', 'Ôn câu sai', 'minutes', greatest(5, n * 2), 'review', true), greatest(5, n * 2), qids, rvs);
  return public._payload(att, false);
end $$;

-- xem sổ câu sai
create or replace function public.review_list(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid uuid;
begin
  sid := public._sess(p_token);
  return jsonb_build_object('server_now', now(), 'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ri.id, 'qid', ri.qid, 'g', q.g, 'l', q.l, 'lv', q.lv, 't', q.t, 'q', q.q, 'box', ri.box, 'due_at', ri.due_at,
      'wrong_n', ri.wrong_n, 'cw', ri.confident_wrong, 'done', ri.done_at is not null)
      order by (ri.done_at is not null), ri.due_at)
    from public.review_items ri join public.questions q on q.id = ri.qid
    where ri.student_id = sid and (ri.done_at is null or ri.done_at > now() - interval '60 days')), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- THĂNG CẤP: KINH NGHIỆM, CẤP, BẢNG VINH DANH
-- Cấp L cần tổng 50·L·(L−1) kinh nghiệm: cấp 2 = 100, cấp 3 = 300, cấp 5 = 1000, cấp 10 = 4500 ...
-- Kinh nghiệm chỉ do máy chủ tính khi chấm bài, học sinh không tự sửa được.
--   câu đúng: nhiều phương án 10, trả lời ngắn 20, đúng/sai 25 (đúng 3/4 ý: 12, 2/4 ý: 5)
--   nhân theo mức độ: NB ×1, TH ×1,2, VD ×1,5, VDC ×2
--   câu đã từng làm đúng trước đó: chỉ tính 30% (tránh "cày" lại câu cũ); câu ôn lại đúng: +5
--   nộp bài có làm ít nhất nửa số câu: +20 (nhiệm vụ hôm nay: +30); đạt 10 điểm với đề từ 10 câu: +50
create or replace function public._xp_award(p_attempt bigint) returns int
language plpgsql volatile security definer set search_path = public as $$
declare a public.attempts; v int := 0;
begin
  select * into a from public.attempts where id = p_attempt;
  if a.status <> 'done' or a.xp is not null then return coalesce(a.xp, 0); end if;
  select coalesce(sum(round(
           (case q.t when 'MC' then 10 * ai.m when 'SA' then 20 * ai.m
                     else case when ai.status = 'ok' then 25 when ai.m >= 0.75 then 12 when ai.m >= 0.5 then 5 else 0 end end)
           * (case q.lv when 'TH' then 1.2 when 'VD' then 1.5 when 'VDC' then 2 else 1 end)
           * (case when exists (select 1 from public.attempt_items x join public.attempts y on y.id = x.attempt_id
                                where y.student_id = a.student_id and y.id < a.id and x.qid = ai.qid and x.status = 'ok')
                   then 0.3 else 1 end)
           + case when ai.rv is not null and ai.status = 'ok' then 5 else 0 end)), 0)::int
    into v
    from public.attempt_items ai join public.questions q on q.id = ai.qid
   where ai.attempt_id = p_attempt;
  if a.n_items > 0 and a.n_answered * 2 >= a.n_items then
    v := v + case when a.kind = 'Nhiệm vụ hôm nay' then 30 else 20 end;
  end if;
  if a.score = 10 and a.n_items >= 10 then v := v + 50; end if;
  update public.attempts set xp = v where id = p_attempt;
  update public.students set xp = xp + v where id = a.student_id;
  return v;
end $$;

-- tên rút gọn để vinh danh công khai: "Nguyễn Văn An" -> "N.V. An"
create or replace function public._short_name(n text) returns text
language sql immutable as $$
  select case when cardinality(w) <= 1 then coalesce(w[1], '')
              else (select string_agg(left(x, 1) || '.', '' order by i) from unnest(w[1:cardinality(w) - 1]) with ordinality t(x, i))
                   || ' ' || w[cardinality(w)] end
  from (select regexp_split_to_array(btrim(n), '\s+') w) z
$$;

-- đầu tuần (thứ Hai 0 giờ, giờ Việt Nam)
create or replace function public._week_start() returns timestamptz
language sql stable as $$
  select (date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh')) at time zone 'Asia/Ho_Chi_Minh'
$$;

-- bảng vinh danh (ai cũng xem được, kể cả chưa đăng nhập): chỉ hiện tên rút gọn và lớp
create or replace function public.leaderboard(p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ws timestamptz := public._week_start(); lim int := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  return jsonb_build_object(
    'week_start', ws,
    'week', coalesce((select jsonb_agg(x order by (x ->> 'w')::int desc, x ->> 'name') from (
        select jsonb_build_object('name', public._short_name(s.full_name), 'class', c.name, 'xp', s.xp, 'w', sum(t.xp)::int) x
        from public.attempts t join public.students s on s.id = t.student_id left join public.classes c on c.id = s.class_id
        where t.status = 'done' and t.submitted_at >= ws and s.active and not s.hide_rank
        group by s.id, s.full_name, c.name, s.xp having sum(t.xp) > 0
        order by sum(t.xp) desc limit lim) z), '[]'::jsonb),
    'all', coalesce((select jsonb_agg(x order by (x ->> 'xp')::int desc, x ->> 'name') from (
        select jsonb_build_object('name', public._short_name(s.full_name), 'class', c.name, 'xp', s.xp) x
        from public.students s left join public.classes c on c.id = s.class_id
        where s.active and not s.hide_rank and s.xp > 0
        order by s.xp desc limit lim) z), '[]'::jsonb));
end $$;

-- thứ hạng của chính học sinh
create or replace function public._my_rank(p_student uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with w as (
    select s.id, coalesce(sum(t.xp), 0) wx, s.xp from public.students s
    left join public.attempts t on t.student_id = s.id and t.status = 'done' and t.submitted_at >= public._week_start()
    where s.active and not s.hide_rank group by s.id, s.xp
  ), me as (select * from w where id = p_student)
  select jsonb_build_object(
    'week_xp', (select wx from me),
    'week_rank', case when (select wx from me) > 0 then (select count(*) + 1 from w where wx > (select wx from me)) end,
    'all_rank', case when (select xp from me) > 0 then (select count(*) + 1 from w where xp > (select xp from me)) end,
    'hidden', (select hide_rank from public.students where id = p_student))
$$;

-- ---------------------------------------------------------------- HỌC SINH TỰ ĐĂNG KÝ, GIÁO VIÊN DUYỆT
-- danh sách lớp để chọn khi đăng ký + trạng thái cho phép đăng ký
create or replace function public.register_info() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'open', coalesce((select (value)::boolean from public.settings where key = 'register_open'), true),
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'grade', grade) order by grade, name) from public.classes), '[]'::jsonb))
$$;

-- học sinh tự đăng ký: tạo tài khoản ở trạng thái "chờ duyệt" (chưa đăng nhập được)
create or replace function public.student_register(p_name text, p_class bigint, p_pin text, p_phone text default null, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare nm text; cname text; pre text; k int; v_code text; ph text;
begin
  if not coalesce((select (value)::boolean from public.settings where key = 'register_open'), true) then
    return jsonb_build_object('error', 'Hiện thầy chưa mở đăng ký tài khoản mới. Em liên hệ thầy để được cấp tài khoản.');
  end if;
  nm := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(nm) < 4 or char_length(nm) > 60 or nm !~ ' ' then
    return jsonb_build_object('error', 'Em nhập đầy đủ họ và tên (ví dụ: Nguyễn Văn An).');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{6}$' then return jsonb_build_object('error', 'Mã PIN phải gồm đúng 6 chữ số.'); end if;
  if p_pin ~ '^(.)\1{5}$' or p_pin in ('123456', '654321', '012345') then
    return jsonb_build_object('error', 'Mã PIN này dễ đoán quá, em chọn 6 số khác nhé.');
  end if;
  ph := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
  if ph is not null and ph !~ '^\+?[0-9]{9,12}$' then return jsonb_build_object('error', 'Số điện thoại chưa đúng.'); end if;
  if p_class is not null then
    select name into cname from public.classes where id = p_class;
    if cname is null then return jsonb_build_object('error', 'Không tìm thấy lớp đã chọn.'); end if;
  end if;
  -- chống đăng ký ồ ạt
  if (select count(*) from public.students where status = 'pending' and created_at > now() - interval '1 hour') >= 40 then
    return jsonb_build_object('error', 'Có quá nhiều đăng ký trong lúc này. Em thử lại sau ít phút.');
  end if;
  if exists (select 1 from public.students where status = 'pending' and lower(full_name) = lower(nm) and class_id is not distinct from p_class) then
    return jsonb_build_object('error', 'Đã có một đăng ký cùng họ tên ở lớp này đang chờ thầy duyệt. Em liên hệ thầy nếu cần.');
  end if;

  pre := case when cname is null then 'HS' else upper(regexp_replace(cname, '[^A-Za-z0-9]', '', 'g')) end;
  if pre = '' then pre := 'L' || p_class::text; end if;
  perform pg_advisory_xact_lock(hashtext('student_code:' || pre));
  select coalesce(max(nullif(regexp_replace(s.code, '^.*-', ''), '')::int), 0) into k
    from public.students s where s.code ~ ('^' || pre || '-[0-9]+$');
  v_code := pre || '-' || lpad((k + 1)::text, 2, '0');
  insert into public.students(code, pin, full_name, class_id, active, status, phone, note)
  values (v_code, p_pin, nm, p_class, false, 'pending', ph, left(nullif(btrim(coalesce(p_note, '')), ''), 200));
  return jsonb_build_object('code', v_code, 'class', cname, 'name', nm);
end $$;

-- giáo viên: danh sách chờ duyệt
create or replace function public.t_pending() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
  return jsonb_build_object(
    'open', coalesce((select (value)::boolean from public.settings where key = 'register_open'), true),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.full_name, 'class', c.name,
                   'phone', s.phone, 'note', s.note, 'at', s.created_at) order by s.created_at)
              from public.students s left join public.classes c on c.id = s.class_id where s.status = 'pending'), '[]'::jsonb));
end $$;

-- giáo viên: duyệt (bật tài khoản) hoặc từ chối (xoá đăng ký)
drop function if exists public.t_approve(jsonb, boolean);
create or replace function public.t_approve(p_ids jsonb, p_approve boolean, p_class bigint default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  if p_approve then
    update public.students set status = 'active', active = true, failed = 0, class_id = coalesce(p_class, class_id)
     where status = 'pending' and id = any(array(select (jsonb_array_elements_text(p_ids))::uuid));
  else
    delete from public.students
     where status = 'pending' and id = any(array(select (jsonb_array_elements_text(p_ids))::uuid));
  end if;
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$;

-- giáo viên: mở / tạm đóng đăng ký
create or replace function public.t_register_open(p_open boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
  insert into public.settings(key, value) values ('register_open', p_open::text)
  on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('open', p_open);
end $$;

-- ---------------------------------------------------------------- GIAO ĐỀ THEO ID CÂU HỎI (ID trong file .tex, vd [10B02-TH], [2D1V4-2])
-- chuẩn hoá ID: bỏ ngoặc vuông, viết hoa
create or replace function public._tag_norm(t text) returns text
language sql immutable as $$ select regexp_replace(upper(btrim(coalesce(t, ''), ' []')), '^0([1-9]B)', '\1') $$;

-- mẫu tìm: nhập phần đầu ID là lấy cả nhóm (2D1 → mọi ID bắt đầu bằng 2D1); dấu * thay cho phần bất kỳ
create or replace function public._tag_like(p text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(regexp_replace(upper(btrim(coalesce(p, ''), ' []')), '^0([1-9]B)', '\1'), '\', '\\'), '%', '\%'), '_', '\_'), '*', '%') || '%'
$$;

create or replace function public._tag_match(tag text, pats text[]) returns boolean
language sql immutable as $$
  select exists (select 1 from unnest(pats) x where btrim(coalesce(x, ''), ' []*') <> '' and public._tag_norm(tag) like public._tag_like(x))
$$;

-- nhóm ID (bỏ số thứ tự riêng của từng câu ở cuối, vd 10B05-TH-0123 → 10B05-TH)
create or replace function public._tag_group(tag text) returns text
language sql immutable as $$ select regexp_replace(public._tag_norm(tag), '-[0-9]{3,}$', '') $$;

-- bốc câu theo danh sách ID: rải đều các nhóm ID, ưu tiên câu em chưa gặp
create or replace function public._pick_tags(p_student uuid, p_tags text[], p_t text, p_levels text[],
                                             p_n int, p_exclude text[], p_prefer_wrong boolean)
returns text[] language sql volatile security definer set search_path = public as $$
  with seen as (
    select ai.qid, count(*) as cnt, bool_or(ai.status in ('bad','part','skip')) as wrong
    from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id
    where a.student_id = p_student group by ai.qid
  ), pool as (
    select q.id, public._tag_group(q.tag) grp, coalesce(s.cnt, 0) as cnt,
           case when p_prefer_wrong and coalesce(s.wrong, false) then -10 else 0 end as pri
    from public.questions q left join seen s on s.qid = q.id
    where q.active and q.t = p_t and coalesce(q.tag, '') <> '' and public._tag_match(q.tag, p_tags)
      and (p_levels is null or cardinality(p_levels) = 0 or q.lv = any(p_levels))
      and not (q.id = any(coalesce(p_exclude, '{}')))
  ), ranked as (
    select id, row_number() over (partition by grp order by pri + cnt, random()) as rn, pri from pool
  )
  select coalesce(array(select id from ranked order by pri, rn, random() limit greatest(p_n, 0)), '{}')
$$;

-- giáo viên: danh sách nhóm ID của một khối (để chọn)
create or replace function public.t_tag_groups(p_g int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
  return coalesce((select jsonb_agg(jsonb_build_object('tag', grp, 'n', n, 'MC', mc, 'TF', tf, 'SA', sa, 'l', ls) order by grp) from (
      select public._tag_group(tag) grp, count(*) n,
             count(*) filter (where t = 'MC') mc, count(*) filter (where t = 'TF') tf, count(*) filter (where t = 'SA') sa,
             array_agg(distinct l order by l) ls
      from public.questions where active and g = p_g and coalesce(tag, '') <> '' group by 1) z), '[]'::jsonb);
end $$;

-- giáo viên: các câu khớp với danh sách ID (đếm theo dạng; xem trước tối đa p_preview câu)
create or replace function public.t_tag_match(p_tags jsonb, p_levels jsonb default null, p_preview int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pats text[]; lvs text[];
begin
  perform public._need_teacher();
  pats := array(select jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)));
  lvs := case when jsonb_typeof(p_levels) = 'array' then array(select jsonb_array_elements_text(p_levels)) end;
  return (
    with m as (
      select q.* from public.questions q
      where q.active and coalesce(q.tag, '') <> '' and public._tag_match(q.tag, pats)
        and (lvs is null or cardinality(lvs) = 0 or q.lv = any(lvs))
    )
    select jsonb_build_object(
      'counts', jsonb_build_object('MC', count(*) filter (where t = 'MC'), 'TF', count(*) filter (where t = 'TF'), 'SA', count(*) filter (where t = 'SA')),
      'lessons', coalesce((select jsonb_agg(distinct g || '-' || l) from m), '[]'::jsonb),
      'grades', coalesce((select jsonb_agg(distinct g) from m), '[]'::jsonb),
      'preview', case when p_preview > 0 then coalesce((select jsonb_agg(jsonb_build_object('id', id, 'tag', tag, 't', t, 'lv', lv, 'g', g, 'l', l, 'q', q, 'o', o)
                    order by public._tag_norm(tag), t) from (select * from m order by public._tag_norm(tag), t limit least(p_preview, 200)) p), '[]'::jsonb) else '[]'::jsonb end)
    from m);
end $$;

-- ---------------------------------------------------------------- BÀI BỔ SUNG (BẮT BUỘC TRƯỚC KHI LÀM LẠI)
-- Sau mỗi bài kiểm tra: tìm bài học em làm dưới 50% → tạo bài bổ sung ~10 câu mức NB–TH của bài đó.
-- Muốn làm lại chính bài kiểm tra đó, em phải hoàn thành bài bổ sung trước.
create or replace function public._remedial_make(p_attempt bigint) returns void
language plpgsql volatile security definer set search_path = public as $$
declare a public.attempts; weak text[]; det jsonb; src text[];
begin
  select * into a from public.attempts where id = p_attempt;
  if not found or a.status <> 'done' or a.kind in ('Bài bổ sung', 'Ôn câu sai', 'Nhiệm vụ hôm nay') then return; end if;
  if exists (select 1 from public.remedials where source_attempt = p_attempt) then return; end if;
  with per as (
    select q.g, q.l, count(*) n, sum(coalesce(ai.m, 0) * coalesce(ai.w, 1)) / nullif(sum(coalesce(ai.w, 1)), 0) m
    from public.attempt_items ai join public.questions q on q.id = ai.qid
    where ai.attempt_id = p_attempt group by q.g, q.l
  ), cand as (
    select per.*, (per.n >= 2 or coalesce(a.score, 0) < 5) ok_n from per
    where per.m < 0.5
      and exists (select 1 from public.questions x where x.active and x.g = per.g and x.l = per.l and x.lv in ('NB', 'TH'))
  ), pick as (
    select * from cand where ok_n order by m, n desc limit 2
  )
  select array_agg(g || '-' || l order by m), jsonb_agg(jsonb_build_object('key', g || '-' || l, 'm', round(m, 3), 'n', n) order by m)
    into weak, det from pick;
  if weak is null or cardinality(weak) = 0 then return; end if;
  src := case when jsonb_typeof(a.blueprint -> 'lessons') = 'array' then array(select jsonb_array_elements_text(a.blueprint -> 'lessons')) else '{}' end;
  insert into public.remedials(student_id, source_attempt, assignment_id, src_kind, src_title, src_lessons, src_score, lessons, detail)
  values (a.student_id, a.id, a.assignment_id, a.kind, a.title, src, a.score, weak, det)
  on conflict (source_attempt) do nothing;
end $$;

-- thông tin bài bổ sung (dùng cho trang chủ / kết quả)
create or replace function public._remedial_json(r public.remedials) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'status', r.status, 'lessons', to_jsonb(r.lessons), 'detail', r.detail,
    'src_title', r.src_title, 'src_kind', r.src_kind, 'src_score', r.src_score, 'source_attempt', r.source_attempt,
    'assignment_id', r.assignment_id, 'attempt_id', r.attempt_id, 'score', r.score, 'created_at', r.created_at, 'done_at', r.done_at,
    'doing', (select t.status = 'doing' from public.attempts t where t.id = r.attempt_id),
    'src_bp', case when r.assignment_id is null then (select t.blueprint from public.attempts t where t.id = r.source_attempt) end,
    'retake_left', case when r.assignment_id is null then 1 else (select greatest(x.max_attempts - (select count(*) from public.attempts y where y.assignment_id = x.id and y.student_id = r.student_id and y.status = 'done'), 0)
                     from public.assignments x where x.id = r.assignment_id and x.closes_at > now()) end)
$$;

-- học sinh bắt đầu / làm tiếp bài bổ sung
create or replace function public.start_remedial(p_token uuid, p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; r public.remedials; t public.attempts; qids text[] := '{}'; lv text[] := array['NB', 'TH']; n int; att bigint; gr int;
begin
  sid := public._sess(p_token);
  select * into r from public.remedials where id = p_id and student_id = sid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài bổ sung.'); end if;
  if r.attempt_id is not null then
    select * into t from public.attempts where id = r.attempt_id;
    if found then
      if t.status = 'doing' and t.ends_at < now() - interval '1 minute' then perform public._grade(t.id); t.status := 'done'; end if;
      return public._payload(t.id, t.status = 'done');
    end if;
  end if;
  qids := public._pick(sid, r.lessons, 'MC', null, lv, 8, qids, true);
  qids := qids || public._pick(sid, r.lessons, 'TF', null, lv, 1, qids, true);
  qids := qids || public._pick(sid, r.lessons, 'SA', null, lv, 1, qids, true);
  if cardinality(qids) < 10 then qids := qids || public._pick(sid, r.lessons, 'MC', null, lv, 10 - cardinality(qids), qids, true); end if;
  if cardinality(qids) < 6 then qids := qids || public._pick(sid, r.lessons, 'TF', null, lv, 10 - cardinality(qids), qids, true); end if;
  if cardinality(qids) < 6 then qids := qids || public._pick(sid, r.lessons, 'SA', null, lv, 10 - cardinality(qids), qids, true); end if;
  n := cardinality(qids);
  if n = 0 then
    update public.remedials set status = 'done', done_at = now() where id = r.id;
    return jsonb_build_object('error', 'Ngân hàng chưa có câu nhận biết – thông hiểu cho bài này. Em được bỏ qua bài bổ sung.');
  end if;
  gr := split_part(r.lessons[1], '-', 1)::int;
  att := public._create_attempt(sid, 'Bài bổ sung · ' || left(coalesce(r.src_title, ''), 150), 'Bài bổ sung', gr,
           jsonb_build_object('kind', 'Bài bổ sung', 'lessons', to_jsonb(r.lessons), 'levels', jsonb_build_array('NB', 'TH'),
                              'minutes', 20, 'remedial', r.id, 'grade', gr),
           20, qids, array_fill(null::bigint, array[n]));
  update public.remedials set attempt_id = att where id = r.id;
  return public._payload(att, false);
end $$;

-- giáo viên: thống kê tình hình học sinh của một lớp
create or replace function public.t_class_stats(p_class bigint, p_days int default 120, p_assignment bigint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 120), 7), 3650));
begin
  perform public._need_teacher();
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
end $$;

-- ---------------------------------------------------------------- QUYỀN GỌI HÀM
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in (
             'is_teacher','_need_teacher','_sess','_sa_num','_sa_ok','_answered','_pick','_payload','_grade','_finalize_expired',
             '_streak','_review_update','_review_pick','_create_attempt','_tag_norm','_tag_like','_tag_match','_tag_group','_pick_tags','_xp_award','_short_name','_week_start','_my_rank','_remedial_make','_remedial_json',
             'student_login','student_logout','bank_stats','student_home','start_attempt','get_attempt','save_answers','submit_attempt','get_figs',
             'daily_mission','start_review','review_list','leaderboard','register_info','student_register','start_remedial','t_class_stats',
             't_pending','t_approve','t_register_open','t_tag_groups','t_tag_match',
             't_overview','t_class_save','t_class_delete','t_students','t_students_add','t_student_update','t_assign',
             't_assignment_update','t_monitor','t_report','t_attempt','t_import_questions','t_import_figs','t_deactivate_except','t_set_active') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('student_login','student_logout','bank_stats','student_home','start_attempt','get_attempt','save_answers','submit_attempt','get_figs',
                     'daily_mission','start_review','review_list','leaderboard','register_info','student_register','start_remedial') then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname like 't\_%' or f.proname = 'is_teacher' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- tính bù kinh nghiệm cho các bài đã nộp trước khi có hệ thống thăng cấp
do $$
declare r record;
begin
  for r in select id from public.attempts where status = 'done' and xp is null order by id loop
    perform public._xp_award(r.id);
  end loop;
end $$;

-- =====================================================================
--  SAU KHI CHẠY XONG: cấp quyền giáo viên cho tài khoản của thầy/cô
--  (tạo tài khoản ở Authentication > Users > Add user trước), rồi chạy:
--
--    insert into public.teachers(user_id)
--    select id from auth.users where email = 'EMAIL_CUA_THAY_CO@gmail.com'
--    on conflict do nothing;
-- =====================================================================

-- =====================================================================  BÁO LỖI CÂU HỎI (09_bao_loi.sql)
-- Học sinh báo câu sai đáp án / sai đề → giáo viên kiểm tra, sửa đáp án (chấm lại) hoặc ẩn câu ngay trên web. Chạy được nhiều lần.

-- sửa trên web được ưu tiên hơn file .tex: đồng bộ lại từ file không ghi đè
alter table public.questions add column if not exists manual_off boolean not null default false;   -- giáo viên đã ẩn câu này trên web
alter table public.answers add column if not exists manual boolean not null default false;         -- đáp án đã được giáo viên sửa trên web

create table if not exists public.question_reports (
  id bigint generated always as identity primary key,
  qid text not null references public.questions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attempt_id bigint references public.attempts(id) on delete set null,
  kind text not null default 'key',          -- key: đáp án sai · question: đề sai/thiếu · other
  suggest jsonb,                             -- đáp án em đề xuất (theo thứ tự gốc của câu)
  ans jsonb,                                 -- em đã trả lời gì (theo thứ tự gốc)
  note text,
  status text not null default 'open',       -- open / fixed / deleted / dismissed
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (qid, student_id)
);
create index if not exists question_reports_open_idx on public.question_reports (status, qid);
alter table public.question_reports enable row level security;

-- đổi câu trả lời của học sinh (theo thứ tự hiển thị) sang thứ tự gốc
create or replace function public._ans_orig(p_t text, p_ans jsonb, p_perm int[]) returns jsonb
language sql immutable as $$
  select case when p_ans is null or p_ans = 'null'::jsonb then null
              when p_t = 'MC' and jsonb_typeof(p_ans) = 'number' and p_perm is not null
                then to_jsonb(coalesce(p_perm[(p_ans #>> '{}')::int + 1], (p_ans #>> '{}')::int))
              else p_ans end
$$;

-- học sinh báo lỗi một câu trong bài đã nộp
create or replace function public.report_question(p_token uuid, p_attempt bigint, p_idx int, p_kind text,
                                                  p_suggest jsonb default null, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; a public.attempts; it public.attempt_items; q public.questions; sg jsonb; kd text; n int;
begin
  sid := public._sess(p_token);
  select * into a from public.attempts where id = p_attempt and student_id = sid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài làm.'); end if;
  if a.status <> 'done' then return jsonb_build_object('error', 'Em nộp bài xong rồi mới báo lỗi được.'); end if;
  select * into it from public.attempt_items where attempt_id = a.id and idx = p_idx;
  if not found then return jsonb_build_object('error', 'Không tìm thấy câu hỏi.'); end if;
  select * into q from public.questions where id = it.qid;
  kd := case when p_kind in ('key', 'question', 'other') then p_kind else 'other' end;
  select count(*) into n from public.question_reports where student_id = sid and created_at > now() - interval '1 day';
  if n >= 30 then return jsonb_build_object('error', 'Hôm nay em đã báo nhiều câu rồi, mai báo tiếp nhé.'); end if;
  -- đề xuất đáp án: chỉ nhận đúng dạng của câu
  sg := null;
  if kd = 'key' and p_suggest is not null then
    if q.t = 'MC' and jsonb_typeof(p_suggest) = 'number' and (p_suggest #>> '{}')::int between 0 and jsonb_array_length(q.o) - 1 then
      sg := public._ans_orig('MC', p_suggest, it.perm);
    elsif q.t = 'TF' and jsonb_typeof(p_suggest) = 'array' and jsonb_array_length(p_suggest) = 4
          and not exists (select 1 from jsonb_array_elements(p_suggest) e where jsonb_typeof(e) <> 'boolean') then
      sg := p_suggest;
    elsif q.t = 'SA' and jsonb_typeof(p_suggest) = 'string' and btrim(p_suggest #>> '{}') <> '' then
      sg := to_jsonb(left(btrim(p_suggest #>> '{}'), 40));
    end if;
  end if;
  insert into public.question_reports(qid, student_id, attempt_id, kind, suggest, ans, note)
  values (it.qid, sid, a.id, kd, sg, public._ans_orig(q.t, it.ans, it.perm), nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  on conflict (qid, student_id) do update set attempt_id = excluded.attempt_id, kind = excluded.kind, suggest = excluded.suggest,
     ans = excluded.ans, note = excluded.note, status = 'open', created_at = now(), resolved_at = null;
  return jsonb_build_object('ok', true);
end $$;

-- học sinh: các câu em đã báo (để hiện "Đã báo")
create or replace function public.my_reports(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('qid', r.qid, 'status', r.status)), '[]'::jsonb)
  from public.question_reports r where r.student_id = public._sess(p_token)
$$;

-- chấm điểm một câu (dùng chung cho chấm bài và chấm lại)
create or replace function public._score_item(p_t text, p_ans jsonb, p_perm int[], p_k jsonb, p_w numeric, p_off boolean,
                                              out mm numeric, out uu numeric, out st text)
language plpgsql immutable as $$
declare k int;
begin
  if p_off then mm := 1; uu := p_w; st := 'ok'; return; end if;   -- câu giáo viên đã huỷ: tính đúng cho mọi em
  if p_t = 'MC' then
    if p_ans is null or jsonb_typeof(p_ans) <> 'number' then st := 'skip'; mm := 0;
    else
      mm := case when coalesce(p_perm[(p_ans #>> '{}')::int + 1], (p_ans #>> '{}')::int) = (p_k #>> '{}')::int then 1 else 0 end;
      st := case when mm = 1 then 'ok' else 'bad' end;
    end if;
    uu := mm * p_w;
  elsif p_t = 'TF' then
    if p_ans is null or jsonb_typeof(p_ans) <> 'array'
       or not exists (select 1 from jsonb_array_elements(p_ans) e where e <> 'null'::jsonb) then
      k := 0; st := 'skip';
    else
      select count(*) into k from generate_series(0, 3) i
       where (p_ans -> i) <> 'null'::jsonb and (p_ans -> i) = (p_k -> i);
      st := case when k = 4 then 'ok' when k = 0 then 'bad' else 'part' end;
    end if;
    mm := k / 4.0;
    uu := p_w * (case k when 4 then 1 when 3 then 0.5 when 2 then 0.25 when 1 then 0.1 else 0 end);
  else
    if not public._answered(p_ans) then st := 'skip'; mm := 0;
    else
      mm := case when public._sa_ok(p_ans #>> '{}', p_k #>> '{}') then 1 else 0 end;
      st := case when mm = 1 then 'ok' else 'bad' end;
    end if;
    uu := mm * p_w;
  end if;
end $$;

-- chấm bài (bản mới: dùng _score_item, câu đã huỷ tính đúng)
create or replace function public._grade(p_attempt bigint) returns void
language plpgsql volatile security definer set search_path = public as $$
declare a public.attempts; wts jsonb; r record; ww numeric; sc record;
        tot_u numeric := 0; tot_w numeric := 0;
begin
  select * into a from public.attempts where id = p_attempt for update;
  if a.status = 'done' then return; end if;
  wts := coalesce(a.blueprint -> 'weights', '{"MC":1,"TF":4,"SA":2}'::jsonb);
  for r in select ai.idx, ai.ans, ai.perm, q.t, an.k, q.manual_off
           from public.attempt_items ai join public.questions q on q.id = ai.qid
           left join public.answers an on an.qid = ai.qid
           where ai.attempt_id = p_attempt loop
    ww := coalesce((wts ->> r.t)::numeric, case r.t when 'MC' then 1 when 'TF' then 4 else 2 end);
    sc := public._score_item(r.t, r.ans, r.perm, r.k, ww, r.manual_off);
    update public.attempt_items set m = sc.mm, u = sc.uu, w = ww, status = sc.st where attempt_id = p_attempt and idx = r.idx;
    tot_u := tot_u + sc.uu; tot_w := tot_w + ww;
  end loop;
  update public.attempts set status = 'done', submitted_at = least(now(), ends_at + interval '2 minutes'),
         score = round(10 * tot_u / nullif(tot_w, 0), 2)
   where id = p_attempt;
  perform public._review_update(p_attempt);
  perform public._xp_award(p_attempt);
  update public.remedials set status = 'done', done_at = now(), score = (select score from public.attempts where id = p_attempt)
   where attempt_id = p_attempt and status = 'pending';
  perform public._remedial_make(p_attempt);
end $$;

-- chấm lại một bài đã nộp sau khi sửa đáp án / huỷ câu (không cộng thêm kinh nghiệm)
create or replace function public._rescore(p_attempt bigint) returns numeric
language plpgsql volatile security definer set search_path = public as $$
declare a public.attempts; wts jsonb; r record; ww numeric; sc record; tot_u numeric := 0; tot_w numeric := 0; ns numeric;
begin
  select * into a from public.attempts where id = p_attempt for update;
  if a.status <> 'done' then return null; end if;
  wts := coalesce(a.blueprint -> 'weights', '{"MC":1,"TF":4,"SA":2}'::jsonb);
  for r in select ai.idx, ai.ans, ai.perm, q.t, an.k, q.manual_off
           from public.attempt_items ai join public.questions q on q.id = ai.qid
           left join public.answers an on an.qid = ai.qid
           where ai.attempt_id = p_attempt loop
    ww := coalesce((wts ->> r.t)::numeric, case r.t when 'MC' then 1 when 'TF' then 4 else 2 end);
    sc := public._score_item(r.t, r.ans, r.perm, r.k, ww, r.manual_off);
    update public.attempt_items set m = sc.mm, u = sc.uu, w = ww, status = sc.st where attempt_id = p_attempt and idx = r.idx;
    tot_u := tot_u + sc.uu; tot_w := tot_w + ww;
  end loop;
  ns := round(10 * tot_u / nullif(tot_w, 0), 2);
  update public.attempts set score = ns where id = p_attempt;
  update public.remedials set score = ns where attempt_id = p_attempt;
  return ns;
end $$;

-- sau khi sửa: chấm lại mọi bài có câu này, dọn sổ câu sai, cộng kinh nghiệm cho em đã báo đúng
create or replace function public._after_fix(p_qid text, p_status text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int := 0; aid bigint; nr int;
begin
  for aid in select distinct ai.attempt_id from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id
             where ai.qid = p_qid and a.status = 'done' loop
    perform public._rescore(aid); n := n + 1;
  end loop;
  -- câu không còn bị tính sai thì bỏ khỏi sổ câu sai
  update public.review_items r set done_at = now(), updated_at = now()
   where r.qid = p_qid and r.done_at is null
     and not exists (select 1 from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id
                     where a.student_id = r.student_id and ai.qid = p_qid and a.status = 'done' and ai.status in ('bad', 'part'));
  update public.students s set xp = s.xp + 20
   where s.id in (select student_id from public.question_reports where qid = p_qid and status = 'open');
  update public.question_reports set status = p_status, resolved_at = now() where qid = p_qid and status = 'open';
  get diagnostics nr = row_count;
  return jsonb_build_object('ok', true, 'regraded', n, 'rewarded', nr);
end $$;

-- giáo viên: danh sách câu bị báo
create or replace function public.t_reports(p_status text default 'open', p_qid text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
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
end $$;

-- giáo viên: số câu đang chờ kiểm tra
create or replace function public.t_reports_count() returns int
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
  return (select count(distinct qid) from public.question_reports where status = 'open');
end $$;

-- giáo viên: sửa đáp án (chấm lại các bài đã làm)
create or replace function public.t_question_fix(p_qid text, p_key jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare q public.questions;
begin
  perform public._need_teacher();
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
end $$;

-- giáo viên: huỷ câu sai đề (ẩn khỏi ngân hàng; bài đã làm tính đúng câu này cho mọi em)
create or replace function public.t_question_hide(p_qid text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
  update public.questions set active = false, manual_off = true, updated_at = now() where id = p_qid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy câu hỏi.'); end if;
  return public._after_fix(p_qid, 'deleted');
end $$;

-- giáo viên: đáp án vẫn đúng, bỏ qua báo cáo
create or replace function public.t_report_dismiss(p_qid text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  update public.question_reports set status = 'dismissed', resolved_at = now() where qid = p_qid and status = 'open';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

-- đồng bộ từ file .tex: không ghi đè đáp án đã sửa trên web, không hiện lại câu đã huỷ
create or replace function public.t_import_questions(p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  insert into public.questions(id, g, l, lv, lg, t, q, o, s, src, tag, active, updated_at)
  select r.id, r.g, r.l, coalesce(r.lv, 'TH'), coalesce(r.lg, false), r.t, r.q, coalesce(r.o, '[]'::jsonb), coalesce(r.s, ''), r.src, r.tag, true, now()
  from jsonb_to_recordset(p_rows) as r(id text, g int, l int, lv text, lg boolean, t text, q text, o jsonb, s text, src text, tag text)
  on conflict (id) do update set g = excluded.g, l = excluded.l, lv = excluded.lv, lg = excluded.lg, t = excluded.t, q = excluded.q,
     o = excluded.o, s = excluded.s, src = excluded.src, tag = excluded.tag, active = not questions.manual_off, updated_at = now();
  get diagnostics n = row_count;
  insert into public.answers(qid, k)
  select r.id, r.k from jsonb_to_recordset(p_rows) as r(id text, k jsonb)
  on conflict (qid) do update set k = case when answers.manual then answers.k else excluded.k end;
  return jsonb_build_object('n', n);
end $$;

create or replace function public.t_set_active(p_ids jsonb, p_active boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  update public.questions set active = p_active, updated_at = now()
   where id = any(array(select jsonb_array_elements_text(p_ids))) and (not p_active or not manual_off);
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$;

-- ---------------------------------------------------------------- QUYỀN GỌI HÀM (phần báo lỗi)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('_ans_orig','_score_item','_grade','_rescore','_after_fix',
             'report_question','my_reports','t_reports','t_reports_count','t_question_fix','t_question_hide','t_report_dismiss',
             't_import_questions','t_set_active') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('report_question', 'my_reports') then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname like 't\_%' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- =====================================================================  VIDEO ÔN TẬP (10_video.sql)
-- Video ôn tập (TikTok / YouTube) gắn theo từng bài học. Chạy được nhiều lần.
create table if not exists public.lesson_videos (
  id bigint generated always as identity primary key,
  g int not null,                 -- khối
  l int not null,                 -- bài
  provider text not null,         -- tt = TikTok, yt = YouTube
  vid text not null,              -- mã video
  url text not null,
  title text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (provider, vid, g, l)
);
create index if not exists lesson_videos_gl_idx on public.lesson_videos (g, l);
alter table public.lesson_videos enable row level security;

-- đọc mã video từ link
create or replace function public._video_parse(p_url text) returns text[]
language sql immutable as $$
  select case
    when m1 is not null then array['tt', m1[1]]
    when m2 is not null then array['yt', m2[1]]
  end
  from (select regexp_match(coalesce(p_url, ''), 'tiktok\.com/(?:@[^/?#]+/video|embed(?:/v2)?|player/v1|v)/([0-9]{8,25})') m1,
               regexp_match(coalesce(p_url, ''), '(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})') m2) z
$$;

-- mọi người: danh sách video (theo khối, hoặc tất cả)
create or replace function public.videos_list(p_g int default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'g', g, 'l', l, 'p', provider, 'vid', vid, 'url', url, 'title', title)
                            order by g, l, sort, id), '[]'::jsonb)
  from public.lesson_videos where p_g is null or g = p_g
$$;

-- giáo viên: thêm / sửa video
create or replace function public.t_video_save(p_g int, p_l int, p_url text, p_title text default '', p_id bigint default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare pv text[]; nid bigint;
begin
  perform public._need_teacher();
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
end $$;

create or replace function public.t_video_delete(p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
  delete from public.lesson_videos where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('_video_parse', 'videos_list', 't_video_save', 't_video_delete') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname = 'videos_list' then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname like 't\_%' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- =====================================================================  CHUYỂN LỚP (11_chuyen_lop.sql)
-- Giáo viên chuyển học sinh sang lớp khác (giữ nguyên mã, PIN, bài đã làm, kinh nghiệm). Chạy được nhiều lần.
create or replace function public.t_student_move(p_ids jsonb, p_class bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  if not exists (select 1 from public.classes where id = p_class) then
    return jsonb_build_object('error', 'Không tìm thấy lớp.');
  end if;
  update public.students set class_id = p_class
   where id = any(array(select (jsonb_array_elements_text(p_ids))::uuid)) and class_id is distinct from p_class;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

revoke all on function public.t_student_move(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.t_student_move(jsonb, bigint) to authenticated;

-- =====================================================================  GIA HẠN (12_gia_han.sql)
-- Gia hạn bài kiểm tra: đổi giờ đóng, thêm lượt làm, cộng giờ cho em đang làm. Chạy được nhiều lần.

-- lưu bài: trả thêm giờ hết hạn để máy học sinh cập nhật đồng hồ khi thầy cộng giờ
create or replace function public.save_answers(p_token uuid, p_attempt bigint, p_answers jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; a public.attempts; r jsonb;
begin
  sid := public._sess(p_token);
  select * into a from public.attempts where id = p_attempt and student_id = sid;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài làm.'); end if;
  if a.status <> 'doing' then return jsonb_build_object('error', 'Bài đã nộp.', 'closed', true); end if;
  if now() > a.ends_at + interval '1 minute' then return jsonb_build_object('error', 'Đã hết giờ.', 'closed', true); end if;
  for r in select * from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) loop
    update public.attempt_items set ans = r -> 'ans', conf = case when r ? 'conf' then (r ->> 'conf')::smallint else conf end
     where attempt_id = a.id and idx = (r ->> 'idx')::int;
  end loop;
  update public.attempts set last_seen = now(),
         n_answered = (select count(*) from public.attempt_items where attempt_id = a.id and public._answered(ans))
   where id = a.id;
  return jsonb_build_object('ok', true, 'server_now', now(), 'ends_at', a.ends_at);
end $$;

-- giáo viên: gia hạn cả bài (giờ đóng mới, số lần làm), các em đang làm dở được làm đủ thời gian
create or replace function public.t_assignment_extend(p_id bigint, p_closes timestamptz, p_max int default null,
                                                      p_extend_doing boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare a public.assignments; mins int; n int := 0;
begin
  perform public._need_teacher();
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
end $$;

-- giáo viên: cộng thêm phút cho một em đang làm (mất mạng, máy hỏng…)
create or replace function public.t_attempt_extend(p_attempt bigint, p_minutes int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare t public.attempts;
begin
  perform public._need_teacher();
  select * into t from public.attempts where id = p_attempt for update;
  if not found then return jsonb_build_object('error', 'Không tìm thấy bài làm.'); end if;
  if t.status <> 'doing' then return jsonb_build_object('error', 'Em này đã nộp bài, không cộng giờ được.'); end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 240 then return jsonb_build_object('error', 'Số phút từ 1 đến 240.'); end if;
  update public.attempts set ends_at = greatest(ends_at, now()) + make_interval(mins => p_minutes) where id = p_attempt
  returning * into t;
  return jsonb_build_object('ok', true, 'ends_at', t.ends_at);
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('save_answers', 't_assignment_extend', 't_attempt_extend') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname = 'save_answers' then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;


-- ===== 13_dgnl.sql =====
-- THI THỬ ĐÁNH GIÁ NĂNG LỰC ĐHQG-HCM: câu hỏi theo phần thi, nhóm câu dùng chung đoạn văn. Chạy được nhiều lần.
alter table public.questions add column if not exists exam text;   -- 'DGNL_HCM' = câu dùng cho đề thi thử ĐGNL (không lẫn vào đề theo bài)
alter table public.questions add column if not exists sec text;    -- phần thi: TV, TA, TOAN, LOGIC, KH
alter table public.questions add column if not exists grp text;    -- mã đoạn văn/tình huống dùng chung
alter table public.questions add column if not exists ord int;     -- thứ tự trong file (giữ đúng thứ tự câu trong nhóm)
create index if not exists questions_exam_idx on public.questions (exam, sec) where active;

create table if not exists public.passages (
  id text primary key,
  html text not null,
  updated_at timestamptz not null default now()
);
alter table public.passages enable row level security;

create or replace function public.t_import_passages(p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
  insert into public.passages(id, html) select r.id, r.html from jsonb_to_recordset(p_rows) as r(id text, html text)
  on conflict (id) do update set html = excluded.html, updated_at = now();
  get diagnostics n = row_count;
  return jsonb_build_object('n', n);
end $$;

-- bốc câu cho một phần thi: cả nhóm câu đi cùng nhau, ưu tiên nhóm em chưa gặp
create or replace function public._dgnl_pick(p_student uuid, p_exam text, p_sec text, p_n int) returns text[]
language plpgsql volatile security definer set search_path = public as $$
declare u record; got text[] := '{}'; k int;
begin
  if p_n <= 0 then return got; end if;
  for u in
    with units as (
      select coalesce(q.grp, q.id) as unit, array_agg(q.id order by q.ord, q.id) as ids, count(*) as n
      from public.questions q
      where q.active and q.exam = p_exam and q.sec = p_sec
      group by coalesce(q.grp, q.id)
    ), seen as (
      select coalesce(q.grp, q.id) as unit, count(*) as c
      from public.attempt_items ai join public.attempts a on a.id = ai.attempt_id join public.questions q on q.id = ai.qid
      where a.student_id = p_student and q.exam = p_exam and q.sec = p_sec group by 1
    )
    select units.* from units left join seen on seen.unit = units.unit
    order by coalesce(seen.c, 0), random()
  loop
    k := cardinality(got);
    exit when k >= p_n;
    if k + u.n <= p_n then
      got := got || u.ids;
    elsif u.n > 1 and k + 1 <= p_n and p_n - k < u.n then
      continue;                      -- nhóm quá dài so với chỗ còn lại: thử nhóm khác
    end if;
  end loop;
  return got;
end $$;

-- tạo bài thi thử ĐGNL (tự luyện hoặc bài giao)
create or replace function public._dgnl_create(p_student uuid, p_assignment bigint, p_closes timestamptz, p_bp jsonb,
                                               p_title text, p_kind text, p_grade int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare ex text := p_bp ->> 'exam'; sc record; ids text[] := '{}'; secs text[] := '{}'; mins int; ends timestamptz; att bigint; i int := 0; bp jsonb;
begin
  for sc in select value ->> 'k' as k, least(greatest(coalesce((value ->> 'n')::int, 0), 0), 80) as n, ord
            from jsonb_array_elements(coalesce(p_bp -> 'parts', '[]'::jsonb)) with ordinality as x(value, ord) order by ord loop
    ids := ids || public._dgnl_pick(p_student, ex, sc.k, sc.n);
  end loop;
  if cardinality(ids) = 0 then return jsonb_build_object('error', 'Ngân hàng chưa có câu hỏi thi thử đánh giá năng lực.'); end if;
  mins := least(greatest(coalesce((p_bp ->> 'minutes')::int, 150), 5), 240);
  ends := now() + make_interval(mins => mins);
  if p_assignment is not null and p_closes is not null then ends := least(ends, p_closes); end if;
  bp := p_bp || jsonb_build_object('weights', jsonb_build_object('MC', 1, 'TF', 4, 'SA', 1));
  insert into public.attempts(student_id, assignment_id, title, kind, grade, blueprint, ends_at, n_items)
  values (p_student, p_assignment, p_title, p_kind, coalesce(p_grade, 12), bp, ends, cardinality(ids)) returning id into att;
  insert into public.attempt_items(attempt_id, idx, qid, perm)
  select att, (x.i - 1)::int, q.id,
         case when q.t = 'MC' then (select array_agg(y order by random()) from generate_series(0, jsonb_array_length(q.o) - 1) y) end
  from unnest(ids) with ordinality as x(qid, i) join public.questions q on q.id = x.qid;
  return public._payload(att, false);
end $$;

-- mọi người: số câu / nhóm câu đang có theo từng phần thi
create or replace function public.dgnl_stats(p_exam text default 'DGNL_HCM') returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(sec, jsonb_build_object('n', n, 'groups', g)), '{}'::jsonb)
  from (select sec, count(*) n, count(distinct grp) g from public.questions where active and exam = p_exam group by sec) z
$$;

create or replace function public._payload(p_attempt bigint, p_keys boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; items jsonb; fg jsonb; aname text; pg jsonb;
begin
  select * into a from public.attempts where id = p_attempt;
  select jsonb_agg(jsonb_build_object(
      'idx', ai.idx, 'qid', ai.qid, 't', q.t, 'lv', q.lv, 'lg', q.lg, 'g', q.g, 'l', q.l, 'q', q.q,
      'o', case when q.t = 'MC' and ai.perm is not null
                then (select jsonb_agg(q.o -> ai.perm[i] order by i) from generate_subscripts(ai.perm, 1) i)
                else q.o end,
      'ans', ai.ans, 'conf', ai.conf, 'rv', ai.rv is not null, 'sec', q.sec, 'grp', q.grp
    ) || case when a.status = 'done' then jsonb_build_object('m', ai.m, 'u', ai.u, 'w', ai.w, 'status', ai.status) else '{}'::jsonb end
      || case when p_keys then jsonb_build_object(
      'key', case when q.t = 'MC' and ai.perm is not null
                  then to_jsonb(array_position(ai.perm, (an.k #>> '{}')::int) - 1) else an.k end,
      's', q.s) else '{}'::jsonb end
    order by ai.idx)
  into items
  from public.attempt_items ai join public.questions q on q.id = ai.qid
  left join public.answers an on an.qid = ai.qid
  where ai.attempt_id = p_attempt;

  -- đoạn văn / tình huống dùng chung cho nhóm câu (đề ĐGNL)
  select coalesce(jsonb_object_agg(p.id, p.html), '{}'::jsonb) into pg
  from public.passages p
  where p.id in (select q.grp from public.attempt_items ai join public.questions q on q.id = ai.qid
                 where ai.attempt_id = p_attempt and q.grp is not null);

  select coalesce(jsonb_object_agg(f.id, f.svg), '{}'::jsonb) into fg
  from public.figs f
  where f.id in (
    select (regexp_matches(q.q || ' ' || q.o::text || case when p_keys then ' ' || q.s else '' end || ' ' || coalesce(ps.html, ''),
                           'data-fig=\\?"([0-9a-f]+)', 'g'))[1]
    from public.attempt_items ai join public.questions q on q.id = ai.qid
    left join public.passages ps on ps.id = q.grp
    where ai.attempt_id = p_attempt);

  select st.full_name into aname from public.students st where st.id = a.student_id;
  return jsonb_build_object(
    'id', a.id, 'title', a.title, 'kind', a.kind, 'grade', a.grade, 'assignment_id', a.assignment_id,
    'started_at', a.started_at, 'ends_at', a.ends_at, 'submitted_at', a.submitted_at, 'status', a.status,
    'score', a.score, 'n_items', a.n_items, 'xp', a.xp, 'student_xp', (select xp from public.students where id = a.student_id), 'weights', coalesce(a.blueprint -> 'weights', '{"MC":1,"TF":4,"SA":2}'::jsonb),
    'server_now', now(), 'student', aname, 'keys', p_keys,
    'remedial', (select public._remedial_json(r) from public.remedials r where r.source_attempt = a.id),
    'remedial_of', (select public._remedial_json(r) from public.remedials r where r.attempt_id = a.id),
    'retake_left', case when a.assignment_id is not null then (select greatest(x.max_attempts - (select count(*) from public.attempts y where y.assignment_id = x.id and y.student_id = a.student_id and y.status = 'done'), 0)
                         from public.assignments x where x.id = a.assignment_id and x.closes_at > now()) end,
    'items', coalesce(items, '[]'::jsonb), 'figs', fg, 'passages', pg, 'exam', a.blueprint ->> 'exam');
end $$;


create or replace function public.start_attempt(p_token uuid, p_assignment bigint default null, p_blueprint jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; s public.students; a public.assignments; bp jsonb; att bigint; ttl text; knd text; gr int;
        lessons text[]; levels text[]; tt text; n int; chosen text[] := '{}'; ct text[]; mx jsonb; want int;
        i int; nmix int; pw boolean; mins int; ends timestamptz; total int := 0; tags text[];
begin
  sid := public._sess(p_token);
  select * into s from public.students where id = sid;
  if p_assignment is not null then
    select * into a from public.assignments where id = p_assignment;
    if not found or a.class_id is distinct from s.class_id then return jsonb_build_object('error', 'Không tìm thấy bài kiểm tra.'); end if;
    select id into att from public.attempts where assignment_id = a.id and student_id = sid and status = 'doing' limit 1;
    if att is not null then
      if (select ends_at from public.attempts where id = att) < now() - interval '1 minute' then perform public._grade(att);
      else return public._payload(att, false); end if;
    end if;
    if now() < a.opens_at then return jsonb_build_object('error', 'Bài kiểm tra chưa mở.'); end if;
    if now() > a.closes_at then return jsonb_build_object('error', 'Bài kiểm tra đã đóng.'); end if;
    if (select count(*) from public.attempts where assignment_id = a.id and student_id = sid and status = 'done') >= a.max_attempts then
      return jsonb_build_object('error', 'Em đã làm hết số lần cho phép của bài này.');
    end if;
    if exists (select 1 from public.remedials r where r.student_id = sid and r.assignment_id = a.id and r.status = 'pending') then
      return jsonb_build_object('error', 'Em cần hoàn thành bài bổ sung trước khi làm lại bài kiểm tra này.',
        'remedial', (select r.id from public.remedials r where r.student_id = sid and r.assignment_id = a.id and r.status = 'pending' order by r.id desc limit 1));
    end if;
    bp := a.blueprint; ttl := a.title; knd := a.kind; gr := a.grade;
  else
    bp := p_blueprint;
    if bp is null then return jsonb_build_object('error', 'Thiếu cấu trúc đề.'); end if;
    ttl := left(coalesce(bp ->> 'title', 'Tự luyện'), 200); knd := left(coalesce(bp ->> 'kind', 'Tự luyện'), 60); gr := (bp ->> 'grade')::int;
    if not (bp ? 'exam') and coalesce((bp -> 'counts' ->> 'MC')::int, 0) + coalesce((bp -> 'counts' ->> 'TF')::int, 0) + coalesce((bp -> 'counts' ->> 'SA')::int, 0) > 60 then
      return jsonb_build_object('error', 'Đề tự luyện tối đa 60 câu.');
    end if;
    bp := bp - 'weights_override' - 'tags';   -- chọn theo ID chỉ dành cho bài giáo viên giao
    tags := array(select jsonb_array_elements_text(coalesce(bp -> 'lessons', '[]'::jsonb)));   -- tạm dùng biến tags
    select r.id into att from public.remedials r
     where r.student_id = sid and r.status = 'pending' and r.assignment_id is null and r.src_kind = knd
       and r.src_lessons @> tags and r.src_lessons <@ tags
     order by r.id desc limit 1;
    if att is not null then
      return jsonb_build_object('error', 'Em cần hoàn thành bài bổ sung trước khi làm lại bài kiểm tra này.', 'remedial', att);
    end if;
  end if;
  if bp ? 'exam' then   -- thi thử ĐGNL: bốc theo phần thi và theo nhóm câu
    return public._dgnl_create(sid, a.id, a.closes_at, bp, ttl, knd, gr);
  end if;
  mins := least(greatest(coalesce((bp ->> 'minutes')::int, 45), 5), 240);
  lessons := array(select jsonb_array_elements_text(bp -> 'lessons'));
  levels := case when jsonb_typeof(bp -> 'levels') = 'array' then array(select jsonb_array_elements_text(bp -> 'levels')) else null end;
  pw := coalesce((bp ->> 'prefer_wrong')::boolean, false);
  tags := case when jsonb_typeof(bp -> 'tags') = 'array' then array(select jsonb_array_elements_text(bp -> 'tags')) else '{}' end;

  foreach tt in array array['MC', 'TF', 'SA'] loop
    n := least(coalesce((bp -> 'counts' ->> tt)::int, 0), 60);
    continue when n <= 0;
    ct := '{}';
    if cardinality(tags) > 0 then
      ct := public._pick_tags(sid, tags, tt, levels, n, chosen, pw);
      chosen := chosen || ct;
      continue;
    end if;
    if jsonb_typeof(bp -> 'mix') = 'array' and jsonb_array_length(bp -> 'mix') > 0 then
      nmix := jsonb_array_length(bp -> 'mix'); i := 0;
      for mx in select * from jsonb_array_elements(bp -> 'mix') loop
        i := i + 1;
        want := case when i = nmix then n - cardinality(ct) else least(n - cardinality(ct), round(n * (mx ->> 'share')::numeric)::int) end;
        if want > 0 then
          ct := ct || public._pick(sid, lessons, tt, (mx ->> 'g')::int, levels, want, chosen || ct, pw);
        end if;
      end loop;
    end if;
    if cardinality(ct) < n then
      ct := ct || public._pick(sid, lessons, tt, null, levels, n - cardinality(ct), chosen || ct, pw);
    end if;
    chosen := chosen || ct;
  end loop;
  total := cardinality(chosen);
  if total = 0 then return jsonb_build_object('error', 'Ngân hàng chưa có câu hỏi phù hợp với đề này.'); end if;

  ends := now() + make_interval(mins => mins);
  if a.id is not null then ends := least(ends, a.closes_at); end if;
  insert into public.attempts(student_id, assignment_id, title, kind, grade, blueprint, ends_at, n_items)
  values (sid, a.id, ttl, knd, gr, bp, ends, total) returning id into att;
  insert into public.attempt_items(attempt_id, idx, qid, perm)
  select att, (row_number() over (order by case q.t when 'MC' then 0 when 'TF' then 1 else 2 end, q.g,
                 case q.lv when 'NB' then 0 when 'TH' then 1 when 'VD' then 2 else 3 end, q.l, random()) - 1)::int,
         q.id,
         case when q.t = 'MC' then (select array_agg(x order by random()) from generate_series(0, jsonb_array_length(q.o) - 1) x) end
  from public.questions q where q.id = any(chosen);
  return public._payload(att, false);
end $$;


create or replace function public._remedial_make(p_attempt bigint) returns void
language plpgsql volatile security definer set search_path = public as $$
declare a public.attempts; weak text[]; det jsonb; src text[];
begin
  select * into a from public.attempts where id = p_attempt;
  if not found or a.status <> 'done' or a.kind in ('Bài bổ sung', 'Ôn câu sai', 'Nhiệm vụ hôm nay') or a.blueprint ? 'exam' then return; end if;
  if exists (select 1 from public.remedials where source_attempt = p_attempt) then return; end if;
  with per as (
    select q.g, q.l, count(*) n, sum(coalesce(ai.m, 0) * coalesce(ai.w, 1)) / nullif(sum(coalesce(ai.w, 1)), 0) m
    from public.attempt_items ai join public.questions q on q.id = ai.qid
    where ai.attempt_id = p_attempt group by q.g, q.l
  ), cand as (
    select per.*, (per.n >= 2 or coalesce(a.score, 0) < 5) ok_n from per
    where per.m < 0.5
      and exists (select 1 from public.questions x where x.active and x.g = per.g and x.l = per.l and x.lv in ('NB', 'TH'))
  ), pick as (
    select * from cand where ok_n order by m, n desc limit 2
  )
  select array_agg(g || '-' || l order by m), jsonb_agg(jsonb_build_object('key', g || '-' || l, 'm', round(m, 3), 'n', n) order by m)
    into weak, det from pick;
  if weak is null or cardinality(weak) = 0 then return; end if;
  src := case when jsonb_typeof(a.blueprint -> 'lessons') = 'array' then array(select jsonb_array_elements_text(a.blueprint -> 'lessons')) else '{}' end;
  insert into public.remedials(student_id, source_attempt, assignment_id, src_kind, src_title, src_lessons, src_score, lessons, detail)
  values (a.student_id, a.id, a.assignment_id, a.kind, a.title, src, a.score, weak, det)
  on conflict (source_attempt) do nothing;
end $$;


create or replace function public.t_import_questions(p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public._need_teacher();
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
end $$;


do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('_payload','start_attempt','_remedial_make','t_import_questions','t_import_passages',
                                                        '_dgnl_pick','_dgnl_create','dgnl_stats') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('start_attempt', 'dgnl_stats') then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname like 't\_%' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;


-- ===== 14_chong_gian_lan.sql =====
-- Hạn chế gian lận: ghi số lần rời trang / cố sao chép đề, gắn cờ bài đáng ngờ cho giáo viên. Chạy được nhiều lần.
alter table public.attempts add column if not exists leaves int not null default 0;     -- số lần rời trang khi đang làm
alter table public.attempts add column if not exists away_s int not null default 0;     -- tổng số giây rời trang
alter table public.attempts add column if not exists copy_n int not null default 0;     -- số lần cố sao chép / chuột phải

-- học sinh: báo số lần rời trang (máy gửi số cộng dồn, máy chủ chỉ nhận số lớn hơn)
create or replace function public.report_focus(p_token uuid, p_attempt bigint, p_leaves int, p_away_s int, p_copy int default 0)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare sid uuid;
begin
  sid := public._sess(p_token);
  update public.attempts
     set leaves = greatest(leaves, least(coalesce(p_leaves, 0), 10000)),
         away_s = greatest(away_s, least(coalesce(p_away_s, 0), 864000)),
         copy_n = greatest(copy_n, least(coalesce(p_copy, 0), 10000))
   where id = p_attempt and student_id = sid
     and (status = 'doing' or submitted_at > now() - interval '5 minutes');
  return jsonb_build_object('ok', true);
end $$;

-- các dấu hiệu đáng ngờ của một bài làm
create or replace function public._flags(p_attempt bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.attempts; f jsonb := '[]'::jsonb; mins numeric; used numeric; prev_avg numeric; prev_n int;
        vd_ok int; vd_n int; pv_m numeric; pv_n numeric;
begin
  select * into a from public.attempts where id = p_attempt;
  if not found then return f; end if;
  -- 1. rời trang
  if a.leaves >= 3 or a.away_s >= 60 then
    f := f || jsonb_build_object('k', 'leave', 'lv', case when a.leaves >= 6 or a.away_s >= 180 then 2 else 1 end,
      't', 'Rời trang ' || a.leaves || ' lần' || case when a.away_s > 0 then ' (tổng ' ||
           case when a.away_s >= 60 then (a.away_s / 60) || ' phút ' || (a.away_s % 60) || ' giây' else a.away_s || ' giây' end || ')' else '' end);
  end if;
  -- 2. cố sao chép đề
  if a.copy_n >= 3 then
    f := f || jsonb_build_object('k', 'copy', 'lv', 1, 't', 'Cố sao chép đề ' || a.copy_n || ' lần');
  end if;
  if a.status <> 'done' or a.score is null then return f; end if;
  -- 3. làm quá nhanh mà điểm cao
  mins := greatest(coalesce((a.blueprint ->> 'minutes')::numeric, 45), 5);
  used := extract(epoch from (a.submitted_at - a.started_at)) / 60;
  if a.score >= 8 and a.n_items >= 8 and used < mins * 0.3 then
    f := f || jsonb_build_object('k', 'fast', 'lv', case when used < mins * 0.15 then 2 else 1 end,
      't', 'Đạt ' || replace(trim(to_char(a.score, 'FM990.0')), '.', ',') || ' điểm chỉ trong ' || greatest(round(used), 1) || ' phút (đề ' || mins::int || ' phút)');
  end if;
  -- 4. điểm vọt lên so với các bài trước của chính em đó
  select avg(score), count(*) into prev_avg, prev_n from (
    select x.score from public.attempts x
     where x.student_id = a.student_id and x.status = 'done' and x.id <> a.id and x.submitted_at < a.submitted_at
       and x.kind not in ('Bài bổ sung', 'Ôn câu sai', 'Nhiệm vụ hôm nay') and x.score is not null
     order by x.submitted_at desc limit 6) z;
  if prev_n >= 3 and a.score >= 7 and a.score - prev_avg >= 3 then
    f := f || jsonb_build_object('k', 'jump', 'lv', case when a.score - prev_avg >= 4.5 then 2 else 1 end,
      't', 'Cao hơn điểm trung bình ' || prev_n || ' bài trước (' || replace(trim(to_char(prev_avg, 'FM990.0')), '.', ',') || ') tới ' ||
           replace(trim(to_char(a.score - prev_avg, 'FM990.0')), '.', ',') || ' điểm');
  end if;
  -- 5. làm đúng hầu hết câu vận dụng trong khi trước đây rất yếu ở mức này
  select count(*) filter (where ai.status = 'ok'), count(*) into vd_ok, vd_n
    from public.attempt_items ai join public.questions q on q.id = ai.qid
   where ai.attempt_id = a.id and q.lv in ('VD', 'VDC');
  select sum(ai.m), count(*) into pv_m, pv_n
    from public.attempt_items ai join public.attempts x on x.id = ai.attempt_id join public.questions q on q.id = ai.qid
   where x.student_id = a.student_id and x.status = 'done' and x.id <> a.id and x.submitted_at < a.submitted_at and q.lv in ('VD', 'VDC');
  if vd_n >= 3 and vd_ok >= vd_n * 0.8 and pv_n >= 10 and pv_m / pv_n < 0.4 then
    f := f || jsonb_build_object('k', 'hard', 'lv', 1,
      't', 'Đúng ' || vd_ok || '/' || vd_n || ' câu vận dụng, trong khi các bài trước chỉ đạt ' || round(100 * pv_m / pv_n) || '% ở mức này');
  end if;
  return f;
end $$;

-- theo dõi bài giao: thêm số lần rời trang và cờ đáng ngờ
create or replace function public.t_monitor(p_assignment bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare a public.assignments;
begin
  perform public._need_teacher();
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
end $$;

-- giáo viên: các bài đáng ngờ gần đây (cả bài giao và bài tự luyện), mới nhất trước
create or replace function public.t_flagged(p_days int default 14) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
       and jsonb_array_length(fl) > 0
     order by t.submitted_at desc limit 300) q), '[]'::jsonb);
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('report_focus', '_flags', 't_monitor', 't_flagged') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname = 'report_focus' then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname like 't\_%' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;


-- ===== 15_lop_live.sql =====
-- LỚP HỌC LIVE: lịch học, phòng học (video YouTube không công khai), điểm danh, trò chuyện, câu hỏi nhanh. Chạy được nhiều lần.
create table if not exists public.live_sessions (
  id bigint generated always as identity primary key,
  title text not null,
  class_ids bigint[] not null default '{}',
  g int, l int,                                   -- bài học (không bắt buộc)
  yt_url text not null default '',
  yt_vid text,                                    -- mã video YouTube (chỉ trả cho học sinh đăng nhập, đúng lớp, khi đang live)
  starts_at timestamptz not null,
  minutes int not null default 90,
  note text not null default '',
  status text not null default 'scheduled',       -- scheduled | live | ended
  started_at timestamptz, ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists live_sessions_start_idx on public.live_sessions (starts_at);

create table if not exists public.live_presence (
  session_id bigint not null references public.live_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  seconds int not null default 0,
  tab text, tab_at timestamptz,
  dup_n int not null default 0,                   -- số lần phát hiện mở cùng lúc ở hai nơi
  primary key (session_id, student_id)
);

create table if not exists public.live_chat (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.live_sessions(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,   -- null = giáo viên
  name text not null,
  msg text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists live_chat_s_idx on public.live_chat (session_id, id);

create table if not exists public.live_polls (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.live_sessions(id) on delete cascade,
  qid text,
  q text not null default '',
  o jsonb not null default '[]'::jsonb,
  key int,                                        -- vị trí đáp án đúng (null = câu khảo sát, không chấm)
  seconds int not null default 30,
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  status text not null default 'open'             -- open | closed | revealed
);
create index if not exists live_polls_s_idx on public.live_polls (session_id, id);

create table if not exists public.live_answers (
  poll_id bigint not null references public.live_polls(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  ans int not null,
  ok boolean,
  ms int,                                         -- thời gian trả lời (mili giây kể từ lúc mở câu)
  at timestamptz not null default now(),
  primary key (poll_id, student_id)
);

alter table public.live_sessions enable row level security;
alter table public.live_presence enable row level security;
alter table public.live_chat enable row level security;
alter table public.live_polls enable row level security;
alter table public.live_answers enable row level security;

-- trạng thái hiệu lực: buổi "live" quá giờ dự kiến 3 tiếng thì coi như đã kết thúc
create or replace function public._live_status(s public.live_sessions) returns text
language sql stable as $$
  select case when s.status = 'live' and now() > s.starts_at + make_interval(mins => s.minutes) + interval '3 hours' then 'ended' else s.status end
$$;

create or replace function public._live_card(s public.live_sessions) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'title', s.title, 'g', s.g, 'l', s.l, 'starts_at', s.starts_at, 'minutes', s.minutes,
    'note', s.note, 'status', public._live_status(s), 'started_at', s.started_at, 'ended_at', s.ended_at,
    'classes', (select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb) from public.classes c where c.id = any(s.class_ids)))
$$;

-- học sinh: các buổi học của lớp em (đang live, sắp tới 14 ngày, đã học 7 ngày qua)
create or replace function public.live_list(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid uuid; cid bigint;
begin
  sid := public._sess(p_token);
  select class_id into cid from public.students where id = sid;
  return coalesce((select jsonb_agg(public._live_card(s) order by s.starts_at)
    from public.live_sessions s
   where cid = any(s.class_ids)
     and s.starts_at < now() + interval '14 days'
     and (public._live_status(s) <> 'ended' or coalesce(s.ended_at, s.starts_at) > now() - interval '7 days')), '[]'::jsonb);
end $$;

-- học sinh: vào phòng / nhịp tim (mỗi vài giây) — trả trạng thái, video, câu hỏi đang mở, tin nhắn mới
create or replace function public.live_state(p_token uuid, p_session bigint, p_tab text default null, p_after bigint default 0)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; st public.students; s public.live_sessions; stt text; pr public.live_presence; dup boolean := false;
        pl public.live_polls; my public.live_answers; poll jsonb; res jsonb; summary jsonb;
begin
  sid := public._sess(p_token);
  select * into st from public.students where id = sid;
  select * into s from public.live_sessions where id = p_session;
  if not found or not (st.class_id = any(s.class_ids)) then return jsonb_build_object('error', 'Không tìm thấy buổi học của lớp em.'); end if;
  stt := public._live_status(s);
  -- điểm danh khi đang live
  if stt = 'live' then
    select * into pr from public.live_presence where session_id = s.id and student_id = sid;
    if not found then
      insert into public.live_presence(session_id, student_id, tab, tab_at) values (s.id, sid, p_tab, now());
    else
      dup := p_tab is not null and pr.tab is not null and pr.tab <> p_tab and pr.tab_at > now() - interval '40 seconds';
      update public.live_presence
         set seconds = seconds + case when last_at > now() - interval '60 seconds' then least(extract(epoch from now() - last_at)::int, 60) else 0 end,
             last_at = now(), tab = coalesce(p_tab, tab), tab_at = now(), dup_n = dup_n + case when dup then 1 else 0 end
       where session_id = s.id and student_id = sid;
    end if;
  end if;
  -- câu hỏi nhanh gần nhất (đang mở, hoặc vừa công bố trong 2 phút)
  select * into pl from public.live_polls where session_id = s.id and (status = 'open' or (status in ('closed', 'revealed') and closes_at > now() - interval '2 minutes'))
   order by id desc limit 1;
  if found then
    if pl.status = 'open' and now() > pl.closes_at then
      update public.live_polls set status = 'closed' where id = pl.id; pl.status := 'closed';
    end if;
    select * into my from public.live_answers where poll_id = pl.id and student_id = sid;
    if pl.status = 'revealed' then
      select jsonb_build_object('counts', (select coalesce(jsonb_agg(c order by i), '[]'::jsonb) from (
                 select i, (select count(*) from public.live_answers a where a.poll_id = pl.id and a.ans = i) c
                 from generate_series(0, greatest(jsonb_array_length(pl.o), 1) - 1) i) z),
               'n', (select count(*) from public.live_answers a where a.poll_id = pl.id)) into res;
    end if;
    poll := jsonb_build_object('id', pl.id, 'q', pl.q, 'o', pl.o, 'status', pl.status, 'graded', pl.key is not null,
      'left_ms', greatest(0, (extract(epoch from pl.closes_at - now()) * 1000)::int), 'seconds', pl.seconds,
      'my', case when my.poll_id is not null then my.ans end,
      'key', case when pl.status = 'revealed' then pl.key end,
      'ok', case when pl.status = 'revealed' then my.ok end, 'res', res);
  end if;
  if stt = 'ended' then
    select jsonb_build_object('answered', count(a.*), 'correct', count(*) filter (where a.ok),
                              'polls', (select count(*) from public.live_polls x where x.session_id = s.id and x.key is not null),
                              'seconds', (select seconds from public.live_presence where session_id = s.id and student_id = sid))
      into summary
      from public.live_polls p join public.live_answers a on a.poll_id = p.id and a.student_id = sid where p.session_id = s.id;
  end if;
  return jsonb_build_object(
    'session', public._live_card(s), 'server_now', now(),
    'vid', case when stt = 'live' then s.yt_vid end,
    'me', jsonb_build_object('name', st.full_name, 'code', st.code),
    'dup', dup,
    'online', (select count(*) from public.live_presence where session_id = s.id and last_at > now() - interval '25 seconds'),
    'poll', poll, 'summary', summary,
    'chat', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 't', c.student_id is null, 'me', c.student_id = sid,
                        'msg', c.msg, 'at', c.created_at) order by c.id)
                      from (select * from public.live_chat where session_id = s.id and id > coalesce(p_after, 0) and not hidden
                            order by id desc limit 60) c), '[]'::jsonb),
    'hidden', coalesce((select jsonb_agg(id) from public.live_chat where session_id = s.id and hidden and id > coalesce(p_after, 0) - 200), '[]'::jsonb));
end $$;

create or replace function public.live_chat_send(p_token uuid, p_session bigint, p_msg text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; st public.students; s public.live_sessions; m text := btrim(coalesce(p_msg, ''));
begin
  sid := public._sess(p_token);
  select * into st from public.students where id = sid;
  select * into s from public.live_sessions where id = p_session;
  if not found or not (st.class_id = any(s.class_ids)) or public._live_status(s) <> 'live' then
    return jsonb_build_object('error', 'Buổi học chưa bắt đầu hoặc đã kết thúc.'); end if;
  if m = '' then return jsonb_build_object('error', 'Tin nhắn trống.'); end if;
  if exists (select 1 from public.live_chat where session_id = s.id and student_id = sid and created_at > now() - interval '3 seconds') then
    return jsonb_build_object('error', 'Em gửi chậm lại một chút nhé.'); end if;
  insert into public.live_chat(session_id, student_id, name, msg) values (s.id, sid, st.full_name, left(m, 300));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.live_answer(p_token uuid, p_poll bigint, p_ans int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare sid uuid; st public.students; pl public.live_polls; s public.live_sessions;
begin
  sid := public._sess(p_token);
  select * into st from public.students where id = sid;
  select * into pl from public.live_polls where id = p_poll;
  if not found then return jsonb_build_object('error', 'Không tìm thấy câu hỏi.'); end if;
  select * into s from public.live_sessions where id = pl.session_id;
  if not (st.class_id = any(s.class_ids)) then return jsonb_build_object('error', 'Không tìm thấy câu hỏi.'); end if;
  if pl.status <> 'open' or now() > pl.closes_at + interval '2 seconds' then return jsonb_build_object('error', 'Đã hết giờ trả lời câu này.', 'closed', true); end if;
  if p_ans is null or p_ans < 0 or p_ans >= jsonb_array_length(pl.o) then return jsonb_build_object('error', 'Phương án không hợp lệ.'); end if;
  insert into public.live_answers(poll_id, student_id, ans, ok, ms)
  values (pl.id, sid, p_ans, case when pl.key is null then null else p_ans = pl.key end, (extract(epoch from now() - pl.opened_at) * 1000)::int)
  on conflict (poll_id, student_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- GIÁO VIÊN
create or replace function public.t_live_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
  return coalesce((select jsonb_agg(public._live_card(s) || jsonb_build_object(
      'yt_url', s.yt_url, 'class_ids', to_jsonb(s.class_ids),
      'n_students', (select count(*) from public.students x where x.class_id = any(s.class_ids) and x.active),
      'n_joined', (select count(*) from public.live_presence p where p.session_id = s.id),
      'n_polls', (select count(*) from public.live_polls p where p.session_id = s.id))
    order by (public._live_status(s) = 'live') desc, (public._live_status(s) = 'ended'), case when public._live_status(s) = 'ended' then -extract(epoch from s.starts_at) else extract(epoch from s.starts_at) end)
    from public.live_sessions s where s.starts_at > now() - interval '60 days'), '[]'::jsonb);
end $$;

create or replace function public.t_live_save(p_id bigint, p_title text, p_classes jsonb, p_starts timestamptz, p_minutes int,
                                              p_url text, p_g int default null, p_l int default null, p_note text default '') returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare pv text[]; cls bigint[]; nid bigint;
begin
  perform public._need_teacher();
  if btrim(coalesce(p_title, '')) = '' then return jsonb_build_object('error', 'Nhập tên buổi học.'); end if;
  cls := array(select (jsonb_array_elements_text(coalesce(p_classes, '[]'::jsonb)))::bigint);
  if cardinality(cls) = 0 then return jsonb_build_object('error', 'Chọn ít nhất một lớp.'); end if;
  if p_starts is null then return jsonb_build_object('error', 'Chọn giờ bắt đầu.'); end if;
  if btrim(coalesce(p_url, '')) <> '' then
    pv := public._video_parse(p_url);
    if pv is null or pv[1] <> 'yt' then return jsonb_build_object('error', 'Link YouTube chưa đúng. Dán link buổi live dạng https://www.youtube.com/live/… hoặc https://youtu.be/…'); end if;
  end if;
  if p_id is null then
    insert into public.live_sessions(title, class_ids, g, l, yt_url, yt_vid, starts_at, minutes, note)
    values (left(btrim(p_title), 150), cls, p_g, p_l, btrim(coalesce(p_url, '')), pv[2], p_starts, least(greatest(coalesce(p_minutes, 90), 10), 300), left(coalesce(p_note, ''), 500))
    returning id into nid;
  else
    update public.live_sessions set title = left(btrim(p_title), 150), class_ids = cls, g = p_g, l = p_l, yt_url = btrim(coalesce(p_url, '')), yt_vid = pv[2],
           starts_at = p_starts, minutes = least(greatest(coalesce(p_minutes, 90), 10), 300), note = left(coalesce(p_note, ''), 500)
     where id = p_id returning id into nid;
  end if;
  return jsonb_build_object('ok', true, 'id', nid);
end $$;

create or replace function public.t_live_status(p_id bigint, p_status text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
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
end $$;

-- giáo viên: bảng điều khiển (điểm danh, trò chuyện, câu hỏi nhanh)
create or replace function public.t_live_state(p_id bigint, p_after bigint default 0) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare s public.live_sessions;
begin
  perform public._need_teacher();
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
end $$;

create or replace function public.t_live_chat(p_id bigint, p_msg text default null, p_hide bigint default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
  if p_hide is not null then update public.live_chat set hidden = not hidden where id = p_hide and session_id = p_id;
  elsif btrim(coalesce(p_msg, '')) <> '' then insert into public.live_chat(session_id, name, msg) values (p_id, 'Thầy', left(btrim(p_msg), 500));
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- giáo viên: mở câu hỏi nhanh (từ ngân hàng theo mã câu, hoặc tự gõ / chỉ chọn A–D theo câu viết trên bảng)
create or replace function public.t_live_poll(p_id bigint, p_seconds int, p_qid text default null, p_q text default null,
                                              p_o jsonb default null, p_key int default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare q public.questions; k int; nid bigint; secs int := least(greatest(coalesce(p_seconds, 30), 10), 600);
begin
  perform public._need_teacher();
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
end $$;

create or replace function public.t_live_poll_set(p_poll bigint, p_action text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._need_teacher();
  if p_action = 'close' then update public.live_polls set status = 'closed', closes_at = least(closes_at, now()) where id = p_poll and status = 'open';
  elsif p_action = 'reveal' then update public.live_polls set status = 'revealed', closes_at = least(closes_at, now()) where id = p_poll;
  elsif p_action = 'add30' then update public.live_polls set closes_at = greatest(closes_at, now()) + interval '30 seconds', status = 'open' where id = p_poll and status <> 'revealed';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- giáo viên: câu trắc nghiệm trong ngân hàng của một bài (để chọn nhanh khi đang live)
create or replace function public.t_live_bank(p_g int, p_l int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._need_teacher();
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'q', q.q, 'o', q.o, 'lv', q.lv, 'key', (a.k #>> '{}')::int, 'tag', q.tag)
                   order by case q.lv when 'NB' then 0 when 'TH' then 1 when 'VD' then 2 else 3 end, q.id)
    from (select * from public.questions where active and t = 'MC' and g = p_g and l = p_l limit 300) q
    left join public.answers a on a.qid = q.id), '[]'::jsonb);
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('_live_status', '_live_card', 'live_list', 'live_state', 'live_chat_send', 'live_answer',
             't_live_list', 't_live_save', 't_live_status', 't_live_state', 't_live_chat', 't_live_poll', 't_live_poll_set', 't_live_bank') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('live_list', 'live_state', 'live_chat_send', 'live_answer') then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname like 't\_%' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

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
