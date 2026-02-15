import { gql } from "@apollo/client";

export const BOARD_QUERY = gql`
  query GetBoard($id: ID!) {
    board(id: $id) {
      id
      title
      shapes {
        id
        boardId
        type

        x
        y
        width
        height

        text
        rotation
        zIndex
        locked
        fill
        stroke
        strokeWidth
      }
    }
  }
`;

export const UPDATE_SHAPE_MUTATION = gql`
  mutation UpdateShape($boardId: ID!, $shape: ShapeInput!, $clientID: ID!) {
    updateShape(boardId: $boardId, shape: $shape, clientID: $clientID) {
      id
      boardId
      type

      x
      y
      width
      height

      text
      rotation
      zIndex
      locked
      fill
      stroke
      strokeWidth
    }
  }
`;

export const MOVE_SHAPE_TRANSIENT_MUTATION = gql`
  mutation MoveShapeTransient(
    $boardId: ID!
    $shape: TransientShapeInput!
    $clientID: ID!
  ) {
    moveShapeTransient(boardId: $boardId, shape: $shape, clientID: $clientID)
  }
`;

export const SHAPE_MOVED_SUBSCRIPTION = gql`
  subscription ShapeMoved($boardId: ID!) {
    shapeMoved(boardId: $boardId) {
      id
      x
      y
      width
      height
      clientID
    }
  }
`;

export const SHAPE_UPDATED_SUBSCRIPTION = gql`
  subscription ShapeUpdated($boardId: ID!) {
    shapeUpdated(boardId: $boardId) {
      id
      boardId
      type

      x
      y
      width
      height

      text
      rotation
      zIndex
      locked
      fill
      stroke
      strokeWidth
    }
  }
`;

export const SHAPE_EVENTS_SUBSCRIPTION = gql`
  subscription ShapeEvents($boardId: ID!) {
    shapeEvents(boardId: $boardId) {
      type
      clientID
      shape {
        id
        boardId
        type

        x
        y
        width
        height

        text
        rotation
        zIndex
        locked
        fill
        stroke
        strokeWidth
      }
    }
  }
`;

export const DELETE_SHAPE_MUTATION = gql`
  mutation DeleteShape($boardId: ID!, $shapeId: ID!) {
    deleteShape(boardId: $boardId, shapeId: $shapeId)
  }
`;
