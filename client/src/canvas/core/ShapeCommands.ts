import type { _Shape, EntityManager } from "../entities";
import type { InteractionManager } from "../interaction/InteractionManager";
import type { RenderOrchestrator } from "../rendering/RenderOrchestrator";

interface ShapeCommandCallbacks {
  onPersist: (shape: _Shape) => void;
  onDelete: (id: string) => void;
  onSelectionChange: (ids: string[]) => void;
}

export class ShapeCommands {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly render: RenderOrchestrator,
    private readonly interactionManager: InteractionManager,
    private readonly callbacks: ShapeCommandCallbacks,
  ) {}

  toggleLock(ids: string[]) {
    const changed = this.entityManager.setLocked(ids, !this.areAllLocked(ids));
    if (changed.length === 0) return;
    this.render.all();
    changed.forEach((shape) => this.callbacks.onPersist(shape));
    this.notifySelection();
  }

  bringToFront(ids: string[]) {
    this.applyZOrder(this.entityManager.bringToFront(this.unlockedIds(ids)));
  }

  sendToBack(ids: string[]) {
    this.applyZOrder(this.entityManager.sendToBack(this.unlockedIds(ids)));
  }

  moveForward(ids: string[]) {
    this.applyZOrder(this.entityManager.moveForward(this.unlockedIds(ids)));
  }

  moveBackward(ids: string[]) {
    this.applyZOrder(this.entityManager.moveBackward(this.unlockedIds(ids)));
  }

  deleteShapes(ids: string[]) {
    const removed = this.entityManager.removeShapes(this.unlockedIds(ids));
    if (removed.length === 0) return;
    this.interactionManager.selectById("");
    this.render.all();
    removed.forEach((id) => this.callbacks.onDelete(id));
    this.notifySelection();
  }

  updateShapeText(id: string, text: string) {
    const shape = this.entityManager.getById(id);
    if (!shape) return;

    shape.text = text;
    this.render.staticLayer();
    this.callbacks.onPersist(shape);
  }

  areAllLocked(ids: string[]): boolean {
    if (ids.length === 0) return false;
    return ids.every((id) => this.entityManager.getById(id)?.locked === true);
  }

  private unlockedIds(ids: string[]): string[] {
    return ids.filter((id) => this.entityManager.getById(id)?.locked !== true);
  }

  private applyZOrder(changed: _Shape[]) {
    if (changed.length === 0) return;
    this.render.all();
    changed.forEach((shape) => this.callbacks.onPersist(shape));
  }

  private notifySelection() {
    this.callbacks.onSelectionChange(
      this.interactionManager.getSelectedIds(),
    );
  }
}
