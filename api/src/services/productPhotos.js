import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { photoIdPattern, photoMimeTypes } from "../domain/productPhoto.js";

export const productPhotoDirectory = fileURLToPath(
  new URL("../../uploads/products/", import.meta.url),
);
const widths = [480, 960];

function animatedPng(buffer) {
  // O descodificador PNG pode ignorar a animação APNG; acTL identifica-a no ficheiro.
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "acTL") return true;
    if (type === "IDAT" || type === "IEND") return false;
    offset += buffer.readUInt32BE(offset) + 12;
  }
  return false;
}

export const productPhotos = {
  async save(buffer, contentType, directory = productPhotoDirectory) {
    let variants;
    try {
      const input = sharp(buffer, {
        limitInputPixels: 25_000_000,
        failOn: "warning",
      });
      const metadata = await input.metadata();
      if (
        metadata.format !== photoMimeTypes[contentType] ||
        (metadata.pages ?? 1) !== 1 ||
        metadata.loop !== undefined ||
        (metadata.format === "png" && animatedPng(buffer))
      )
        throw new Error("Formato inválido ou imagem animada.");
      variants = await Promise.all(
        widths.map((width) =>
          input
            .clone()
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer(),
        ),
      );
    } catch {
      throw Object.assign(
        new Error(
          "Envie uma imagem JPEG, PNG ou WebP válida, não animada e com até 25 milhões de píxeis.",
        ),
        { status: 400 },
      );
    }
    const id = randomUUID();
    try {
      await mkdir(directory, { recursive: true });
      // Esperar por ambas as escritas antes de limpar uma eventual falha parcial.
      const writes = await Promise.allSettled(
        variants.map((variant, index) =>
          writeFile(join(directory, `${id}-${widths[index]}.webp`), variant, {
            flag: "wx",
          }),
        ),
      );
      if (writes.some((result) => result.status === "rejected"))
        throw new Error("Falha ao guardar fotografia.");
      return id;
    } catch {
      await productPhotos.remove(id, directory);
      throw Object.assign(
        new Error("Não foi possível guardar a fotografia. Tente novamente."),
        { status: 503 },
      );
    }
  },
  async remove(id, directory = productPhotoDirectory) {
    if (typeof id !== "string" || !photoIdPattern.test(id)) return;
    await Promise.all(
      widths.map(async (width) => {
        try {
          await unlink(join(directory, `${id}-${width}.webp`));
        } catch (error) {
          if (error.code !== "ENOENT")
            console.error(
              "Não foi possível limpar uma fotografia:",
              error.code || error.name,
            );
        }
      }),
    );
  },
};
