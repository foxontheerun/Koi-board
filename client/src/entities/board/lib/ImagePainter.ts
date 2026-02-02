import type { CameraState } from "../layers/GridLayer";

export class ImagePainter {
  private static imageCache = new Map<string, HTMLImageElement>();

  static async drawImage(
    ctx: CanvasRenderingContext2D,
    imageName: string,
    worldX: number,
    worldY: number,
    worldWidth: number,
    worldHeight: number,
    camera: CameraState
  ): Promise<void> {
    const screenX = worldX * camera.zoom + camera.offsetX;
    const screenY = worldY * camera.zoom + camera.offsetY;
    const screenWidth = worldWidth * camera.zoom;
    const screenHeight = worldHeight * camera.zoom;

    const img = await this.loadImage(imageName);

    ctx.drawImage(img, screenX, screenY, screenWidth, screenHeight);
  }

  private static async loadImage(imageName: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(imageName)) {
      return this.imageCache.get(imageName)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();

      const paths = [`../../../../assets/images/joker.jpg`];

      let currentPathIndex = 0;

      const tryLoad = () => {
        if (currentPathIndex >= paths.length) {
          reject(new Error(`Картинка не найдена: ${imageName}`));
          return;
        }

        img.src = paths[currentPathIndex];

        img.onload = () => {
          this.imageCache.set(imageName, img);
          resolve(img);
        };

        img.onerror = () => {
          currentPathIndex++;
          tryLoad();
        };
      };

      tryLoad();
    });
  }
}
