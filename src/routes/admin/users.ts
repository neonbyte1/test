import { STATUS_CODE } from "@std/http/status";
import z from "zod";
import { productRepository } from "../../db/products.ts";
import { HardwareState } from "../../db/schema.ts";
import { userRepository } from "../../db/users.ts";
import { defineRoute } from "../_internal.ts";

defineRoute(
  "/api/admin/user",
  (app, { path, validate, adminApiTokenAware, payload, error }) => {
    z;

    const CreateUserDto = z.object({
      id: z.uuidv4().optional(),
      username: z.string().max(64),
      active: z.boolean().optional(),
    });

    const RenameUserDto = z.object({
      id: z.uuidv4(),
      username: z.string().max(64),
    });

    const IdDto = z.object({ id: z.uuidv4() });

    app.post(
      path("create"),
      adminApiTokenAware,
      validate(CreateUserDto),
      async (c) => {
        const body = payload(CreateUserDto, c);

        if (body.id && !(await userRepository.isAvailable({ id: body.id }))) {
          return error(c, STATUS_CODE.Conflict, "The uuid is already used");
        }
        if (!(await userRepository.isAvailable({ name: body.username }))) {
          return error(c, STATUS_CODE.Conflict, "The username is already used");
        }

        const { id } = await userRepository.create(body);

        return c.json({ id }, STATUS_CODE.Created);
      },
    );

    app.get(
      path(),
      adminApiTokenAware,
      async (c) => c.json(await userRepository.findAll()),
    );

    app.get(path(":id"), adminApiTokenAware, async (c) => {
      const user = await userRepository.find({
        where: { id: c.req.param("id")! },
        relations: {
          hardware: "full",
          products: true,
        },
      });

      if (!user) {
        return error(
          c,
          STATUS_CODE.NotFound,
          "Failed to find user with given id",
        );
      }

      return c.json(user);
    });

    app.patch(
      path("rename"),
      adminApiTokenAware,
      validate(RenameUserDto),
      async (c) => {
        const body = payload(RenameUserDto, c);
        const user = await userRepository.find({ where: { id: body.id } });

        if (!user) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find user with given id",
          );
        }

        // looks a bit weird, but detects typos (e.g. "reactiioN" => "ReactiioN")
        const skipFreeUsernameCheck =
          user.username.toLowerCase() === body.username.toLowerCase() &&
          user.username !== body.username;

        if (
          !skipFreeUsernameCheck &&
          !(await userRepository.isAvailable({ name: body.username }))
        ) {
          return error(c, STATUS_CODE.Conflict, "The username is already used");
        }

        await userRepository.update(user, { username: body.username });

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.patch(
      path("reset-password"),
      adminApiTokenAware,
      validate(IdDto),
      async (c) => {
        const body = payload(IdDto, c);
        const user = await userRepository.find({ where: { id: body.id } });

        if (!user) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find user with given id",
          );
        }

        if (user.password !== null) {
          await userRepository.update(user, { password: null });
        }

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    const AccessDto = z.object({
      id: z.uuidv4(),
      product: z.uuidv4(),
    });

    const UserIdDto = z.object({ id: z.uuidv4() });

    const ConfirmHwidDto = z.object({
      id: z.uuidv4(),
      approved: z.boolean(),
    });

    app.post(
      path("grant-access"),
      adminApiTokenAware,
      validate(AccessDto),
      async (c) => {
        const body = payload(AccessDto, c);
        const user = await userRepository.find({
          where: {
            id: body.id,
          },
          relations: {
            products: true,
          },
        });

        if (!user) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find user with given id",
          );
        }

        if (await productRepository.isAvailable({ id: body.product })) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find product with given id",
          );
        }

        if (user.products.some(({ id }) => id === body.product)) {
          return error(
            c,
            STATUS_CODE.Conflict,
            "This user already has access to the requested product",
          );
        }

        await userRepository.grantAccess(body.id, body.product);

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.post(
      path("revoke-access"),
      adminApiTokenAware,
      validate(AccessDto),
      async (c) => {
        const body = payload(AccessDto, c);
        const user = await userRepository.find({
          where: {
            id: body.id,
          },
          relations: {
            products: true,
          },
        });

        if (!user) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find user with given id",
          );
        }

        if (!user.products.some(({ id }) => id === body.product)) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "This user already has no access to the requested product",
          );
        }

        await userRepository.revokeAccess(body.id, body.product);

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.post(
      path("reset-hwid"),
      adminApiTokenAware,
      validate(UserIdDto),
      async (c) => {
        const body = payload(UserIdDto, c);
        const user = await userRepository.find({
          where: {
            id: body.id,
          },
          relations: {
            hardware: "full",
          },
        });

        if (!user) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find user with given id",
          );
        }

        if (!user.activeHardwareId) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "This user has no active hardware components",
          );
        }

        await userRepository.update(user, { activeHardwareId: null });

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.post(
      path("confirm-hwid"),
      adminApiTokenAware,
      validate(ConfirmHwidDto),
      async (c) => {
        const body = payload(ConfirmHwidDto, c);
        const user = await userRepository.find({
          where: {
            id: body.id,
          },
          relations: {
            hardware: "full",
          },
        });

        if (!user) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find user with given id",
          );
        }

        if (!user.activeHardwareId) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "This user has no active hardware components",
          );
        }

        await userRepository.handleHardwareChangeRequest(
          user.activeHardwareId,
          body.approved ? HardwareState.Approved : HardwareState.Rejected,
        );

        return c.body(null, STATUS_CODE.NoContent);
      },
    );

    app.delete(
      path("remove"),
      adminApiTokenAware,
      validate(IdDto),
      async (c) => {
        const body = payload(IdDto, c);
        const user = await userRepository.find({ where: { id: body.id } });

        if (!user) {
          return error(
            c,
            STATUS_CODE.NotFound,
            "Failed to find user with given id",
          );
        }

        await userRepository.remove(user);

        return c.body(null, STATUS_CODE.NoContent);
      },
    );
  },
);
