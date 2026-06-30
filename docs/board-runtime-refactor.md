# Рефакторинг BoardRuntime

Разросся в god-object (~640 строк). Цель: сделать тонким **фасадом** —
конструирует/связывает сервисы, хранит callbacks, делегирует. Каждому
контроллеру инжектить только нужное. Публичный API не менять (чтобы
`BoardCanvasNew` не трогать).

## Что выносим (и куда)

1. **RenderOrchestrator** → `rendering/` (первым, дёшево) — убрать дубли
   `drawOverlay(...)`. Методы: `redrawAll/static/drag/overlay`.
   Это прослойка НАД `RenderManager` (тот рисует низко, оркестратор собирает
   частые комбинации, знает camera/entityManager/selectedIds).
2. **CollabController** → `collab/` — locks + presence + clientId.
   `sweep(now)` возвращает флаги, рисует фасад.
3. **ShapeCreationController** → `interaction/` — creationTool + цвета +
   start/update/finish.
4. **ShapeCommands** → `core/` (или новая `commands/`) — z-order, lock, delete, text.
5. **PointerController** → `interaction/` (последним) — handleMouseDown/Move/Up/pan.

## Остаётся в фасаде
wiring, camera/entityManager, setClientId, setSyncCallbacks, remote apply,
геометрия, updateSize, destroy, sweep-таймер.

## Процесс
- по контроллеру за коммит; после каждого `tsc` + `vitest`
- чистые контроллеры с `now`-параметром → unit-тесты
- этапы 1–2 = ~70% эффекта
