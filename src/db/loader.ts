import { crypto_box_keypair } from "@neonbyte/libsodium";
import { encodeBase64, encodeHex } from "@std/encoding";
import { eq } from "drizzle-orm";
import { ENV_APP_ID } from "../constants.ts";
import { db } from "./mod.ts";
import { loaders } from "./schema.ts";

const APP_ID = Deno.env.get(ENV_APP_ID)!;

class LoaderRepository {
  private readonly appId: string = Deno.env.get(ENV_APP_ID)!;

  public async get(): Promise<typeof loaders.$inferSelect> {
    return (await db.query.loaders.findFirst({
      where: (loaders, { eq }) => eq(loaders.id, this.appId),
    }))!;
  }

  public async seed(): Promise<void> {
    if (!(await this.get())) {
      const { publicKey, privateKey } = crypto_box_keypair();

      await db
        .insert(loaders)
        .values({
          id: APP_ID,
          publicKey: encodeHex(publicKey),
          privateKey: encodeHex(privateKey),
        });
    }
  }

  public async update(
    data: Partial<typeof loaders.$inferInsert>,
  ): Promise<void> {
    await db
      .update(loaders)
      .set(data)
      .where(eq(loaders.id, this.appId));
  }

  public async regenerateKeys(): Promise<string> {
    const { publicKey, privateKey } = crypto_box_keypair();

    await this.update({
      publicKey: encodeHex(publicKey),
      privateKey: encodeHex(privateKey),
    });

    return encodeBase64(publicKey);
  }
}

export const loaderRepository = new LoaderRepository();
