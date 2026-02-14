export interface CameraState {
  zoom: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  viewportWidth: number;
  viewportHeight: number;
}

export class CameraController {
  private viewMatrix = new DOMMatrix();
  private inverseViewMatrix = new DOMMatrix();

  private zoom = 1;
  private rotation = 0;
  private offsetX = 0;
  private offsetY = 0;

  public viewportWidth = 0;
  public viewportHeight = 0;

  public worldWidth = 2000;
  public worldHeight = 2000;

  private listeners: (() => void)[] = [];

  getScale() {
    return this.viewMatrix.a;
  }

  updateViewport(canvas: HTMLCanvasElement) {
    this.viewportWidth = canvas.clientWidth;
    this.viewportHeight = canvas.clientHeight;
    this.recalculateMatrix();
  }

  setZoom(newZoom: number, center?: { x: number; y: number }) {
    if (center) {
      const before = this.screenToWorld(center.x, center.y);

      this.zoom = newZoom;
      this.recalculateMatrix();

      const after = this.screenToWorld(center.x, center.y);

      this.offsetX += (after.x - before.x) * this.zoom;
      this.offsetY += (after.y - before.y) * this.zoom;
    } else {
      this.zoom = newZoom;
    }

    this.recalculateMatrix();
  }

  setRotation(rad: number) {
    this.rotation = rad;
    this.recalculateMatrix();
  }

  setOffset(x: number, y: number) {
    this.offsetX = x;
    this.offsetY = y;
    this.recalculateMatrix();
  }

  screenToWorld(x: number, y: number) {
    const point = new DOMPoint(x, y);
    const result = point.matrixTransform(this.inverseViewMatrix);
    return { x: result.x, y: result.y };
  }

  worldToScreen(x: number, y: number) {
    const point = new DOMPoint(x, y);
    const result = point.matrixTransform(this.viewMatrix);
    return { x: result.x, y: result.y };
  }

  applyTransform(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(this.viewMatrix);
  }

  get state(): CameraState {
    return {
      zoom: this.zoom,
      rotation: this.rotation,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
    };
  }

  subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private recalculateMatrix() {
    const m = new DOMMatrix();

    m.translateSelf(this.offsetX, this.offsetY);
    m.rotateSelf((this.rotation * 180) / Math.PI);
    m.scaleSelf(this.zoom);

    this.viewMatrix = m;
    this.inverseViewMatrix = m.inverse();

    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}
