# Техническое задание: Платные тарифы WordBeacon

## Цель

Реализовать три модели оплаты: бесплатное демо (20 минут), одноразовая покупка ($14.99), и подписки ($39-$159/мес). Интеграция с Stripe.

## Текущее состояние

Stripe интеграция уже реализована, но не активирована (STRIPE_SECRET_KEY не установлен). Есть:
- 3 плана в БД (starter, growing, multiplying)
- Checkout → Subscription → Usage tracking → Enforcement
- 60-дневный trial
- Webhook обработка
- Страница /pricing с UI

## Модели оплаты

### 1. Free Demo (бесплатно)

| Параметр | Значение |
|----------|----------|
| Стоимость | $0 |
| Минуты | 20 (на аккаунт, один раз за всё время) |
| Слушатели | до 50 |
| Языки | все |
| Требования | Авторизация (Google/Apple) |
| Записи | Да (аудио + транскрипты + AI анализ) |
| Функционал | Полный — всё что доступно в платных планах |

**Как работает:**
- Каждый новый пользователь получает 20 бесплатных минут автоматически при регистрации
- Не требует оплаты, не требует Stripe
- Минуты расходуются при broadcast'е (трекинг по 1 минуте, как сейчас)
- Когда 20 минут исчерпаны — показать "Upgrade to continue"
- Демо-минуты **не сбрасываются**

### 2. One-Time Payment (разовая покупка)

| Параметр | Значение |
|----------|----------|
| Стоимость | $14.99 |
| Минуты | 120 (2 часа) |
| Слушатели | до 100 |
| Языки | все |
| Срок | Без срока — минуты не сгорают |
| Записи | Да (аудио + транскрипты + AI анализ) |

**Как работает:**
- Пользователь покупает "Event Pass" через Stripe Checkout (payment mode, не subscription)
- После оплаты — в БД создаётся запись с 120 минутами
- Минуты расходуются при broadcast'е
- Можно купить несколько Event Pass — минуты накапливаются
- Нет автопродления, нет подписки

### 3. Subscriptions (подписки)

| План | Monthly | Yearly | Listeners | Minutes/mo | Languages | Записи |
|------|---------|--------|-----------|------------|-----------|--------|
| Starter | $39 | $372/yr ($31/mo) | 50 | 480 (8h) | 7 | Да |
| Growing | $79 | $756/yr ($63/mo) | 150 | 1440 (24h) | 7 | Да |
| Multiplying | $159 | $1524/yr ($127/mo) | 400 | 3600 (60h) | 7 | Да |

**60-дневный trial** — для первой подписки (как сейчас)

## Схема базы данных

### Изменения в существующих таблицах

```sql
-- Добавить free demo minutes tracking к users
ALTER TABLE users ADD COLUMN demo_minutes_remaining INTEGER DEFAULT 20;
ALTER TABLE users ADD COLUMN demo_minutes_used INTEGER DEFAULT 0;
```

### Новая таблица: one_time_passes

```sql
CREATE TABLE IF NOT EXISTS one_time_passes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_payment_id TEXT,           -- Stripe PaymentIntent ID
  minutes_total INTEGER NOT NULL,   -- 120
  minutes_used INTEGER DEFAULT 0,
  max_listeners INTEGER NOT NULL,   -- 100
  status TEXT DEFAULT 'active',     -- 'active' | 'exhausted'
  purchased_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Новый план в plans table

```sql
INSERT OR IGNORE INTO plans (id, name, price_monthly, price_yearly, max_listeners, max_languages, minutes_per_month, stripe_price_monthly, stripe_price_yearly)
VALUES ('event_pass', 'Event Pass', 1499, 0, 100, 13, 120, null, null);
```

## Логика определения доступа при broadcast

При начале трансляции проверять в порядке приоритета:

```
1. Есть активная подписка? → использовать подписку (как сейчас)
2. Есть Event Pass с оставшимися минутами? → использовать Event Pass
3. Есть demo минуты? → использовать demo
4. Ничего → "No minutes remaining. Choose a plan."
```

### Usage tracking refactor

Сейчас `incrementUsage` привязан к `subscriptions`. Нужно абстрагировать:

```typescript
interface UsageSource {
  type: 'subscription' | 'event_pass' | 'demo';
  id: string; // subscription.id, pass.id, или user.id
  minutesRemaining: number;
  maxListeners: number;
}

function getActiveUsageSource(userId: string): UsageSource | null
function consumeMinute(source: UsageSource): boolean // true если успешно, false если исчерпаны
```

## Stripe интеграция

### Stripe Products & Prices (создать в Stripe Dashboard)

**Подписки (уже есть в плане):**
- Product: "Starter Plan" → 2 prices (monthly $39, yearly $372)
- Product: "Growing Plan" → 2 prices (monthly $79, yearly $756)
- Product: "Multiplying Plan" → 2 prices (monthly $159, yearly $1524)

**One-time:**
- Product: "Event Pass — 2 Hour Broadcast" → 1 price ($14.99, one-time)

### Checkout Sessions

**Для подписок** (subscription mode — уже реализовано):
```typescript
stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: stripePriceId, quantity: 1 }],
  metadata: { userId, planId, billingPeriod, isTrial },
  subscription_data: { trial_period_days: withTrial ? 60 : undefined },
  ...
})
```

**Для Event Pass** (payment mode — новое):
```typescript
stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price: eventPassPriceId, quantity: 1 }],
  metadata: { userId, type: 'event_pass' },
  ...
})
```

### Webhook обработка

Добавить в `checkout.session.completed`:
```typescript
if (session.mode === 'payment' && metadata.type === 'event_pass') {
  // Создать one_time_pass запись в БД
  createOneTimePass({
    userId: metadata.userId,
    stripePaymentId: session.payment_intent,
    minutesTotal: 120,
    maxListeners: 100,
  });
}
```

## API Endpoints

### Существующие (без изменений)
- `GET /api/billing/plans` — список планов
- `GET /api/billing/subscription` — статус подписки
- `POST /api/billing/checkout` — начать checkout
- `POST /api/billing/portal` — управление подпиской
- `GET /api/billing/broadcasts` — история трансляций

### Новые/изменённые

```
GET /api/billing/subscription — расширить ответ:
{
  ...existing,
  demo: {
    minutesRemaining: 20,
    minutesUsed: 0,
  },
  eventPasses: [
    { id: "...", minutesRemaining: 80, minutesTotal: 120, purchasedAt: ... }
  ],
  activeSource: "demo" | "event_pass" | "subscription" | null
}

POST /api/billing/checkout — расширить для event_pass:
Body: { planId: 'event_pass' }
// mode: 'payment' вместо 'subscription'

GET /api/billing/status — добавить demo info:
{
  configured: boolean,
  demoAvailable: boolean,  // есть ли demo минуты
  demoMinutesRemaining: number,
}
```

## UI — Pricing Page

### Новый layout

```
┌───────────────────────────────────────────────────────┐
│                                                       │
│  ┌─── Free Demo ────────────────────────────────────┐ │
│  │ Try WordBeacon free                              │ │
│  │ 20 minutes • Up to 10 listeners • All languages  │ │
│  │ [Try for Free]                                   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─── One-Time Event ──────────────────────────────┐  │
│  │ Need just one broadcast?                        │  │
│  │ $14.99 • 2 hours • Up to 100 listeners          │  │
│  │ [Buy Event Pass]                                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  Monthly / Yearly toggle                              │
│                                                       │
│  ┌──────┐  ┌──────────┐  ┌──────────────┐            │
│  │Starter│  │ Growing  │  │ Multiplying  │            │
│  │$39/mo │  │ $79/mo   │  │ $159/mo      │            │
│  │...    │  │ Popular  │  │ ...          │            │
│  └──────┘  └──────────┘  └──────────────┘            │
│                                                       │
│  FAQ section                                          │
└───────────────────────────────────────────────────────┘
```

### Free Demo логика

Если пользователь залогинен и `demo_minutes_remaining > 0`:
- Кнопка "Try for Free" → перенаправляет на Dashboard
- Показывает сколько минут осталось

Если пользователь не залогинен:
- Кнопка "Try for Free" → перенаправляет на /login

Если demo минуты исчерпаны:
- Секция скрыта или показывает "Demo used. Choose a plan."

## UI — Dashboard

### Текущие минуты

В Dashboard header показывать текущий источник минут:

```
┌─────────────────────────────────────────┐
│ Free Demo: 12 of 20 minutes remaining  │
│ [Upgrade]                               │
└─────────────────────────────────────────┘
```

или

```
┌─────────────────────────────────────────┐
│ Event Pass: 80 of 120 minutes remaining │
│ [Buy More]                              │
└─────────────────────────────────────────┘
```

или

```
┌─────────────────────────────────────────┐
│ Growing Plan: 1200 of 1440 min remaining│
│ Usage bar [====......] 83%              │
└─────────────────────────────────────────┘
```

## UI — Broadcast Page

### Перед началом трансляции

Если нет минут — показать overlay:
```
┌─────────────────────────────────────────┐
│ No broadcast minutes remaining          │
│                                         │
│ • Buy Event Pass ($14.99, 2 hours)      │
│ • Subscribe (from $39/mo)              │
│                                         │
│ [View Plans]                            │
└─────────────────────────────────────────┘
```

### Во время трансляции

Показывать оставшиеся минуты текущего источника:
```
Demo: 5 min remaining  ⚠️
```

При 5 минутах и менее — жёлтый индикатор.
При 0 — автоматическая остановка трансляции.

## Переменные окружения (Stripe)

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Subscription price IDs (создать в Stripe Dashboard)
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_GROWING_MONTHLY=price_...
STRIPE_PRICE_GROWING_YEARLY=price_...
STRIPE_PRICE_MULTIPLYING_MONTHLY=price_...
STRIPE_PRICE_MULTIPLYING_YEARLY=price_...

# Event Pass price ID
STRIPE_PRICE_EVENT_PASS=price_...
```

## Файлы для изменения

### Сервер

| Файл | Изменения |
|------|-----------|
| `db/index.ts` | Новая таблица `one_time_passes`, миграция `demo_minutes` на users, новые CRUD функции |
| `services/stripe.ts` | Payment mode checkout для Event Pass, webhook обработка |
| `api/billing.ts` | Расширить subscription endpoint, добавить demo + event pass логику |
| `websocket/rooms.ts` | Рефакторить usage tracking для 3 источников (demo/pass/subscription) |
| `config.ts` | Добавить `STRIPE_PRICE_EVENT_PASS` |

### Клиент

| Файл | Изменения |
|------|-----------|
| `pages/Pricing.tsx` | Добавить Free Demo и Event Pass секции |
| `pages/Dashboard.tsx` | Показать текущий источник минут, upgrade/buy more кнопки |
| `pages/Broadcast.tsx` | Проверка минут перед стартом, overlay "No minutes" |
| `lib/api.ts` | Обновить типы для demo + event pass |

## Порядок реализации

### Этап 1: Free Demo (без Stripe)
1. Миграция: `demo_minutes_remaining` + `demo_minutes_used` на users
2. Usage tracking: проверять demo минуты если нет подписки
3. Dashboard: показывать demo минуты
4. Broadcast: ограничивать до 20 мин
5. Pricing: показать Free Demo секцию

### Этап 2: Stripe настройка
1. Создать Products и Prices в Stripe Dashboard
2. Добавить env переменные в Railway
3. Настроить Webhook endpoint в Stripe Dashboard
4. Тестирование подписок

### Этап 3: Event Pass
1. Таблица `one_time_passes`
2. Payment mode checkout
3. Webhook обработка для payment mode
4. Usage tracking для Event Pass
5. UI: "Buy Event Pass" на Pricing

### Этап 4: Enforcement + UI
1. Broadcast page: проверка минут перед стартом
2. Dashboard: показать текущий source
3. Usage warning при 5 мин и менее
4. Auto-stop при 0 мин

## Тестирование

### Stripe Test Mode
1. Использовать `sk_test_...` ключ (не live)
2. Тестовые карты: `4242 4242 4242 4242`
3. Проверить checkout flow для подписки
4. Проверить checkout flow для Event Pass
5. Проверить webhook обработку
6. Проверить trial → auto-charge после 60 дней

### Demo тестирование
1. Создать нового пользователя
2. Проверить 20 бесплатных минут
3. Исчерпать минуты → "Upgrade" prompt
4. Купить Event Pass → минуты появляются
5. Купить подписку → переключается на subscription tracking
