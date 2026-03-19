import { apolloClient } from "../../../app/apolloClient";
import {
  BOARD_QUERY,
  MOVE_SHAPES_TRANSIENT_MUTATION,
  SHAPE_EVENTS_SUBSCRIPTION,
  SHAPES_MOVED_SUBSCRIPTION,
  UPDATE_SHAPE_MUTATION,
} from "../api/board.gql";
import type {
  RemoteShape,
  ShapeEventPayload,
  TransientShapePatch,
} from "../../../canvas/entities/EntityManager";
import type { BoardRuntime } from "../../../canvas";
import { throttle } from "lodash";
import type { _Shape } from "../../../canvas/entities";

type BoardQueryResponse = {
  board?: {
    shapes: RemoteShape[];
  } | null;
};

type ShapesMovedResponse = {
  shapesMoved?: {
    clientID?: string;
    shapes: TransientShapePatch[];
  } | null;
};

type ShapeEventsResponse = {
  shapeEvents?: (ShapeEventPayload & { clientID?: string }) | null;
};

export class BoardSyncGateway {
  private subscriptions: Array<{ unsubscribe: () => void }> = [];
  private readonly boardId: string;
  private readonly runtime: BoardRuntime;
  private readonly clientId: string;

  // Accumulates the latest position of each shape between flush calls.
  // Map key is shape id — later updates overwrite earlier ones.
  private pendingTransient = new Map<string, _Shape>();
  private readonly flushTransient: ReturnType<typeof throttle>;

  constructor(boardId: string, runtime: BoardRuntime, clientId: string) {
    this.boardId = boardId;
    this.runtime = runtime;
    this.clientId = clientId;

    this.flushTransient = throttle(() => {
      const shapes = Array.from(this.pendingTransient.values());
      if (shapes.length === 0) return;
      this.pendingTransient.clear();
      this.sendTransientNow(shapes);
    }, 40);
  }

  async connect() {
    const queryResult = await apolloClient.query<BoardQueryResponse>({
      query: BOARD_QUERY,
      variables: { id: this.boardId },
      fetchPolicy: "network-only",
    });

    this.runtime.replaceAllShapes(queryResult.data?.board?.shapes ?? []);

    const movedSub = apolloClient
      .subscribe<ShapesMovedResponse>({
        query: SHAPES_MOVED_SUBSCRIPTION,
        variables: { boardId: this.boardId },
      })
      .subscribe({
        next: ({ data }) => {
          const moved = data?.shapesMoved;
          if (!moved || moved.clientID === this.clientId) return;

          moved.shapes.forEach((patch) => {
            this.runtime.applyTransientPatch(patch);
          });
        },
      });

    const eventsSub = apolloClient
      .subscribe<ShapeEventsResponse>({
        query: SHAPE_EVENTS_SUBSCRIPTION,
        variables: { boardId: this.boardId },
      })
      .subscribe({
        next: ({ data }) => {
          const event = data?.shapeEvents;
          if (!event || event.clientID === this.clientId) return;

          this.runtime.applyShapeEvent(event);
        },
      });

    this.subscriptions.push(movedSub, eventsSub);
  }

  sendTransient(shape: _Shape) {
    // Overwrite — only the latest position matters.
    this.pendingTransient.set(shape.id, shape);
    this.flushTransient();
  }

  sendPersisted(shape: _Shape) {
    void apolloClient
      .mutate({
        mutation: UPDATE_SHAPE_MUTATION,
        variables: {
          boardId: this.boardId,
          shape: {
            id: shape.id,
            type: shape.type,
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            zIndex: shape.zIndex ?? 0,
            fill: shape.fill,
            stroke: shape.stroke,
          },
          clientID: this.clientId,
        },
      })
      .catch((error) => {
        console.error("updateShape mutation error", error);
      });
  }

  dispose() {
    this.flushTransient.cancel();
    this.pendingTransient.clear();
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.subscriptions = [];
  }

  private sendTransientNow(shapes: _Shape[]) {
    void apolloClient
      .mutate({
        mutation: MOVE_SHAPES_TRANSIENT_MUTATION,
        variables: {
          boardId: this.boardId,
          shapes: shapes.map((s) => ({
            id: s.id,
            x: s.x,
            y: s.y,
            width: s.width,
            height: s.height,
          })),
          clientID: this.clientId,
        },
      })
      .catch((error) => {
        console.error("moveShapesTransient mutation error", error);
      });
  }
}
