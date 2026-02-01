import type { CameraState } from "../layers/GridLayer";

export class CameraController {
  public zoom = 1;
  public offsetX = 0;
  public offsetY = 0;

  public viewportWidth = 0;
  public viewportHeight = 0;

  private listeners: (() => void)[] = [];

  public updateViewport(canvas: HTMLCanvasElement) {
    this.viewportWidth = canvas.clientWidth;
    this.viewportHeight = canvas.clientHeight;
    this.notify();
  }

  public setZoom(newZoom: number, center?: { x: number; y: number }) {
    if (center) {
      const scaleFactor = newZoom / this.zoom;
      this.offsetX = center.x - (center.x - this.offsetX) * scaleFactor;
      this.offsetY = center.y - (center.y - this.offsetY) * scaleFactor;
    }
    this.zoom = newZoom;
    this.notify();
  }

  public setOffset(x: number, y: number) {
    this.offsetX = x;
    this.offsetY = y;
    this.notify();
  }

  public get state(): CameraState {
    return {
      zoom: this.zoom,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
    };
  }

  public subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}
