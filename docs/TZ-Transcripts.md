# Техническое задание: Система транскриптов WordBeacon

## Цель

Транскрипты становятся первоклассными сущностями с собственным lifecycle — настройка, создание, хранение, доступ и распространение. Каждый транскрипт получает свою ссылку и QR-код.

## Текущее состояние

Сейчас транскрипты — это побочный продукт записи: при завершении трансляции `recorder.ts` сохраняет массив `{timestamp, sourceText, translations}` в таблицу `transcript_records`, привязанную к `broadcast_logs`. AI-анализ (summary, action items, key decisions) генерируется через Claude API и сохраняется как JSON в `broadcast_logs.ai_analysis`.

Доступ: только владелец комнаты через Dashboard (Audio/Transcript/Summary).

## Новая архитектура

### Сущности

```
Room (комната)
  ├─ transcript_settings (настройки транскрипции)
  │   ├─ enabled: boolean
  │   ├─ types: ['verbatim', 'summary']
  │   └─ access: 'owner' | 'invited' | 'public'
  │
  └─ Sessions (сессии — каждое использование комнаты)
      ├─ Session 1: "Sunday Service — Apr 20, 2026 10:00"
      │   ├─ Verbatim Transcript
      │   │   ├─ Original (source language)
      │   │   └─ Translations (per target language)
      │   ├─ Summary
      │   │   ├─ Original language
      │   │   └─ Translated summaries
      │   ├─ Audio Recording (MP3 in R2)
      │   └─ Shareable link + QR code
      │
      └─ Session 2: "Sunday Service — Apr 27, 2026 10:00"
          └─ ...
```

### Именование сессий

Формат: `{Room Name} — {MMM DD, YYYY HH:mm}`

Примеры:
- "Sunday Service — Apr 20, 2026 10:00"
- "Team Standup — Apr 21, 2026 09:30"

### Типы транскриптов

#### 1. Verbatim (дословный)

Полный текст всего, что было сказано. Сохраняется в реальном времени во время трансляции.

**Содержит:**
- Оригинальный текст на языке спикера (source)
- Переводы на все языки, на которые велся перевод во время трансляции
- Timestamps для каждого сегмента

**Формат хранения:**
```json
{
  "segments": [
    {
      "timestamp": 1776596478191,
      "source": "Good morning everyone",
      "sourceLanguage": "en",
      "translations": {
        "ru": "Доброе утро всем",
        "es": "Buenos días a todos"
      }
    }
  ]
}
```

#### 2. Summary (краткое содержание)

Генерируется AI (Claude) после завершения сессии. Содержит:
- Резюме (3-5 предложений)
- Action items (задачи)
- Key decisions (решения)

**Генерируется на:**
- Языке оригинала (source language)
- На каждом языке, на который велся перевод

**Формат хранения:**
```json
{
  "original": {
    "language": "en",
    "summary": "The meeting covered budget planning...",
    "actionItems": ["Prepare report by Friday", ...],
    "keyDecisions": ["MVP launch moved to May 15", ...]
  },
  "translations": {
    "ru": {
      "summary": "На встрече обсуждалось планирование бюджета...",
      "actionItems": ["Подготовить отчёт к пятнице", ...],
      "keyDecisions": ["Запуск MVP перенесён на 15 мая", ...]
    }
  }
}
```

#### 3. Будущие типы (не в MVP)

- **Recap** — ультра-краткий обзор (1-2 предложения)
- **Examples** — ключевые цитаты и примеры из речи
- **Meeting Minutes** — формальный протокол встречи с решениями, задачами и дедлайнами
- **Q&A** — вопросы и ответы, извлечённые из диалога

## Схема базы данных

### Новые таблицы

```sql
-- Настройки транскрипции для комнаты
-- (добавляется как колонки в rooms)
ALTER TABLE rooms ADD COLUMN transcript_enabled INTEGER DEFAULT 1;
ALTER TABLE rooms ADD COLUMN transcript_types TEXT DEFAULT '["verbatim","summary"]';
ALTER TABLE rooms ADD COLUMN transcript_access TEXT DEFAULT 'owner';

-- Сессии (каждое использование комнаты)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,              -- "Sunday Service — Apr 20, 2026 10:00"
  slug TEXT UNIQUE NOT NULL,       -- auto-generated: "sunday-service-2026-04-20-1000"
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_minutes INTEGER,
  peak_listeners INTEGER DEFAULT 0,
  source_language TEXT,
  audio_url TEXT,                  -- R2 key
  status TEXT DEFAULT 'live',      -- 'live' | 'processing' | 'complete'
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Транскрипты (привязаны к сессии)
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'verbatim' | 'summary'
  language TEXT NOT NULL,          -- 'en', 'ru', etc. или 'multi' для verbatim с переводами
  content TEXT NOT NULL,           -- JSON content
  slug TEXT UNIQUE NOT NULL,       -- для shareable link
  access TEXT DEFAULT 'owner',     -- 'owner' | 'invited' | 'public'
  qr_id TEXT,
  qr_image_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_sessions_room ON sessions(room_id);
CREATE INDEX idx_sessions_slug ON sessions(slug);
CREATE INDEX idx_transcripts_session ON transcripts(session_id);
CREATE INDEX idx_transcripts_slug ON transcripts(slug);
```

### Миграция существующих данных

```sql
-- Перенести broadcast_logs → sessions
-- Перенести transcript_records → transcripts (type='verbatim')
-- Перенести ai_analysis → transcripts (type='summary')
```

## API Endpoints

### Настройки транскрипции (при создании/обновлении комнаты)

```
PUT /api/rooms/:id
{
  "transcriptEnabled": true,
  "transcriptTypes": ["verbatim", "summary"],
  "transcriptAccess": "public"
}
```

### Сессии

```
GET /api/rooms/:slug/sessions              — список сессий комнаты
GET /api/sessions/:sessionId               — детали сессии
GET /api/sessions/:sessionId/audio         — скачать аудио
```

### Транскрипты

```
GET /api/transcripts/:slug                 — публичный доступ к транскрипту (по slug)
GET /api/sessions/:sessionId/transcripts   — все транскрипты сессии
GET /api/transcripts/:id/download?format=txt|json|pdf  — скачать
POST /api/transcripts/:id/qr              — создать QR-код для транскрипта
```

### Публичные страницы

```
/t/:slug                                  — публичная страница транскрипта
```

Примеры URL:
- `wordbeacon.com/t/sunday-service-2026-04-20-verbatim`
- `wordbeacon.com/t/sunday-service-2026-04-20-summary-ru`

## UI — Создание комнаты

В форме создания комнаты (Dashboard) добавить секцию "Transcription":

```
┌─────────────────────────────────────┐
│ Transcription Settings              │
│                                     │
│ [✓] Enable transcription            │
│                                     │
│ Transcript types:                   │
│   [✓] Verbatim (full transcript)    │
│   [✓] Summary (AI-generated)        │
│                                     │
│ Access:                             │
│   (•) Only me                       │
│   ( ) Invited members               │
│   ( ) Public (anyone with link)     │
└─────────────────────────────────────┘
```

## UI — Sessions в Dashboard

Вместо плоского "Broadcast History" → вложенная структура:

```
My Rooms
  ├─ Sunday Service (/room/sunday)
  │   ├─ Sessions:
  │   │   ├─ Apr 20, 2026 10:00  47min  12 listeners
  │   │   │   ├─ [Audio] [Verbatim] [Summary] [Share]
  │   │   │   └─ (expandable summary block)
  │   │   ├─ Apr 13, 2026 10:00  52min  8 listeners
  │   │   │   └─ ...
  │   │   └─ Apr 6, 2026 10:00  45min  15 listeners
  │   │       └─ ...
  │   └─ [Broadcast] [Copy Link] [Settings]
  │
  └─ Team Standup (/room/standup)
      └─ ...
```

## UI — Публичная страница транскрипта

`wordbeacon.com/t/:slug`

```
┌─────────────────────────────────────────┐
│ WordBeacon                              │
│                                         │
│ Sunday Service                          │
│ April 20, 2026 • 47 minutes             │
│                                         │
│ ┌─── Summary ─────────────────────────┐ │
│ │ The service focused on community     │ │
│ │ outreach and upcoming events...      │ │
│ │                                      │ │
│ │ Action Items:                        │ │
│ │ • Volunteer sign-up by Wednesday     │ │
│ │ • Contact local shelters             │ │
│ │                                      │ │
│ │ Key Decisions:                       │ │
│ │ • Food drive scheduled for May 3     │ │
│ └──────────────────────────────────────┘ │
│                                         │
│ Language: [English ▼] [Russian ▼]       │
│                                         │
│ [Download TXT] [Download JSON]          │
│                                         │
│ QR Code: [image]  Share: [copy link]    │
└─────────────────────────────────────────┘
```

## Поток данных (lifecycle)

```
1. СОЗДАНИЕ КОМНАТЫ
   Owner → Create Room → transcript_enabled=true, types=['verbatim','summary']

2. НАЧАЛО ТРАНСЛЯЦИИ
   Broadcaster → Start → создаётся Session:
     name = "{room.name} — {formatDate(now)}"
     slug = generateSlug(name)
     status = 'live'

3. ВО ВРЕМЯ ТРАНСЛЯЦИИ
   Audio chunks → recorder (как сейчас)
   Transcripts → recorder (как сейчас)
   
4. ЗАВЕРШЕНИЕ ТРАНСЛЯЦИИ
   recorder.finalize():
     a) status = 'processing'
     b) Сохранить verbatim transcript → transcripts table
        - Создать slug: "{session.slug}-verbatim"
        - Генерировать QR-код
     c) Загрузить аудио в R2
     d) Запустить AI-анализ (summary)
        - На языке оригинала
        - На каждом языке перевода
        - Для каждого языка → отдельная запись в transcripts table
        - Slug: "{session.slug}-summary-{lang}"
        - Генерировать QR-код
     e) status = 'complete'

5. ПОСЛЕ ТРАНСЛЯЦИИ
   Dashboard → Sessions → скачать/поделиться
   Public page → /t/:slug → просмотр с выбором языка
```

## Summary на нескольких языках

После завершения трансляции AI-анализ генерируется:

1. **На языке оригинала** — анализ source-текста
2. **На каждом языке перевода** — отдельный вызов Claude API с промптом:
   ```
   "Respond in {targetLanguage}. Analyze this transcript..."
   ```
   Или перевести готовый summary через DeepL.

Каждый языковой вариант summary — отдельная запись в `transcripts`:
- `sunday-service-2026-04-20-summary-en`
- `sunday-service-2026-04-20-summary-ru`
- `sunday-service-2026-04-20-summary-es`

## Доступ и безопасность

| Уровень | Кто видит | Как |
|---------|-----------|-----|
| `owner` | Только создатель комнаты | Авторизация через сессию |
| `invited` | Все кто был в комнате | По списку user_id + email |
| `public` | Все | Доступ по ссылке `/t/:slug` без авторизации |

## Совместимость с текущим кодом

### Что переиспользуется
- `recorder.ts` — захват аудио и транскриптов (без изменений)
- `ai-analysis.ts` — анализ через Claude API (расширить для multi-language)
- `r2.ts` — хранение аудио в R2
- `qr.ts` / `qr-local.ts` — генерация QR-кодов (переиспользовать для транскриптов)

### Что заменяется
- `broadcast_logs` → `sessions` (новая таблица, broadcast_logs остаётся для обратной совместимости)
- `transcript_records` → `transcripts` (новая таблица с расширенной структурой)
- Плоский "Broadcast History" → вложенные Sessions по комнатам

### Миграция
- Существующие `broadcast_logs` конвертируются в `sessions`
- Существующие `transcript_records` конвертируются в `transcripts` (type='verbatim')
- Существующие `ai_analysis` конвертируются в `transcripts` (type='summary')

## Этапы реализации

### Этап 1: Инфраструктура (MVP)
- Новые таблицы: `sessions`, `transcripts`
- Настройки транскрипции в комнатах
- Автоматическое создание Session при начале трансляции
- Verbatim transcript с оригиналом + переводами
- Summary на языке оригинала

### Этап 2: Мультиязычный Summary
- Summary генерируется на каждом языке перевода
- Отдельные записи transcripts для каждого языка

### Этап 3: Публичный доступ
- Shareable links: `/t/:slug`
- QR-коды для транскриптов
- Публичная страница просмотра

### Этап 4: Расширенные типы
- Meeting minutes
- Recap
- Q&A
- Кастомные шаблоны

### Этап 5: Управление доступом
- Invited access (по email/user_id)
- Управление доступом из Dashboard
