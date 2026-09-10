/**
 * Average colour of the artwork, used as the accent behind the player.
 *
 * Averaged over a 16x16 downscale rather than letting the canvas squash the
 * image straight to 1x1: at the default `imageSmoothingQuality` a 1x1 draw
 * *samples* instead of averaging, so a dark album cover with a bright centre
 * comes back near-white. Doing the mean in JS does not depend on how good the
 * engine's downscale filter happens to be.
 */
export async function dominantColor(blob: Blob): Promise<string | null> {
  const N = 16;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, N, N);
    bitmap.close();

    const data = ctx.getImageData(0, 0, N, N).data;
    let r = 0,
      g = 0,
      b = 0,
      weight = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Weight by alpha so transparent padding does not drag the mean to black.
      const a = data[i + 3] / 255;
      r += data[i] * a;
      g += data[i + 1] * a;
      b += data[i + 2] * a;
      weight += a;
    }
    if (!weight) return null;
    return `rgb(${Math.round(r / weight)}, ${Math.round(g / weight)}, ${Math.round(b / weight)})`;
  } catch {
    return null;
  }
}

export const mmss = (s: number) =>
  Number.isFinite(s)
    ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
    : "0:00";
