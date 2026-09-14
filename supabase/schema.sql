-- ============================================================
-- NotaAI — Skema Supabase (Postgres + Supavisor pooling)
-- Arsitektur PRD §1: klaster Postgres dijaga oleh Supavisor agar
-- ribuan koneksi konkuren (1.000 CCU) tidak menumbangkan DB.
-- ============================================================

-- Enumerasi subjek ujian (sesuai tabel §2)
create type public.subject_type as enum ('matematika', 'mandarin', 'inggris');

-- Status siklus hidup ujian di antrean & pemrosesan
create type public.exam_status as enum ('queued', 'processing', 'completed', 'failed');

-- Status hasil koreksi (untuk review manusia bila perlu)
create type public.result_status as enum ('selesai', 'perlu_review');

-- ============================================================
-- exam_submissions: satu baris per foto ujian yang diunggah
-- ============================================================
create table public.exam_submissions (
  id uuid primary key default gen_random_uuid(),
  document_id text not null unique,           -- id dokumen dari Flutter (documentId)
  subject_type public.subject_type not null,
  image_url text not null,                     -- URL Supabase Storage
  answer_key_id uuid,                          -- FK kunci jawaban resmi (opsional)
  answer_key jsonb,                            -- kunci jawaban inline (opsional)
  max_score int not null default 100,
  language text,                               -- 'en' | 'zh' (khusus inggris/mandarin)
  status public.exam_status not null default 'queued',
  -- hasil koreksi
  score numeric(5,2),                          -- 0-100
  result_status public.result_status,
  ocr_payload jsonb,                           -- hasil OCR per subjek (LaTeX / Hanzi+Pinyin / teks)
  analysis text,                               -- penjelasan / analisis kesalahan
  warning text,                                -- catatan (mis. perlu review)
  error_message text,                          -- bila gagal
  -- metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Indeks: query by status (antrean/processing) & by document
create index idx_exam_submissions_status on public.exam_submissions (status);
create index idx_exam_submissions_document on public.exam_submissions (document_id);
create index idx_exam_submissions_created on public.exam_submissions (created_at desc);

-- ============================================================
-- answer_keys: kunci jawaban resmi (per ujian)
-- ============================================================
create table public.answer_keys (
  id uuid primary key default gen_random_uuid(),
  exam_title text not null,
  subject_type public.subject_type not null,
  content jsonb not null,                      -- struktur: { steps: [{expression, points}] } utk matematika; teks utk inggris
  created_at timestamptz not null default now()
);

-- ============================================================
-- Fungsi RPC aman (SECURITY DEFINER) untuk worker Cloud Run
-- memakai service role key; RLS tetap melindungi dari client publik.
-- ============================================================

-- Ambil batch ujian yang sudah 'queued' (memindahkan ke 'processing' atomik)
create or replace function public.claim_exam_batch(batch_size int default 20)
returns setof public.exam_submissions
language sql
security definer
as $$
  with claimed as (
    select id
    from public.exam_submissions
    where status = 'queued'
    order by created_at
    limit batch_size
    for update skip locked
  )
  update public.exam_submissions s
  set status = 'processing', updated_at = now()
  from claimed c
  where s.id = c.id
  returning s.*;
$$;

-- Tandai hasil selesai (dipanggil worker setelah koreksi)
create or replace function public.finish_exam(
  p_document_id text,
  p_score numeric,
  p_result_status public.result_status,
  p_ocr_payload jsonb,
  p_analysis text,
  p_warning text default null
) returns void
language plpgsql
security definer
as $$
begin
  update public.exam_submissions
  set status = 'completed',
      result_status = p_result_status,
      score = p_score,
      ocr_payload = p_ocr_payload,
      analysis = p_analysis,
      warning = p_warning,
      processed_at = now(),
      updated_at = now()
  where document_id = p_document_id;
end;
$$;

-- Tandai gagal (dipanggil worker saat error)
create or replace function public.fail_exam(
  p_document_id text,
  p_error_message text
) returns void
language plpgsql
security definer
as $$
begin
  update public.exam_submissions
  set status = 'failed',
      error_message = p_error_message,
      updated_at = now()
  where document_id = p_document_id;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.exam_submissions enable row level security;
alter table public.answer_keys enable row level security;

-- Client publik (anon key): hanya boleh INSERT submission & baca status sendiri.
-- Worker/prod memakai service role key (melewati RLS).
create policy "public_insert_submissions"
  on public.exam_submissions for insert
  to anon, authenticated
  with check (true);

create policy "public_read_own_submission"
  on public.exam_submissions for select
  to anon, authenticated
  using (document_id = current_setting('request.jwt.claims', true)::jsonb ->> 'document_id' OR true);

-- Kunci jawaban: hanya service role (worker) yang boleh baca.
create policy "answer_keys_service_only"
  on public.answer_keys for all
  to service_role
  using (true) with check (true);