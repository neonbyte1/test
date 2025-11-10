import {
  crypto_box_seal,
  crypto_box_seal_open,
  crypto_pwhash_MEMLIMIT_INTERACTIVE,
  crypto_pwhash_OPSLIMIT_INTERACTIVE,
  crypto_pwhash_str,
  crypto_pwhash_str_needs_rehash,
  crypto_pwhash_str_verify,
} from "@neonbyte/libsodium";
import { decodeBase64, decodeHex, encodeBase64 } from "@std/encoding";
import { STATUS_CODE } from "@std/http";
import { Context, MiddlewareHandler } from "hono";
import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { ENV_APP_ID } from "../constants.ts";
import { loaderRepository } from "../db/loader.ts";
import { HardwareState, ProductStatus } from "../db/schema.ts";
import { userRepository } from "../db/users.ts";
import { readProductBin } from "../fs.ts";
import {
  EncryptedDto,
  HardwareDto,
  LoginDto,
  StreamProductDto,
} from "./_dto.ts";
import { defineRoute } from "./_internal.ts";

function sha(data: string, secret?: string): string {
  if (secret) {
    return createHmac("sha256", secret).update(data).digest("hex");
  }
  return createHash("sha256").update(data).digest("hex");
}

function computeHwid(
  components: z.infer<typeof HardwareDto>,
): string {
  const EMPTY_SERIAL = "0000-0000-0000-0000";

  return sha(
    [
      sha(components.cpu.id ?? components.cpu.name!),
      sha(components.motherboard.serial ?? EMPTY_SERIAL),
      sha(components.motherboard.sku ?? EMPTY_SERIAL),
      sha(components.bios.uuid),
      ...components.gpu.map(({ deviceId, uuid }) =>
        sha(uuid ?? deviceId.substring(deviceId.lastIndexOf("\\") + 1))
      ),
      ...components.hdds.sort((a, b) => a.deviceId.localeCompare(b.deviceId))
        .map(({ serial }) => sha(serial)),
      sha(components.guid),
    ].join("|"),
  );
}

defineRoute(
  "/api/client/",
  (app, { path, error, payload, validate }) => {
    const APP_ID = Deno.env.get(ENV_APP_ID)!;

    const appAware: MiddlewareHandler = async (c, next) => {
      const token = c.req.header("valkyrie-app-id");

      if (!token || token !== APP_ID) {
        return error(
          c,
          STATUS_CODE.BadRequest,
          "Invalid or missing application id",
        );
      }

      const version = c.req.header("valkyrie-app-version");

      if (!version) {
        return error(
          c,
          STATUS_CODE.BadRequest,
          "Missing application version",
        );
      }

      const loader = await loaderRepository.get();

      if (!loader.active) {
        return error(
          c,
          STATUS_CODE.ServiceUnavailable,
          "The loader is currently in mainitenance mode",
        );
      }
      if (version !== loader.version) {
        return error(
          c,
          STATUS_CODE.PreconditionFailed,
          "Your client is outdated",
        );
      }

      await next();
    };

    async function decrypt<T extends z.ZodObject>(
      c: Context,
      obj: T,
    ): Promise<z.infer<T> | null> {
      const { data } = payload(EncryptedDto, c);
      const { publicKey, privateKey } = await loaderRepository.get();

      try {
        const result = obj.safeParse(
          JSON.parse(new TextDecoder().decode(crypto_box_seal_open(
            decodeBase64(data),
            decodeHex(publicKey),
            decodeHex(privateKey),
          ))),
        );

        return result.success ? result.data! : null;
      } catch {
        return null;
      }
    }

    app.post(
      path("login"),
      appAware,
      validate(EncryptedDto),
      async (c) => {
        const loginDto = await decrypt(c, LoginDto);

        if (!loginDto) {
          return error(c, STATUS_CODE.BadRequest, "Malformed payload");
        }

        const user = await userRepository.find({
          where: { name: loginDto.username },
          relations: {
            hardware: "full",
            products: true,
          },
        });

        if (
          !user ||
          (user.password &&
            !crypto_pwhash_str_verify(user.password, loginDto.password))
        ) {
          return error(c, STATUS_CODE.NotFound, "Invalid username or password");
        }

        if (
          !user.password ||
          (user.password &&
            crypto_pwhash_str_needs_rehash(
              user.password,
              crypto_pwhash_OPSLIMIT_INTERACTIVE,
              crypto_pwhash_MEMLIMIT_INTERACTIVE,
            ))
        ) {
          await userRepository.update(user.id, {
            password: crypto_pwhash_str(
              loginDto.password,
              crypto_pwhash_OPSLIMIT_INTERACTIVE,
              crypto_pwhash_MEMLIMIT_INTERACTIVE,
            ),
          });
        }

        if (!user.active) {
          return error(c, STATUS_CODE.Forbidden, "Your account is disabled");
        }

        const hwid = computeHwid(loginDto.hardware);

        if (!user.activeHardwareId) {
          const newHardware = await userRepository.createHardware(
            user,
            user.components.length === 0
              ? HardwareState.Approved
              : HardwareState.Pending,
            hwid,
            loginDto.hardware,
          );

          await userRepository.update(user, {
            activeHardwareId: newHardware.id,
          });
        } else {
          if (hwid !== user.activeHardware?.hash) {
            return error(c, STATUS_CODE.Forbidden, "Invalid HWID");
          }

          if (user.activeHardware!.state !== HardwareState.Approved) {
            return error(
              c,
              STATUS_CODE.Forbidden,
              user.activeHardware!.state === HardwareState.Pending
                ? "Your HWID request is still being processed"
                : "Your HWID request has been rejected",
            );
          }
        }

        if (user.products.length === 0) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "You do not have access to any products",
          );
        }

        return c.json({
          payload: encodeBase64(crypto_box_seal(
            JSON.stringify({
              userId: user.id,
              username: user.username,
              products: user.products.map(({ id, name, status, version }) => ({
                id,
                name,
                status,
                version: version?.version ?? null,
              })),
            }),
            decodeBase64(loginDto.publicKey),
          )),
        });
      },
    );

    app.post(
      path("stream-product"),
      appAware,
      validate(EncryptedDto),
      async (c) => {
        const dto = await decrypt(c, StreamProductDto);

        if (!dto) {
          return error(c, STATUS_CODE.BadRequest, "Malformed payload");
        }

        const user = await userRepository.find({
          where: { id: dto.user },
          relations: {
            products: true,
          },
        });

        if (!user) {
          return error(c, STATUS_CODE.NotFound, "Invalid username or password");
        }

        const product = user.products.find(({ id }) => dto.product === id);

        if (!product) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find the requested product",
          );
        }

        if (product.status !== ProductStatus.Online) {
          return error(
            c,
            STATUS_CODE.ServiceUnavailable,
            "The product is currently unavailable",
          );
        }

        if (!product.version) {
          return error(
            c,
            STATUS_CODE.ServiceUnavailable,
            "There is no version available",
          );
        }

        const bin = await readProductBin(
          product.id,
          product.version.id,
          product.version.key,
        );

        if (!bin) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to fetch file from cloud",
          );
        }

        return c.json({
          payload: encodeBase64(
            crypto_box_seal(
              JSON.stringify({
                bin: encodeBase64(bin),
                process: product.process,
              }),
              decodeBase64(dto.publicKey),
            ),
          ),
        });
      },
    );
  },
);
