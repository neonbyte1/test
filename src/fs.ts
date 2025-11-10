import {
  crypto_secretbox_easy,
  crypto_secretbox_KEYBYTES,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_open_easy,
  randombytes_buf,
} from "@neonbyte/libsodium";
import { create } from "@quentinadam/zip";
import { decodeHex, encodeHex } from "@std/encoding/hex";
import { join, resolve } from "@std/path";
import { existsSync } from "node:fs";

const dataDirectory = resolve("data");
const loaderFilename = join(dataDirectory, "valkyrie.zip");

if (!existsSync(dataDirectory)) {
  await Deno.mkdir(dataDirectory, { recursive: true });
}

export const readLoaderBin = async () =>
  existsSync(loaderFilename) ? await Deno.readFile(loaderFilename) : null;

export const writeLoaderBin = async (data: Uint8Array<ArrayBuffer>) =>
  await Deno.writeFile(
    loaderFilename,
    await create([{ name: "valkyrie.exe", data }]),
  );

export async function writeProductBin(
  product: string,
  version: string,
  data: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const baseDir = join(dataDirectory, "products", product);

  if (!existsSync(baseDir)) {
    await Deno.mkdir(baseDir, { recursive: true });
  }

  const key = randombytes_buf(crypto_secretbox_KEYBYTES);
  const nonce = randombytes_buf(crypto_secretbox_NONCEBYTES);
  const cipher = crypto_secretbox_easy(data, nonce, key);

  const bin = new Uint8Array(cipher.length + nonce.length);

  bin.set(nonce);
  bin.set(cipher, nonce.length);

  await Deno.writeFile(join(baseDir, `${version}.bin`), bin);

  return encodeHex(key);
}

export async function readProductBin(
  product: string,
  version: string,
  key: string,
): Promise<Uint8Array | null> {
  const filename = join(dataDirectory, "products", product, `${version}.bin`);

  if (!existsSync(filename)) {
    return null;
  }

  const secretFile = await Deno.readFile(filename);

  try {
    return crypto_secretbox_open_easy(
      secretFile.subarray(crypto_secretbox_NONCEBYTES),
      secretFile.subarray(0, crypto_secretbox_NONCEBYTES),
      decodeHex(key),
    );
  } catch {
    return null;
  }
}
