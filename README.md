# NotaAI — Sistem Koreksi Ujian Multibahasa Skala Tinggi (PRD 1.000 CCU)

Implementasi dari `NotaAI_HighScale_ExamModule_Specification.pdf` — platform
koreksi ujian berbasis **foto** dengan arsitektur **async event-driven queue**
(tahan lonjakan 1.000 pengguna aktif bersamaan), OCR **per-subjek**, dan mesin
koreksi deterministik **+ LLM** (Gemini 2.5 Flash).

## Fitur (sesuai PRD)

| PRD                             | Implementasi                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **§1** Arsitektur async         | Queue (Upstash Kafka REST / in-memory), producer cepat (<50 ms), worker auto-scale (Cloud Run), Supabase + Supavisor pooling |
| **§2** Subjek Matematika        | OCR **Mathpix** → **LaTeX murni** (`$$ ... $$`); engine skor deterministik + korektor LLM                                    |
| **§2** Bahasa Mandarin          | OCR **Google Vision** (`languageHint: zh`) → **Hanzi + Pinyin**; flag review guru                                            |
| **§2** Bahasa Inggris           | **Google Vision + Gemini 2.5 Flash** → teks digital & **Auto-Grammar**                                                       |
| **§3** Prompt JSON (Matematika) | System prompt & parser JSON `{"status_jawaban", "transkripsi_langkah_latex", "analisis_kesalahan", "nilai_rekomendasi"}`     |
| **§4** Producer Kafka           | Edge Function Supabase mem-produce ke Upstash Kafka REST (`producer.produce('ocr-processing-queue', ...)`)                   |
| Flutter (pra-validasi)          | Validasi kualitas foto lokal (blur/gelap) sebelum upload                                                                     |

## Arsitektur

```
Flutter (upload foto + pra-validasi blur/gelap)
        │  upload ke Supabase Storage
        ▼
Supabase Edge Function ──produce──▶ Upstash Kafka (buffer <50ms)
                                        │ consume
                                        ▼
                              Cloud Run Worker (auto-scale horizontal)
                                  │ OCR per-subjek (Mathpix/Google Vision/Gemini)
                                  │ koreksi (engine + LLM)
                                  ▼
                        Supabase/Postgres (Supavisor pooling)
```

- **Producer** (Supabase Edge Function) → `producer.produce('ocr-processing-queue', { documentId, imageUrl, subjectType })` — persis pola §4.
- **Worker** (Cloud Run) → consumer memproses antrean; HTTP health + submit endpoint.
- **Kredensial OCR/LLM** → adapter nyata; fallback mock agar pipeline bisa diuji tanpa API key.

## Struktur

```
├── src/                    # Node.js/TS backend (Cloud Run worker)
│   ├── config/             # env zod (fail-fast)
│   ├── grading/            # prompt §3, math score engine, LLM grader
│   ├── ocr/                # Mathpix / Google Vision / English(Vision+Gemini) / mock
│   ├── pipeline/           # orchestrator async (OCR → grade → save)
│   ├── queue/              # memory (dev) & Upstash Kafka REST (prod)
│   ├── routes/             # Express API (health, submit)
│   ├── db/                 # repository contract (memory impl; Supabase SQL disediakan)
│   ├── server.ts           # bootstrap + error handler
│   └── index.ts            # entrypoint
├── edge-function/          # Supabase Edge Function (producer Kafka)
├── supabase/schema.sql     # tabel + RLS + fungsi RPC (Supavisor)
├── mobile/                 # Flutter app (upload + pra-validasi blur/gelap)
├── Dockerfile              # image Cloud Run
└── docker-compose.yml      # run worker lokal
```

## Menjalankan (backend)

```bash
npm install          # atau npm ci
cp .env.example .env # atur QUEUE_DRIVER / OCR_MODE / LLM_MODE
npm run dev          # development (tsx)
npm run build && npm start   # produksi (dist/)
```

**Mode default (tanpa API key):** `QUEUE_DRIVER=memory`, `OCR_MODE=mock`, `LLM_MODE=mock`
— seluruh pipeline (queue → OCR → grading → save) berjalan & bisa diuji end-to-end.

**Mode produksi (API key):** isi `.env`:

| Var                                                            | Untuk                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| `QUEUE_DRIVER=upstash` + `UPSTASH_KAFKA_URL/USERNAME/PASSWORD` | Upstash Kafka REST                                     |
| `MATHPIX_APP_ID` / `MATHPIX_APP_KEY`                           | OCR Matematika (LaTeX)                                 |
| `GOOGLE_VISION_API_KEY`                                        | OCR Mandarin & Inggris                                 |
| `GEMINI_API_KEY`                                               | Korektor LLM (grammar Inggris, nilai rekomendasi math) |
| `DATABASE_URL`                                                 | Supabase (Supavisor, `pgbouncer=true`)                 |

## Menjalankan (Flutter)

```bash
cd mobile
flutter pub get
flutter run
```

## Menjalankan (worker via Docker, tanpa Docker Desktop jalan)

```bash
docker compose up --build   # worker :8080 (OCR_MODE=mock)
```

## API

- `GET /api/v1/health` → `{ status, queue, ts }`
- `POST /api/v1/exams/submit` → `202` (diterima antrean):

```bash
curl -X POST http://localhost:8080/api/v1/exams/submit \
  -H 'Content-Type: application/json' \
  -d '{"documentId":"doc-1","imageUrl":"https://img.example.com/math.jpg","subjectType":"matematika","answerKey":"{\"steps\":[{\"expression\":\"x=2\",\"points\":1}],\"totalPoints\":1}"}'
```

## Verifikasi

```bash
npm test               # Jest (unit + integrasi, tanpa DB eksternal)
npm run typecheck      # tsc strict
npm run build          # bundle gate (tsc emit)
npm run format:check   # prettier
```

## Catatan

- **Fallback mock** memungkinkan uji penuh tanpa API key (OCR_MODE=mock / LLM_MODE=mock).
- **Upstash consume** via REST belum didukung — gunakan SDK konsumen di worker untuk
  produksi (`@upstash/kafka`), atau arahkan worker ke WebSocket consumer.
- **Mandarin** butuh review guru (skor default 0 + flag `perlu_review`).
- **Skor matematika** didasarkan engine deterministik (`scoreMathAnswer`) + dapat
  ditimpa `nilai_rekomendasi` LLM bila `LLM_MODE=real`.
- **Flutter** memerlukan Flutter SDK (belum terpasang di env ini); kode tersedia di
  `mobile/` dan mengikuti alur PRD §1 (pra-validasi → upload → Edge Function).
