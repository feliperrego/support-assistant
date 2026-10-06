import type { Locator } from "@playwright/test";

/**
 * WCAG 2.2's minimum contrast for text below 18.66 px bold or 24 px (SC 1.4.3, level AA). The
 * desk's badges are 12 px medium text.
 */
export const MIN_TEXT_CONTRAST = 4.5;

/**
 * The contrast ratio of an element's text against what is behind it, from the colours the
 * browser computed: the element's background and its ancestors', alpha included, painted on a
 * canvas from the first opaque one up, then the text colour over them. The canvas resolves every
 * CSS colour (oklch, color-mix) to sRGB as the page does. Background images and opacity are left
 * out: nothing behind the desk's text has them.
 */
export async function textContrast(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("no 2D canvas");

    const SENTINEL = "#010203";
    const paint = (color: string) => {
      context.fillStyle = SENTINEL;
      context.fillStyle = color;
      // An unparsed colour leaves fillStyle as it was, which would paint the sentinel.
      if (context.fillStyle === SENTINEL) throw new Error(`the canvas cannot paint ${color}`);
      context.fillRect(0, 0, 1, 1);
    };
    const pixel = () => [...context.getImageData(0, 0, 1, 1).data];
    const opaque = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      paint(color);
      return pixel()[3] === 255;
    };

    // The backgrounds from the element up to the first opaque one, the bottom one first.
    const layers: string[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      layers.unshift(color);
      if (opaque(color)) break;
    }
    context.clearRect(0, 0, 1, 1);
    // The canvas a browser shows under a page with no opaque background.
    paint("white");
    layers.forEach(paint);
    const background = pixel();
    paint(getComputedStyle(element).color);
    const text = pixel();

    // WCAG 2.2's relative luminance of an 8-bit sRGB colour.
    const luminance = ([r, g, b]: number[]) => {
      const [R, G, B] = [r, g, b].map((value) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    };
    const [lighter, darker] = [luminance(text), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  });
}
