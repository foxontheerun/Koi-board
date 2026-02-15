# Project map and client architecture analysis

## 1) Project map

```text
realtime-board/
  README.md
  server/
    cmd/api/main.go            # backend entrypoint (HTTP + WS GraphQL)
    graphql/*.graphqls         # schema split by domain (root/board/shape/transient)
    resolvers/                 # gqlgen resolvers
    subscriptions/             # pub/sub delivery for persisted events
    storage/                   # board and shape persistence in memory
    transient/                 # transient (drag) update flow
    graph/generated.go         # gqlgen generated execution layer
  client/
    src/app/                   # bootstrap, apollo client, routes
    src/pages/board/           # board page composition
    src/widgets/               # top bar / toolbar
    src/entities/Board/        # board canvas shell + old useBoardShapes hook
    src/canvas/                # imperative canvas engine (runtime, camera, layers, interaction)
    src/features/              # context menu / color picker, etc.
    src/shared/                # shared ui and utility modules
```

## 2) Current client architecture

- React creates page shell and route selection (`BoardPage`), then renders `BoardCanvasNew`. The board UI state in React is currently tool/color/camera-only. This is good for keeping React minimal around canvas rendering.
- `BoardCanvasNew` creates `BoardRuntime` once inside `useEffect`, stores it in `runtimeRef`, and routes mouse/wheel events directly to runtime.
- `BoardRuntime` owns all canvas drawing and interaction loops (`drawGrid`, `drawStatic`, `drawDrag`, `drawOverlay`) and delegates shape storage to `EntityManager`.
- `EntityManager` is currently initialized by an in-file static `SHAPES` array, i.e. not connected to server data yet.
- There is an old `useBoardShapes` hook with Apollo query/mutations/subscriptions and local `useState(shapes)`, but it is not wired into `BoardCanvasNew`.

## 3) Why React re-renders happen in the old approach

The old hook keeps board data in React state (`setShapes` on query/subscription/transient updates). This means each remote/local shape update schedules React render for the component using the hook. For a canvas-first app this is unnecessary overhead and creates pressure on reconciliation.

## 4) Recommended integration: Apollo -> board gateway -> EntityManager (imperative)

### Core principle

Keep React responsible only for mount/unmount and static controls. Keep board data flow in an imperative runtime pipeline.

### Target flow

1. `BoardCanvasNew` mounts once and constructs `BoardRuntime`.
2. A dedicated **BoardSyncGateway** starts Apollo subscriptions/mutations for a board id.
3. Gateway events are pushed directly into runtime/entity manager methods:
   - `entityManager.replaceAll(initialShapes)` on first load
   - `entityManager.patchTransient(shapePatch)` on transient subscription
   - `entityManager.applyShapeEvent(event)` on persisted create/update/delete events
4. Runtime calls `drawAll()` (or targeted draw methods) after entity updates.
5. React state is not used for shape arrays.

### Implementation notes

- Do **not** use `useQuery/useSubscription` in React component for high-frequency shape stream.
- Use Apollo client imperatively (`apolloClient.query`, `apolloClient.subscribe`, `apolloClient.mutate`) from a controller class/module.
- Add explicit lifecycle methods:
  - `runtime.attachSync(gateway)`
  - `runtime.dispose()`
  - `gateway.dispose()`
- Add mutation API on runtime/entity manager for local user actions so UI interactions and remote events go through one state source.

## 5) Practical API contract proposal

```ts
interface ShapeStore {
  replaceAll(shapes: Shape[]): void;
  applyTransientPatch(patch: TransientShape): void;
  applyEvent(event: ShapeEvent): void; // CREATED | UPDATED | DELETED
  getAll(): Shape[];
}

interface BoardGateway {
  connect(boardId: string): Promise<void>;
  sendTransient(patch: TransientShapeInput): void;
  sendPersisted(shape: ShapeInput): Promise<void>;
  sendDelete(shapeId: string): Promise<void>;
  dispose(): void;
}
```

## 6) Migration plan from current code

1. Extend `EntityManager` with bulk replace + event/patch apply methods.
2. Create `client/src/entities/Board/model/BoardSyncGateway.ts` with imperative Apollo integration.
3. In `BoardCanvasNew`, create gateway in `useEffect`, connect it to runtime and cleanup on unmount.
4. Remove shape state responsibilities from `useBoardShapes` (or retire hook completely).
5. Keep React updates only for toolbar/topbar and coarse status (loading/error indicator).

## 7) Anti-patterns to avoid

- Keeping duplicated shape state in React and EntityManager simultaneously.
- Calling `setState` on every transient move tick.
- Recreating runtime/gateway when unrelated React state changes (toolbars, menus).
