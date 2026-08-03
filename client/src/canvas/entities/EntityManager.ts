import type { ShapeType, TextAlign } from "../../entities/Shape";
import { ResizeCalculator } from "../interaction";
import type { _Shape } from "./shapes";
import { keyBetween, keysBetween } from "./shapes/orderKey";

export interface RemoteShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string | null;
  fontSize?: number | null;
  fontWeight?: number | null;
  textAlign?: TextAlign | null;
  textColor?: string | null;
  textFormats?: string | null;
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
  type?: ShapeType;
  parentId?: string | null;
  orderKey?: string | null;
  locked?: boolean | null;
}

export interface TransientShapePatch {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ShapeEventPayload {
  type: "CREATED" | "UPDATED" | "DELETED";
  shape: RemoteShape;
}

const ROOT = "";

function byOrderKey(a: _Shape, b: _Shape): number {
  if (a.orderKey !== b.orderKey) return a.orderKey < b.orderKey ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

export class EntityManager {
  private shapes: _Shape[] = [];
  private byId = new Map<string, _Shape>();
  // The scene is a tree, but everything that paints or hit-tests wants it flat
  // and in paint order, so the walk is done once and cached until the tree or
  // an order key changes.
  private ordered: _Shape[] = [];
  private childrenByParent = new Map<string, _Shape[]>();
  private sortDirty = true;

  constructor() {
    this.reindex();
  }

  private reindex() {
    this.byId.clear();
    for (const s of this.shapes) this.byId.set(s.id, s);
    this.sortDirty = true;
  }

  private rebuildOrder() {
    const children = new Map<string, _Shape[]>();
    for (const shape of this.shapes) {
      // The client does not trust the data: a shape whose parent never arrived
      // is treated as a root, so a desync cannot make a shape invisible.
      const parent =
        shape.parentId && this.byId.has(shape.parentId) ? shape.parentId : ROOT;
      const siblings = children.get(parent);
      if (siblings) siblings.push(shape);
      else children.set(parent, [shape]);
    }
    for (const siblings of children.values()) siblings.sort(byOrderKey);

    const ordered: _Shape[] = [];
    const seen = new Set<string>();
    const walk = (parent: string) => {
      for (const shape of children.get(parent) ?? []) {
        if (seen.has(shape.id)) continue;
        seen.add(shape.id);
        ordered.push(shape);
        walk(shape.id);
      }
    };
    walk(ROOT);

    // A cycle would leave its members unreachable from the root. The server
    // refuses to create one; if one arrives anyway, painting it at the root
    // beats dropping it.
    if (ordered.length !== this.shapes.length) {
      for (const shape of [...this.shapes].sort(byOrderKey)) {
        if (!seen.has(shape.id)) ordered.push(shape);
      }
    }

    this.ordered = ordered;
    this.childrenByParent = children;
    this.sortDirty = false;
  }

  private mapRemoteShapeToCanvas(shape: RemoteShape): _Shape {
    return {
      id: shape.id,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      text: shape.text ?? undefined,
      fontSize: shape.fontSize ?? undefined,
      fontWeight: shape.fontWeight ?? undefined,
      textAlign: shape.textAlign ?? undefined,
      textColor: shape.textColor ?? undefined,
      textFormats: shape.textFormats ?? undefined,
      fill: shape.fill ?? "#c5ff5b",
      stroke: shape.stroke ?? "#c5ff5b",
      strokeWidth: shape.strokeWidth ? String(shape.strokeWidth) : undefined,
      type: shape.type ?? "RECT",
      state: "static",
      radius: 8,
      parentId: shape.parentId ?? null,
      orderKey: shape.orderKey ?? "V",
      locked: shape.locked ?? false,
    };
  }

  addShape(shape: _Shape) {
    this.shapes.push(shape);
    this.byId.set(shape.id, shape);
    this.sortDirty = true;
  }

  removeShape(id: string): boolean {
    const shape = this.byId.get(id);
    if (!shape) return false;

    const index = this.shapes.indexOf(shape);
    if (index !== -1) this.shapes.splice(index, 1);
    this.byId.delete(id);
    this.sortDirty = true;
    return true;
  }

  removeShapes(ids: string[]): string[] {
    const removed: string[] = [];
    for (const id of ids) {
      if (this.removeShape(id)) removed.push(id);
    }
    return removed;
  }

  setLocked(ids: string[], locked: boolean): _Shape[] {
    const changed: _Shape[] = [];
    for (const id of ids) {
      const shape = this.byId.get(id);
      if (shape && (shape.locked ?? false) !== locked) {
        shape.locked = locked;
        changed.push(shape);
      }
    }
    return changed;
  }

  childrenOf(id: string): _Shape[] {
    if (this.sortDirty) this.rebuildOrder();
    return this.childrenByParent.get(id) ?? [];
  }

  siblingsOf(parentId: string | null | undefined): _Shape[] {
    if (this.sortDirty) this.rebuildOrder();
    return this.childrenByParent.get(parentId ?? ROOT) ?? [];
  }

  // A shape plus everything below it. Deleting, dragging and locking all act
  // on a whole subtree - a group half-moved is not a state to show anyone.
  subtreeOf(id: string): _Shape[] {
    const root = this.byId.get(id);
    if (!root) return [];

    const subtree = [root];
    for (let i = 0; i < subtree.length; i++) {
      subtree.push(...this.childrenOf(subtree[i].id));
    }
    return subtree;
  }

  // Clicking a member of a group selects the group, however deep it sits.
  outermostAncestorOf(id: string): _Shape | null {
    let shape = this.byId.get(id) ?? null;
    while (shape?.parentId) {
      const parent = this.byId.get(shape.parentId);
      if (!parent) break;
      shape = parent;
    }
    return shape;
  }

  // The key a new shape takes to land on top of its siblings.
  nextOrderKey(parentId: string | null = null): string {
    const siblings = this.siblingsOf(parentId);
    const last = siblings[siblings.length - 1];
    return keyBetween(last?.orderKey ?? null, null);
  }

  // Move the selection above its siblings, keeping its internal order.
  bringToFront(ids: string[]): _Shape[] {
    return this.reorder(ids, (moving, others) => {
      const last = others[others.length - 1];
      return keysBetween(last?.orderKey ?? null, null, moving.length);
    });
  }

  // Move the selection below its siblings, keeping its internal order.
  sendToBack(ids: string[]): _Shape[] {
    return this.reorder(ids, (moving, others) => {
      const first = others[0];
      return keysBetween(null, first?.orderKey ?? null, moving.length);
    });
  }

  moveForward(ids: string[]): _Shape[] {
    return this.shiftLayer(ids, "up");
  }

  moveBackward(ids: string[]): _Shape[] {
    return this.shiftLayer(ids, "down");
  }

  // Z-order is per parent: a shape moves only among its own siblings, and a
  // selection spanning two groups is reordered inside each of them.
  private reorder(
    ids: string[],
    keysFor: (moving: _Shape[], others: _Shape[]) => string[],
  ): _Shape[] {
    const selected = new Set(ids);
    const changed: _Shape[] = [];

    for (const [parent, moving] of this.selectionByParent(ids)) {
      const others = this.siblingsOf(parent).filter((s) => !selected.has(s.id));
      if (others.length === 0) continue;

      const keys = keysFor(moving, others);
      moving.forEach((shape, i) => {
        if (shape.orderKey === keys[i]) return;
        shape.orderKey = keys[i];
        changed.push(shape);
      });
    }

    if (changed.length > 0) this.sortDirty = true;
    return changed;
  }

  // Step over the nearest neighbour that is not selected, so a selection moves
  // as a block and never reorders within itself.
  private shiftLayer(ids: string[], dir: "up" | "down"): _Shape[] {
    const selected = new Set(ids);
    const changed: _Shape[] = [];

    for (const [parent, moving] of this.selectionByParent(ids)) {
      const siblings = [...this.siblingsOf(parent)];
      const ordered = dir === "up" ? [...moving].reverse() : moving;

      for (const shape of ordered) {
        const at = siblings.indexOf(shape);
        const step = dir === "up" ? 1 : -1;

        let neighbour = at + step;
        while (siblings[neighbour] && selected.has(siblings[neighbour].id)) {
          neighbour += step;
        }
        if (!siblings[neighbour]) continue;

        const beyond = siblings[neighbour + step];
        const key =
          dir === "up"
            ? keyBetween(siblings[neighbour].orderKey, beyond?.orderKey ?? null)
            : keyBetween(beyond?.orderKey ?? null, siblings[neighbour].orderKey);

        shape.orderKey = key;
        changed.push(shape);
        siblings.sort(byOrderKey);
      }
    }

    if (changed.length > 0) this.sortDirty = true;
    return changed;
  }

  private selectionByParent(ids: string[]): Map<string, _Shape[]> {
    const wanted = new Set(ids);
    const byParent = new Map<string, _Shape[]>();
    for (const shape of this.getShapes()) {
      if (!wanted.has(shape.id)) continue;
      const parent = shape.parentId ?? ROOT;
      const group = byParent.get(parent);
      if (group) group.push(shape);
      else byParent.set(parent, [shape]);
    }
    return byParent;
  }
  // Paint order: depth first, so a shape is followed by everything it owns.
  getShapes(): _Shape[] {
    if (this.sortDirty) this.rebuildOrder();
    return this.ordered;
  }

  getDraggedShape() {
    return this.shapes.find((s) => s.state === "dragging");
  }

  getShapesOnDragLayer(): _Shape[] {
    const shapes = this.getShapes();
    const moving = shapes.filter(
      (s) =>
        s.state === "dragging" ||
        s.state === "remote-dragging" ||
        s.state === "resizing",
    );
    if (moving.length === 0) return [];

    const lowest = Math.min(...moving.map((s) => shapes.indexOf(s)));
    return shapes.slice(lowest);
  }

  clearSelection() {
    this.shapes.forEach((s) => (s.state = "static"));
  }

  updateShapeList(newShape: _Shape) {
    const existing = this.byId.get(newShape.id);

    if (!existing) {
      this.shapes.push(newShape);
      this.byId.set(newShape.id, newShape);
      this.sortDirty = true;
      return;
    }

    // Drag passes back the same object it mutated — nothing to do.
    if (existing === newShape) return;

    const idx = this.shapes.indexOf(existing);
    if (idx !== -1) this.shapes[idx] = newShape;
    this.byId.set(newShape.id, newShape);
    if (
      existing.orderKey !== newShape.orderKey ||
      (existing.parentId ?? null) !== (newShape.parentId ?? null)
    ) {
      this.sortDirty = true;
    }
  }

  replaceAll(shapes: RemoteShape[]) {
    this.shapes = shapes.map((shape) => this.mapRemoteShapeToCanvas(shape));
    this.reindex();
    this.toWorldCoordinates();
  }

  // On the wire a child is positioned relative to its parent, so moving a
  // group is one message instead of one per member. The scene keeps world
  // coordinates, so nothing that paints or hit-tests has to know about the
  // tree; the conversion happens here, at the edge.
  private toWorldCoordinates() {
    for (const shape of this.getShapes()) {
      const parent = shape.parentId ? this.byId.get(shape.parentId) : null;
      if (!parent) continue;
      shape.x += parent.x;
      shape.y += parent.y;
    }
  }

  localPositionOf(shape: _Shape): { x: number; y: number } {
    const parent = shape.parentId ? this.byId.get(shape.parentId) : null;
    if (!parent) return { x: shape.x, y: shape.y };
    return { x: shape.x - parent.x, y: shape.y - parent.y };
  }

  // A group carries its members: they are positioned relative to it, so a
  // move of the group is a move of everything below it.
  private moveSubtree(shape: _Shape, dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    for (const descendant of this.subtreeOf(shape.id)) {
      if (descendant === shape) continue;
      descendant.x += dx;
      descendant.y += dy;
    }
  }

  applyTransientPatch(patch: TransientShapePatch): { becameRemote: boolean } {
    const shape = this.byId.get(patch.id);
    if (!shape) return { becameRemote: false };

    const wasRemote = shape.state === "remote-dragging";
    const from = { x: shape.x, y: shape.y };

    if (patch.x !== undefined) shape.x = patch.x;
    if (patch.y !== undefined) shape.y = patch.y;
    if (patch.width !== undefined) shape.width = patch.width;
    if (patch.height !== undefined) shape.height = patch.height;

    this.moveSubtree(shape, shape.x - from.x, shape.y - from.y);

    shape.state = "remote-dragging";

    return { becameRemote: !wasRemote };
  }

  applyShapeEvent(event: ShapeEventPayload) {
    const { shape, type } = event;

    if (type === "DELETED") {
      const existing = this.byId.get(shape.id);
      if (existing) {
        const index = this.shapes.indexOf(existing);
        if (index !== -1) this.shapes.splice(index, 1);
        this.byId.delete(shape.id);
        this.sortDirty = true;
      }
      return;
    }

    const nextShape = this.mapRemoteShapeToCanvas(shape); // state будет "static"
    const parent = nextShape.parentId
      ? this.byId.get(nextShape.parentId)
      : null;
    if (parent) {
      nextShape.x += parent.x;
      nextShape.y += parent.y;
    }

    const existing = this.byId.get(shape.id);

    if (!existing) {
      this.shapes.push(nextShape);
      this.byId.set(nextShape.id, nextShape);
      this.sortDirty = true;
      return;
    }

    const from = { x: existing.x, y: existing.y };
    Object.assign(existing, nextShape); // сбросит remote-dragging → static
    this.moveSubtree(existing, existing.x - from.x, existing.y - from.y);
    this.sortDirty = true;
  }

  getById(id: string) {
    return this.byId.get(id) ?? null;
  }

  updateById(id: string, patch: Partial<_Shape>) {
    const s = this.byId.get(id);
    if (!s) return;
    Object.assign(s, patch);
    if (patch.orderKey !== undefined || patch.parentId !== undefined) {
      this.sortDirty = true;
    }
  }

  findShapeAt(worldPoint: { x: number; y: number }, margin = 0): _Shape | null {
    const shapes = this.getShapes();

    for (let i = shapes.length - 1; i >= 0; i--) {
      const bounds = ResizeCalculator.getShapeManipulationBounds(shapes[i]);

      const normalizedBounds = {
        x: bounds.w < 0 ? bounds.x + bounds.w : bounds.x,
        y: bounds.h < 0 ? bounds.y + bounds.h : bounds.y,
        w: Math.abs(bounds.w),
        h: Math.abs(bounds.h),
      };

      if (
        worldPoint.x >= normalizedBounds.x - margin &&
        worldPoint.x <= normalizedBounds.x + normalizedBounds.w + margin &&
        worldPoint.y >= normalizedBounds.y - margin &&
        worldPoint.y <= normalizedBounds.y + normalizedBounds.h + margin
      ) {
        return shapes[i];
      }
    }

    return null;
  }

  findShapesInRect(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    const minX = Math.min(rect.x, rect.x + rect.width);
    const maxX = Math.max(rect.x, rect.x + rect.width);
    const minY = Math.min(rect.y, rect.y + rect.height);
    const maxY = Math.max(rect.y, rect.y + rect.height);

    return this.getShapes().filter((shape) => {
      const bounds = ResizeCalculator.getShapeManipulationBounds(shape);

      const shapeMinX = Math.min(bounds.x, bounds.x + bounds.w);
      const shapeMaxX = Math.max(bounds.x, bounds.x + bounds.w);
      const shapeMinY = Math.min(bounds.y, bounds.y + bounds.h);
      const shapeMaxY = Math.max(bounds.y, bounds.y + bounds.h);

      return !(
        shapeMaxX < minX ||
        shapeMinX > maxX ||
        shapeMaxY < minY ||
        shapeMinY > maxY
      );
    });
  }
}
