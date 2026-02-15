import { apolloClient } from "../../../app/apolloClient";
import {
  BOARD_QUERY,
  MOVE_SHAPE_TRANSIENT_MUTATION,
  SHAPE_EVENTS_SUBSCRIPTION,
  SHAPE_MOVED_SUBSCRIPTION,
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

type ShapeMovedResponse = {
  shapeMoved?: (TransientShapePatch & { clientID?: string }) | null;
};

type ShapeEventsResponse = {
  shapeEvents?: (ShapeEventPayload & { clientID?: string }) | null;
};

type MutationResult = {
  moveShapeTransient?: boolean;
};

export class BoardSyncGateway {
  private subscriptions: Array<{ unsubscribe: () => void }> = [];
  private readonly boardId: string;
  private readonly runtime: BoardRuntime;
  private readonly clientId: string;
  private readonly sendTransientThrottled: ReturnType<
    typeof throttle<(shape: _Shape) => void>
  >;

  constructor(boardId: string, runtime: BoardRuntime, clientId: string) {
    this.boardId = boardId;
    this.runtime = runtime;
    this.clientId = clientId;

    this.sendTransientThrottled = throttle((shape: _Shape) => {
      void apolloClient
        .mutate<MutationResult>({
          mutation: MOVE_SHAPE_TRANSIENT_MUTATION,
          variables: {
            boardId: this.boardId,
            shape: {
              id: shape.id,
              x: shape.x,
              y: shape.y,
              width: shape.width,
              height: shape.height,
            },
            clientID: this.clientId,
          },
        })
        .catch((error) => {
          console.error("moveShapeTransient mutation error", error);
        });
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
      .subscribe<ShapeMovedResponse>({
        query: SHAPE_MOVED_SUBSCRIPTION,
        variables: { boardId: this.boardId },
      })
      .subscribe({
        next: ({ data }) => {
          const moved = data?.shapeMoved;
          if (!moved || moved.clientID === this.clientId) return;

          this.runtime.applyTransientPatch(moved);
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
    this.sendTransientThrottled(shape);
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
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
    this.sendTransientThrottled.cancel();
  }
}
