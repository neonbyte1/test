import { decodeBase64, decodeHex, encodeBase64 } from "@std/encoding";
import z from "zod";
import { loaderRepository } from "../../db/loader.ts";
import { writeLoaderBin } from "../../fs.ts";
import { defineRoute } from "../_internal.ts";

defineRoute(
  "/api/admin/loader",
  (app, { path, validate, adminApiTokenAware, payload }) => {
    const SetActiveDto = z.object({
      active: z.boolean(),
    });

    const UpdateBinaryDto = z.object({
      version: z.string(),
      bin: z.base64(),
      active: z.boolean().optional(),
    });

    app.get(
      path(),
      adminApiTokenAware,
      async (c) => {
        const { id, active, lastUpdate, version, publicKey } =
          await loaderRepository.get();

        return c.json({
          id,
          active,
          version,
          lastUpdate,
          publicKey: encodeBase64(decodeHex(publicKey)),
        });
      },
    );

    app.patch(
      path("active"),
      adminApiTokenAware,
      validate(SetActiveDto),
      async (c) => {
        const body = payload(SetActiveDto, c);
        const loader = await loaderRepository.get();
        const changed = loader.active !== body.active;

        if (changed) {
          await loaderRepository.update(body);
        }

        return c.json({ changed });
      },
    );

    app.patch(path("keys"), adminApiTokenAware, async (c) => {
      const publicKey = await loaderRepository.regenerateKeys();

      return c.json({ publicKey });
    });

    app.put(
      path("upload"),
      adminApiTokenAware,
      validate(UpdateBinaryDto),
      async (c) => {
        const body = payload(UpdateBinaryDto, c);
        const loader = await loaderRepository.get();

        await Promise.all([
          writeLoaderBin(decodeBase64(body.bin)),
          loaderRepository.update({
            active: body.active ?? loader.active,
            version: body.version,
            lastUpdate: new Date(),
          }),
        ]);

        return c.body(null, 204);
      },
    );
  },
);
