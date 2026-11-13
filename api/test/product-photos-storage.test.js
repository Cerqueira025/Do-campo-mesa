import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { productPhotos } from "../src/services/productPhotos.js";
import { photoIdPattern } from "../src/domain/productPhoto.js";

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), "campo-photos-"));
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
const image = () =>
  sharp({
    create: { width: 1100, height: 550, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();

test("Guarda variantes WebP reais, remove metadados e persiste para nova leitura do disco", async (t) => {
  const directory = await temporary(t);
  const input = await sharp(await image())
    .withMetadata({ exif: { IFD0: { Artist: "Private" } } })
    .png()
    .toBuffer();
  const id = await productPhotos.save(input, "image/png", directory);
  assert.match(id, photoIdPattern);
  for (const width of [480, 960]) {
    const metadata = await sharp(
      await readFile(join(directory, `${id}-${width}.webp`)),
    ).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, width);
    assert.equal(metadata.exif, undefined);
  }
  await productPhotos.remove(id, directory);
  assert.deepEqual(await readdir(directory), []);
});

test("Rejeita MIME falsificado, conteúdo corrompido, animação e imagem demasiado grande sem escrever", async (t) => {
  const directory = await temporary(t);
  const png = await image();
  const huge = await sharp({
    create: { width: 5001, height: 5000, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const animated = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), {
    raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  for (const [buffer, mime] of [
    [png, "image/jpeg"],
    [Buffer.from("corrompido"), "image/png"],
    [huge, "image/png"],
    [animated, "image/webp"],
  ])
    await assert.rejects(
      productPhotos.save(buffer, mime, directory),
      (error) => error.status === 400,
    );
  assert.deepEqual(await readdir(directory), []);
});

test("Disco indisponível devolve 503 e limpeza nunca aceita caminhos fornecidos pelo utilizador", async (t) => {
  const directory = await temporary(t);
  const occupied = join(directory, "file");
  await writeFile(occupied, "preservar");
  await assert.rejects(
    productPhotos.save(await image(), "image/png", occupied),
    (error) => error.status === 503,
  );
  await productPhotos.remove("../file", directory);
  assert.equal(await readFile(occupied, "utf8"), "preservar");
});

test("Rejeita PNG com animação APNG mesmo quando o descodificador só identifica a imagem estática", async (t) => {
  const directory = await temporary(t);
  function chunk(type, data) {
    const value = Buffer.alloc(12 + data.length);
    value.writeUInt32BE(data.length);
    value.write(type, 4);
    data.copy(value, 8);
    let crc = 0xffffffff;
    for (const byte of value.subarray(4, value.length - 4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    value.writeUInt32BE((crc ^ 0xffffffff) >>> 0, value.length - 4);
    return value;
  }
  const png = await image();
  const animation = Buffer.alloc(8);
  animation.writeUInt32BE(1);
  const frame = Buffer.alloc(26);
  frame.writeUInt32BE(1100, 4);
  frame.writeUInt32BE(550, 8);
  frame.writeUInt16BE(1, 20);
  frame.writeUInt16BE(10, 22);
  const apng = Buffer.concat([
    png.subarray(0, 33),
    chunk("acTL", animation),
    chunk("fcTL", frame),
    png.subarray(33),
  ]);
  assert.equal((await sharp(apng).metadata()).format, "png");
  await assert.rejects(
    productPhotos.save(apng, "image/png", directory),
    (error) => error.status === 400,
  );
  assert.deepEqual(await readdir(directory), []);
});
