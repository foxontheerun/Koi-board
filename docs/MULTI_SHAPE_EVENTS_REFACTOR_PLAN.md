# План рефакторинга realtime-канала: мульти-движение фигур + backend throttle

## 1) Что есть сейчас и где узкое место

Сейчас transient-канал построен по модели `1 фигура = 1 событие`:

- mutation `moveShapeTransient(boardId, shape, clientID)`;
- subscription `shapeMoved(boardId): TransientShape`.

На клиенте отправка тротлится отдельно **на каждую фигуру** (`Map<shapeId, throttle(40ms)>`).
Это работает для одиночного drag, но при групповом drag порождает burst из N параллельных потоков,
где N = количество фигур в группе.

Проблемы:

- лишний overhead по сети и сериализации;
- неатомарность кадра (фигуры приходят/рисуются по одной);
- выше шанс частичной потери transient-сообщений при неблокирующем publish;
- визуальный jitter на удалённых клиентах.

---

## 2) Целевая модель протокола (рекомендуемая)

### Новые GraphQL типы

```graphql
input TransientShapePatchInput {
  id: ID!
  x: Float
  y: Float
  width: Float
  height: Float
}

type TransientShapePatch {
  id: ID!
  x: Float
  y: Float
  width: Float
  height: Float
}

type TransientBatchEvent {
  boardId: ID!
  clientID: ID!
  dragSessionID: ID!
  seq: Int!
  sentAt: String!
  shapes: [TransientShapePatch!]!
}
```

### Новые операции

```graphql
extend type Mutation {
  moveShapesTransient(
    boardId: ID!
    dragSessionID: ID!
    seq: Int!
    sentAt: String!
    shapes: [TransientShapePatchInput!]!
    clientID: ID!
  ): Boolean!
}

extend type Subscription {
  shapesMoved(boardId: ID!): TransientBatchEvent!
}
```

Старые `moveShapeTransient/shapeMoved` оставить как deprecated до полной миграции.

---

## 3) Рефакторинг фронта

## 3.1 Что меняем

1. В `InteractionManager` для drag передавать transient-изменения **батчем** (`_Shape[]`) на каждый mousemove/tick.
2. В `BoardSyncGateway` заменить per-shape throttle на **один frame-throttle на board/runtime** (например 33–50 ms).
3. В payload добавлять:
   - `dragSessionID` (новый UUID на mousedown);
   - `seq` (инкремент внутри сессии);
   - `sentAt` (timestamp).
4. На приёмнике применять патчи батчем и делать **один redraw**.
5. На приёмнике хранить `lastSeqBySession[clientID+dragSessionID]` и игнорировать устаревшие кадры.

## 3.2 Почему так лучше

- кадр группы становится атомарным;
- равномерная частота отправки независимо от размера группы;
- проще контроль out-of-order;
- ниже CPU/network нагрузка.

---

## 4) Рефакторинг бэкенда

## 4.1 Слой transient pub/sub

Вместо немедленного fan-out каждого входящего события:

- принимать батч-события `TransientBatchEvent`;
- складывать в per-board агрегатор;
- агрегатор с тикером (например каждые 40ms) публикует подписчикам **coalesced frame**.

## 4.2 Coalescing стратегия

Внутри окна throttle:

- ключ коалесинга: `clientID + dragSessionID + shapeID`;
- для каждого ключа оставлять только **последний** патч (последний seq/sentAt);
- при flush формировать список патчей.

Если нужно сохранить семантику кадра от источника, можно коалесить по `(clientID, dragSessionID, seq)`
и отправлять только самый свежий seq per session.

## 4.3 Backpressure на backend (ключевое)

Для отправки оптимистичных transient-изменений всем подписчикам:

1. **Bounded channel per subscriber** (например 16/32).
2. Если буфер подписчика заполнен:
   - не блокировать producer;
   - заменить pending transient новым (drop old / keep latest).
3. Persisted-канал (`shapeEvents`) не тротлить и не дропать.
4. Метрики:
   - `transient_published_total`;
   - `transient_dropped_total`;
   - `transient_flush_batch_size`;
   - `subscriber_queue_overflow_total`.

Рекомендуемый режим: *lossy for transient, lossless for persisted*.

---

## 5) Порядок внедрения (без даунтайма)

1. Добавить новые schema-типы + резолверы (batch) параллельно старым.
2. На backend внедрить transient-агрегатор + throttle/coalescing.
3. На фронте переключить отправку/подписку на batch за feature-flag.
4. Снять метрики, проверить jitter/нагрузку/дропы.
5. После стабилизации удалить legacy single-shape поток.

---

## 6) Рекомендуемые параметры по умолчанию

- client send throttle: 33ms (≈30 FPS) или 40ms (25 FPS);
- server flush interval: 40ms;
- subscriber transient buffer: 16;
- max shapes in one transient batch: 200 (защитный лимит);
- TTL drag session в памяти: 10–30 сек после последнего события.

---

## 7) Критерии приёмки

- групповой drag визуально синхронный на удалённых клиентах;
- нет «лесенки» по фигурам внутри одной группы;
- устаревшие seq не откатывают позицию назад;
- persisted состояние после mouseup корректно фиксируется;
- при медленном подписчике сервер не блокируется и не деградирует по всем клиентам.

---

## 8) Декомпозиция на подзадачи (backlog для внедрения)

Ниже — практичный список задач, который можно сразу переносить в Jira/Linear.

### Epic A — Контракт API (GraphQL) и совместимость

- [ ] **A1. Добавить batch-типы в GraphQL schema**
  - `TransientShapePatchInput`, `TransientShapePatch`, `TransientBatchEvent`.
  - **DoD:** схема собирается, `gqlgen` генерирует типы без ошибок.

- [ ] **A2. Добавить batch-операции mutation/subscription**
  - `moveShapesTransient(...)`, `shapesMoved(boardId)`.
  - **DoD:** операции доступны в introspection и покрыты smoke-тестом подписки.

- [ ] **A3. Пометить legacy-операции deprecated**
  - `moveShapeTransient`, `shapeMoved` остаются рабочими до миграции.
  - **DoD:** старый клиент не ломается, новый клиент может работать параллельно.

### Epic B — Backend transient pipeline

- [ ] **B1. Реализовать per-board transient aggregator**
  - вход: batch-события;
  - flush по тикеру (например, 40ms).
  - **DoD:** при нагрузке нет блокировки mutation handler.

- [ ] **B2. Реализовать coalescing в окне flush**
  - ключ: `clientID + dragSessionID + shapeID`;
  - хранить последний patch.
  - **DoD:** размер выходного батча меньше/равен входному, позиция фигур актуальная.

- [ ] **B3. Реализовать ordering guard (seq/session)**
  - игнорировать устаревшие `seq` в пределах `dragSessionID`.
  - **DoD:** out-of-order события не откатывают состояние назад.

- [ ] **B4. Реализовать backpressure policy для подписчиков**
  - bounded-буфер per subscriber (16/32);
  - policy: drop-old/keep-latest для transient.
  - **DoD:** медленный подписчик не деградирует остальных.

- [ ] **B5. Метрики и наблюдаемость**
  - `transient_published_total`, `transient_dropped_total`, `transient_flush_batch_size`, `subscriber_queue_overflow_total`.
  - **DoD:** метрики видны в мониторинге, есть базовый dashboard.

### Epic C — Frontend send path (producer)

- [ ] **C1. Ввести drag-session модель на клиенте**
  - генерировать `dragSessionID` на `mousedown` для drag/resize;
  - вести `seq` внутри сессии.
  - **DoD:** в каждом transient payload есть `dragSessionID`, `seq`, `sentAt`.

- [ ] **C2. Перевести отправку на batch-кадры**
  - `InteractionManager` отдаёт `_Shape[]` за тик;
  - `BoardSyncGateway` отправляет один batch вместо N single-shape запросов.
  - **DoD:** при групповом drag на тик уходит 1 mutation.

- [ ] **C3. Заменить per-shape throttle на frame-throttle**
  - один throttle на board/runtime (33–40ms).
  - **DoD:** частота отправки стабильно ограничена, не зависит от размера группы.

### Epic D — Frontend receive path (consumer)

- [ ] **D1. Подписка на `shapesMoved` + батч-применение**
  - применять все патчи кадра перед redraw.
  - **DoD:** визуально нет «лесенки» внутри группы.

- [ ] **D2. Защита от устаревших кадров**
  - `lastSeqBySession[clientID+dragSessionID]`.
  - **DoD:** локальные проверки показывают игнор старых seq.

- [ ] **D3. Сохранить поддержку legacy подписки под флагом**
  - fallback на `shapeMoved` до полного rollout.
  - **DoD:** feature-flag переключает каналы без перезапуска приложения.

### Epic E — Тестирование и rollout

- [ ] **E1. Unit-тесты backend coalescing/backpressure**
  - сценарии: burst, slow subscriber, out-of-order seq.
  - **DoD:** тесты стабильно зелёные.

- [ ] **E2. Интеграционные тесты GraphQL (batch mutation/subscription)**
  - проверка совместимости старого и нового протокола.
  - **DoD:** оба пути проходят CI.

- [ ] **E3. Нагрузочный прогон на staging**
  - multi-drag (10/50/100 фигур), latency/jitter/drop rate.
  - **DoD:** значения в допустимых SLO.

- [ ] **E4. Поэтапный rollout**
  1) backend shipped + dark launch,
  2) включение флага для internal users,
  3) gradual rollout,
  4) удаление legacy API.
  - **DoD:** нет регрессий и ростов ошибок на этапе раскатки.

### Предлагаемый порядок исполнения (критический путь)

1. A1 → A2 → B1 → B2 → B4
2. C1 → C2 → C3
3. D1 → D2 → D3
4. E1 → E2 → E3 → E4

### Минимальный MVP (чтобы быстро получить эффект)

- A1, A2
- B1, B2, B4
- C2, C3
- D1

Это уже убирает главную проблему: `N single-shape` сообщений на групповой drag и снижает jitter.
