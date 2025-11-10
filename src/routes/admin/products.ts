import { decodeBase64 } from "@std/encoding/base64";
import { STATUS_CODE } from "@std/http/status";
import { z } from "zod";
import { productRepository } from "../../db/products.ts";
import { ProductStatus } from "../../db/schema.ts";
import { writeProductBin } from "../../fs.ts";
import { defineRoute } from "../_internal.ts";

defineRoute(
  "/api/admin/product",
  (app, { path, validate, adminApiTokenAware, payload, error }) => {
    z;

    const CreateProductDto = z.object({
      id: z.uuidv4()
        .optional(),
      name: z.string()
        .max(64),
      status: z.int()
        .min(ProductStatus.Offline)
        .max(ProductStatus.Online)
        .optional(),
      process: z.string()
        .max(64),
    });

    const RenameProductDto = z.object({
      id: z.uuidv4(),
      name: z.string().max(64),
    });

    const SetStatusDto = z.object({
      id: z.uuidv4(),
      status: z.int()
        .min(ProductStatus.Offline)
        .max(ProductStatus.Online),
    });

    const SetProcessDto = z.object({
      id: z.uuidv4(),
      process: z.string().max(64),
    });

    const UploadDto = z.object({
      id: z.uuidv4(),
      version: z.string(),
      bin: z.base64(),
      active: z.boolean().optional(),
    });

    const IdDto = z.object({ id: z.uuidv4() });

    app.post(
      path("create"),
      adminApiTokenAware,
      validate(CreateProductDto),
      async (c) => {
        const body = payload(CreateProductDto, c);

        if (
          body.id && !(await productRepository.isAvailable({ id: body.id }))
        ) {
          return error(c, STATUS_CODE.Conflict, "The uuid is already used");
        }

        if (!(await productRepository.isAvailable({ name: body.name }))) {
          return error(
            c,
            STATUS_CODE.Conflict,
            "The product name is already used",
          );
        }

        const { id } = await productRepository.create(body);

        return c.json({ id }, STATUS_CODE.Created);
      },
    );

    app.get(
      path(),
      adminApiTokenAware,
      async (c) =>
        c.json(
          await productRepository.findAll({ relations: { version: true } }),
        ),
    );

    app.get(path(":id"), adminApiTokenAware, async (c) => {
      const product = await productRepository.find({
        where: { id: c.req.param("id")! },
      });

      if (!product) {
        return error(
          c,
          STATUS_CODE.NotFound,
          "Failed to find product with given id",
        );
      }

      return c.json(product);
    });

    app.patch(
      path("rename"),
      adminApiTokenAware,
      validate(RenameProductDto),
      async (c) => {
        const body = payload(RenameProductDto, c);
        const product = await productRepository.find({
          where: { id: body.id },
        });

        if (!product) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find product with given id",
          );
        }

        // looks a bit weird, but detects typos (e.g. "reactiioN" => "ReactiioN")
        const skipFreeUsernameCheck =
          product.name.toLowerCase() === body.name.toLowerCase() &&
          product.name !== body.name;

        if (
          !skipFreeUsernameCheck &&
          !(await productRepository.isAvailable({ name: body.name }))
        ) {
          return error(
            c,
            STATUS_CODE.Conflict,
            "The product name is already used",
          );
        }

        await productRepository.update(product.id, { name: body.name });

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.patch(
      path("status"),
      adminApiTokenAware,
      validate(SetStatusDto),
      async (c) => {
        const body = payload(SetStatusDto, c);
        const product = await productRepository.find({
          where: { id: body.id },
        });

        if (!product) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find product with given id",
          );
        }

        if (product.status !== body.status) {
          await productRepository.update(product, { status: body.status });
        }

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.patch(
      path("process"),
      adminApiTokenAware,
      validate(SetProcessDto),
      async (c) => {
        const body = payload(SetProcessDto, c);
        const product = await productRepository.find({
          where: { id: body.id },
        });

        if (!product) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find product with given id",
          );
        }

        if (product.process !== body.process) {
          await productRepository.update(product, { process: body.process });
        }

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.post(
      path("upload"),
      adminApiTokenAware,
      validate(UploadDto),
      async (c) => {
        const body = payload(UploadDto, c);
        const product = await productRepository.find({
          where: { id: body.id },
          relations: {
            version: "full",
          },
        });

        if (!product) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find product with given id",
          );
        }

        const targetVersion =
          product.versions.find(({ version }) => version === body.version) ??
            await productRepository.createVersion(product, body.version);

        if (
          body.active &&
          (product.versionId !== targetVersion.id)
        ) {
          await productRepository.update(product, {
            versionId: targetVersion.id,
          });
        }

        const key = await writeProductBin(
          product.id,
          targetVersion.id,
          decodeBase64(body.bin),
        );

        await productRepository.updateVersion(targetVersion, key);

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.delete(
      path("remove"),
      adminApiTokenAware,
      validate(IdDto),
      async (c) => {
        const body = payload(IdDto, c);
        const product = await productRepository.find({
          where: { id: body.id },
        });

        if (!product) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find product with given id",
          );
        }

        await productRepository.remove(product);

        return c.body(null, STATUS_CODE.NoContent);
      },
    );
  },
);
