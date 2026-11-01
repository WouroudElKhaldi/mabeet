/**
 * Makes the logo's pieces from docs/brand/mabeet-logo.png: the masks the Wordmark fills with the palette's colour
 * (public/brand/mabeet-arch.png, mabeet-scene.png, mabeet-word.png), and, for every palette in src/app/globals.css, the
 * browser-tab and home-screen icons in that palette's colours (public/brand/icons/<palette>/). Run it after changing the
 * logo or adding or changing a palette: pnpm brand:assets
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp, { type OutputInfo } from "sharp";

const LOGO = "docs/brand/mabeet-logo.png";
// The logo's own colours: its cream background, the dark green of the arch and the name, the green of the landscape.
const CREAM = [250, 245, 230];
const ARCH_INK = [27, 64, 49];
const SCENE_INK = [47, 122, 90];
// Where the emblem and the name sit in the logo, with a few pixels of margin.
const EMBLEM = { left: 450, top: 322, width: 356, height: 390 };
const NAME = { left: 264, top: 734, width: 728, height: 158 };
// The landscape is drawn this strongly over the paper, as in the Wordmark (`opacity-70`).
const SCENE_STRENGTH = 0.7;

type Rgb = number[];

// The logo's pixels, read once by main().
let data: Buffer;
let info: OutputInfo;

/** How much of an ink a pixel holds, reading the pixel as that ink laid over the cream. */
function coverage(at: number, ink: Rgb) {
  const toward = ink.map((value, channel) => value - CREAM[channel]!);
  const pixel = [0, 1, 2].map((channel) => data[at + channel]! - CREAM[channel]!);
  const length = toward.reduce((sum, value) => sum + value * value, 0);
  const amount = Math.max(
    0,
    Math.min(1, pixel.reduce((sum, value, k) => sum + value * toward[k]!, 0) / length),
  );
  const left = Math.hypot(...pixel.map((value, k) => value - amount * toward[k]!));
  return { amount, left };
}

/** The arch's and the landscape's coverage over an area: solid ink by its colour, a soft edge by its nearest solid pixel. */
function layers(area: typeof EMBLEM) {
  const { left: x0, top: y0, width, height } = area;
  const pixelAt = (x: number, y: number) => ((y + y0) * info.width + x + x0) * 3;
  const solid = new Int8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const arch = coverage(pixelAt(x, y), ARCH_INK);
      const scene = coverage(pixelAt(x, y), SCENE_INK);
      if (Math.max(arch.amount, scene.amount) > 0.8) solid[y * width + x] = arch.left <= scene.left ? 1 : 2;
    }
  const nearestSolid = (x: number, y: number) => {
    for (let reach = 1; reach <= 6; reach++)
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && solid[ny * width + nx])
            return solid[ny * width + nx];
        }
    return 0;
  };
  const arch = new Float32Array(width * height);
  const scene = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const kind = solid[y * width + x] || nearestSolid(x, y);
      if (kind === 1) arch[y * width + x] = coverage(pixelAt(x, y), ARCH_INK).amount;
      if (kind === 2) scene[y * width + x] = coverage(pixelAt(x, y), SCENE_INK).amount;
    }
  dropSpecks(arch, width, height, 500);
  return { width, height, arch, scene };
}

/** The arch is two big pieces: anything small that looks like arch ink is the edge of the sun or the hills. */
function dropSpecks(alpha: Float32Array, width: number, height: number, smallest: number) {
  const seen = new Uint8Array(width * height);
  for (let start = 0; start < alpha.length; start++) {
    if (seen[start] || alpha[start]! < 0.08) continue;
    const piece = [start];
    seen[start] = 1;
    for (let n = 0; n < piece.length; n++) {
      const at = piece[n]!;
      const x = at % width;
      const y = (at - x) / width;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const next = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[next] || alpha[next]! < 0.08) continue;
        seen[next] = 1;
        piece.push(next);
      }
    }
    if (piece.length < smallest) for (const at of piece) alpha[at] = 0;
  }
}

/** A mask: black, shaped by `alpha`, `height` pixels tall. */
function mask(alpha: Float32Array, width: number, height: number, outHeight: number) {
  const rgba = Buffer.alloc(width * height * 4);
  alpha.forEach((value, at) => (rgba[at * 4 + 3] = Math.round(value * 255)));
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .resize({ height: outHeight, kernel: "lanczos3" })
    .png();
}

/** Each palette's light-mode paper and accent, as globals.css declares them. */
function palettes(): Array<{ name: string; paper: Rgb; accent: Rgb }> {
  const css = readFileSync("src/app/globals.css", "utf8");
  const hex = (value: string) => [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16));
  return [...css.matchAll(/^:root\[data-palette="(\w+)"\] \{([^}]*)\}/gm)].map(([, paletteName, body]) => {
    const token = (tokenName: string) =>
      hex(new RegExp(`--${tokenName}:\\s*(#[0-9a-f]{6})`, "i").exec(body!)![1]!);
    return { name: paletteName!, paper: token("paper"), accent: token("accent") };
  });
}

/** The emblem in a palette's colours, centred on its paper, `size` pixels square. */
async function icon(emblem: ReturnType<typeof layers>, size: number, paper: Rgb, accent: Rgb) {
  const scene = accent.map(
    (value, channel) => value * SCENE_STRENGTH + paper[channel]! * (1 - SCENE_STRENGTH),
  );
  const rgb = Buffer.alloc(emblem.width * emblem.height * 3);
  for (let at = 0; at < emblem.arch.length; at++)
    for (let channel = 0; channel < 3; channel++) {
      const archPart = emblem.arch[at]!;
      const scenePart = emblem.scene[at]!;
      rgb[at * 3 + channel] = Math.round(
        paper[channel]! * (1 - archPart - scenePart) +
          accent[channel]! * archPart +
          scene[channel]! * scenePart,
      );
    }
  const art = await sharp(rgb, { raw: { width: emblem.width, height: emblem.height, channels: 3 } })
    .resize({ height: Math.round(size * 0.72), kernel: "lanczos3" })
    .png()
    .toBuffer();
  const [r, g, b] = paper as [number, number, number];
  return sharp({ create: { width: size, height: size, channels: 3, background: { r, g, b } } })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toBuffer();
}

/** An .ico that holds PNG images (every browser since 2007 reads them). */
function ico(images: Array<{ size: number; png: Buffer }>) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, n) => {
    const entry = 6 + 16 * n;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

async function main() {
  ({ data, info } = await sharp(LOGO).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
  const emblem = layers(EMBLEM);
  const name = layers(NAME);
  const nameAlpha = name.arch.map((value, at) => Math.max(value, name.scene[at]!));
  mkdirSync("public/brand/icons", { recursive: true });
  await mask(emblem.arch, emblem.width, emblem.height, 160).toFile("public/brand/mabeet-arch.png");
  await mask(emblem.scene, emblem.width, emblem.height, 160).toFile("public/brand/mabeet-scene.png");
  await mask(nameAlpha, name.width, name.height, 96).toFile("public/brand/mabeet-word.png");

  for (const { name: palette, paper, accent } of palettes()) {
    const folder = `public/brand/icons/${palette}`;
    mkdirSync(folder, { recursive: true });
    writeFileSync(`${folder}/icon.png`, await icon(emblem, 512, paper, accent));
    writeFileSync(`${folder}/apple-icon.png`, await icon(emblem, 180, paper, accent));
    const small = await Promise.all(
      [16, 32, 48].map(async (size) => ({ size, png: await icon(emblem, size, paper, accent) })),
    );
    writeFileSync(`${folder}/favicon.ico`, ico(small));
    console.log(`icons for ${palette} written`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
