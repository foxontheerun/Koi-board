import { GridLayer } from "./layers/GridLayer";
import { StaticLayer } from "./layers/StaticLayer";
import { DragLayer } from "./layers/DragLayer";
import { Overlay } from "./layers/Overlay";
import type { EntityManager } from "../entities/EntityManager";
import type { CameraController } from "../camera/CameraController";
import type { _Shape } from "../entities";
import {
  type Rect,
  clearDirtyRect,
  computeShapesBoundingRect,
  rectsIntersect,
  selectionBoxToRect,
  unionRects,
} from "../utils/dirtyRect";
import { BRAND } from "../../shared/theme";

const MOVING_STATES = ["dragging", "resizing", "remote-dragging"];
const TEXT_PREVIEW_COLOR = BRAND.aqua;

function sameIds(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

export class RenderManager {
  private gridCtx: CanvasRenderingContext2D;
  private mainCtx: CanvasRenderingContext2D;
  private dragCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;

  private gridCanvas: HTMLCanvasElement;
  private mainCanvas: HTMLCanvasElement;
  private dragCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;

  private gridLayer = new GridLayer();
  private staticLayer = new StaticLayer();
  private dragLayer = new DragLayer();
  private overlay = new Overlay();

  private prevDragRect: Rect | null = null;
  private prevOverlayRect: Rect | null = null;

  private prevMovingShapeRects = new Map<string, Rect>();

  // Shapes handed over to the drag canvas; the static layer must skip them so
  // nothing is painted on both canvases at once.
  private liftedIds = new Set<string>();

  // While a shape is being edited its text lives in the DOM overlay; painting
  // it here as well would show both copies at once.
  private editingShapeId: string | null = null;

  constructor(
    gridCanvas: HTMLCanvasElement,
    mainCanvas: HTMLCanvasElement,
    dragCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
  ) {
    this.gridCanvas = gridCanvas;
    this.mainCanvas = mainCanvas;
    this.dragCanvas = dragCanvas;
    this.overlayCanvas = overlayCanvas;

    this.gridCtx = gridCanvas.getContext("2d")!;
    this.mainCtx = mainCanvas.getContext("2d")!;
    this.dragCtx = dragCanvas.getContext("2d")!;
    this.overlayCtx = overlayCanvas.getContext("2d")!;
  }

  updateSize(rect: DOMRect) {
    [
      this.gridCanvas,
      this.mainCanvas,
      this.dragCanvas,
      this.overlayCanvas,
    ].forEach((canvas) => {
      canvas.width = rect.width;
      canvas.height = rect.height;
    });

    this.invalidateDirtyRects();
  }

  setEditingShape(id: string | null) {
    this.editingShapeId = id;
  }

  invalidateDirtyRects() {
    this.prevDragRect = null;
    this.prevOverlayRect = null;
    this.prevMovingShapeRects.clear();
  }

  private liftShapes(camera: CameraController, candidates: _Shape[]): {
    lifted: Set<string>;
    dirtyRect: Rect | null;
  } {
    const moving = candidates.filter((s) => MOVING_STATES.includes(s.state));
    const lifted = new Set(moving.map((s) => s.id));

    let dirtyRect: Rect | null = null;

    for (const s of moving) {
      const nextRect = computeShapesBoundingRect(camera, [s]);
      const prevRect = this.prevMovingShapeRects.get(s.id) ?? nextRect;
      const united = unionRects(prevRect, nextRect);
      dirtyRect = dirtyRect ? unionRects(dirtyRect, united) : united;
      this.prevMovingShapeRects.set(s.id, nextRect);
    }

    for (const id of this.prevMovingShapeRects.keys()) {
      if (!lifted.has(id)) this.prevMovingShapeRects.delete(id);
    }

    // A clipped shape must never be drawn partially, so every neighbour the
    // rect touches joins the drag layer and widens it, until it stops growing.
    let grown = dirtyRect !== null;
    while (grown) {
      grown = false;
      for (const s of candidates) {
        if (lifted.has(s.id)) continue;
        const rect = computeShapesBoundingRect(camera, [s]);
        if (!rectsIntersect(rect, dirtyRect!)) continue;
        dirtyRect = unionRects(dirtyRect!, rect);
        lifted.add(s.id);
        grown = true;
      }
    }

    return { lifted, dirtyRect };
  }

  getMainCanvas(): HTMLCanvasElement {
    return this.mainCanvas;
  }

  getOverlayCanvas(): HTMLCanvasElement {
    return this.overlayCanvas;
  }

  drawAll(
    camera: CameraController,
    entityManager: EntityManager,
    selectedIds: string[],
  ) {
    this.drawGrid(camera);
    this.drawStatic(camera, entityManager);
    this.drawDrag(camera, entityManager);
    this.drawOverlay(camera, entityManager, selectedIds);
  }

  drawGrid(camera: CameraController) {
    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
    this.gridLayer.draw(this.gridCtx, camera.state);
  }

  drawStatic(camera: CameraController, entityManager: EntityManager) {
    this.mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    this.mainCtx.save();
    camera.applyTransform(this.mainCtx);
    this.staticLayer.draw(
      this.mainCtx,
      entityManager.getShapes().filter((s) => !this.liftedIds.has(s.id)),
      this.editingShapeId,
    );
    this.mainCtx.restore();
  }

  drawDrag(camera: CameraController, entityManager: EntityManager) {
    const candidates = entityManager.getShapesOnDragLayer();
    const { lifted, dirtyRect } = this.liftShapes(camera, candidates);

    if (!sameIds(lifted, this.liftedIds)) {
      this.liftedIds = lifted;
      this.drawStatic(camera, entityManager);
    }

    clearDirtyRect(this.dragCtx, this.dragCanvas, this.prevDragRect);

    if (lifted.size === 0) {
      this.prevDragRect = null;
      return;
    }

    this.prevDragRect = dirtyRect;

    this.dragCtx.save();

    if (dirtyRect) {
      this.dragCtx.beginPath();
      this.dragCtx.rect(dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h);
      this.dragCtx.clip();
    }

    camera.applyTransform(this.dragCtx);
    this.dragLayer.draw(
      this.dragCtx,
      candidates.filter((s) => lifted.has(s.id)),
    );

    this.dragCtx.restore();
  }

  drawOverlay(
    camera: CameraController,
    entityManager: EntityManager,
    selectedIds: string[] | null,
    selectionBox?: {
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    },
    previewShape?: _Shape,
  ) {
    clearDirtyRect(this.overlayCtx, this.overlayCanvas, this.prevOverlayRect);

    // The editor draws its own outline, and handles cannot be used mid-typing.
    const selectedShapes = (selectedIds ?? [])
      .filter((id) => id !== this.editingShapeId)
      .map((id) => entityManager.getById(id))
      .filter((s): s is _Shape => s !== null);

    if (selectedShapes.length === 0 && !selectionBox && !previewShape) {
      this.prevOverlayRect = null;
      return;
    }

    const allShapesForRect: _Shape[] = [...selectedShapes];
    if (previewShape) allShapesForRect.push(previewShape);

    let dirtyRect: Rect | null = null;

    if (allShapesForRect.length > 0) {
      dirtyRect = computeShapesBoundingRect(camera, allShapesForRect);
    }

    if (selectionBox) {
      const sbRect = selectionBoxToRect(selectionBox);
      dirtyRect = dirtyRect ? unionRects(dirtyRect, sbRect) : sbRect;
    }

    this.prevOverlayRect = dirtyRect;

    this.overlayCtx.save();

    if (dirtyRect) {
      this.overlayCtx.beginPath();
      this.overlayCtx.rect(dirtyRect.x, dirtyRect.y, dirtyRect.w, dirtyRect.h);
      this.overlayCtx.clip();
    }

    camera.applyTransform(this.overlayCtx);

    if (selectedShapes.length > 1) {
      selectedShapes.forEach((shape) =>
        this.overlay.drawBounds(
          this.overlayCtx,
          shape,
          camera.getScale(),
          false,
        ),
      );
      this.overlay.drawGroupBounds(
        this.overlayCtx,
        selectedShapes,
        camera.getScale(),
      );
    } else {
      selectedShapes.forEach((shape) =>
        this.overlay.drawBounds(this.overlayCtx, shape, camera.getScale()),
      );
    }

    if (previewShape) {
      this.drawPreviewShape(this.overlayCtx, previewShape);
    }

    this.overlayCtx.restore();

    if (selectionBox) {
      const { startX, startY, currentX, currentY } = selectionBox;
      this.overlay.drawSelectionRect(
        this.overlayCtx,
        startX,
        startY,
        currentX,
        currentY,
      );
    }
  }

  private drawPreviewShape(ctx: CanvasRenderingContext2D, shape: _Shape) {
    ctx.save();
    ctx.fillStyle = shape.fill + "80";
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Text has no fill of its own, so its preview is the outline alone.
    if (shape.type === "TEXT") {
      ctx.strokeStyle = TEXT_PREVIEW_COLOR;
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      ctx.restore();
      return;
    }

    if (shape.type === "RECT" || shape.type === "STICKER") {
      if (shape.radius) {
        this.drawRoundedRect(
          ctx,
          shape.x,
          shape.y,
          shape.width,
          shape.height,
          shape.radius,
        );
      } else {
        ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      }
    }

    if (shape.type === "ELLIPSE") {
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        Math.abs(shape.width / 2),
        Math.abs(shape.height / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
