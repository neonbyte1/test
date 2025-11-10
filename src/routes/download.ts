import { encodeBase64 } from "@std/encoding";
import { STATUS_CODE } from "@std/http/status";
import { cors } from "hono/cors";
import { loaderRepository } from "../db/loader.ts";
import { userRepository } from "../db/users.ts";
import { readLoaderBin } from "../fs.ts";
import { RequestLoaderDownloadDto } from "./_dto.ts";
import { defineRoute } from "./_internal.ts";

defineRoute(
  (app, { error, payload, validate }) => {
    app.use("/api/download", cors());

    app.post(
      "/api/download",
      validate(RequestLoaderDownloadDto),
      async (c) => {
        const user = await userRepository.find({
          where: {
            accessKey: payload(RequestLoaderDownloadDto, c).key,
          },
          relations: {
            products: true,
          },
        });

        if (!user) {
          return error(c, STATUS_CODE.NotFound, "Invalid access key.");
        }

        if (!user.active) {
          return error(c, STATUS_CODE.Forbidden, "Your account is disabled.");
        }

        if (!user.products.length) {
          return error(
            c,
            STATUS_CODE.Forbidden,
            "You do not have access to any products.",
          );
        }

        const loader = await loaderRepository.get();

        if (!loader.active) {
          return error(
            c,
            STATUS_CODE.ServiceUnavailable,
            "The loader is currently in maintenance mode.",
          );
        }

        const archive = await readLoaderBin();

        if (!archive) {
          return error(
            c,
            STATUS_CODE.ServiceUnavailable,
            "You can’t download the loader right now.",
          );
        }

        return c.json({
          file: encodeBase64(archive),
          filename: `valkyrie-${loader.version}.zip`,
        });
      },
    );
  },
);
