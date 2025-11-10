import { and, eq } from "drizzle-orm";
import z from "zod";
import { LoginDto } from "../routes/_dto.ts";
import {
  FindAllModelsOptions,
  FindByIdClause,
  FindByNameClause,
  FindModelOptions,
} from "./_internal.ts";
import { db } from "./mod.ts";
import { ProductModel } from "./products.ts";
import {
  hardware,
  HardwareState,
  products,
  productVersions,
  users,
  usersToProducts,
} from "./schema.ts";

interface UserRelations {
  hardware?: boolean | "full";
  products?: boolean;
}

interface FindByAccessKeyClause {
  accessKey: string;
}

type FindUserOptions<T> = FindModelOptions<T, UserRelations>;

type RawUserModel = typeof users.$inferSelect & {
  components: typeof hardware.$inferSelect[];
  activeHardware: typeof hardware.$inferSelect | null;
  usersToProducts: [
    {
      userId: string;
      productId: string;
      product: typeof products.$inferSelect & {
        version: typeof productVersions.$inferSelect | null;
      };
    },
  ];
};

type UserModel = Omit<RawUserModel, "usersToProducts"> & {
  products: (typeof products.$inferSelect & {
    version: typeof productVersions.$inferSelect | null;
  })[];
};

class UserRepository {
  public async create(
    data: typeof users.$inferInsert,
  ): Promise<UserModel> {
    data.id ??= crypto.randomUUID();

    const [user] = await db
      .insert(users)
      .values(data)
      .returning();

    return {
      ...user,
      components: [],
      activeHardware: null,
      products: [],
    };
  }

  public async createHardware(
    user: UserModel | string,
    state: HardwareState,
    hwid: string,
    components: z.infer<typeof LoginDto>["hardware"],
  ): Promise<typeof hardware.$inferSelect> {
    const [newHardware] = await db
      .insert(hardware)
      .values({
        userId: typeof user === "string" ? user : user.id,
        state,
        hash: hwid,
        components,
      })
      .returning();

    return newHardware;
  }

  public isAvailable(where: FindByIdClause): Promise<boolean>;
  public isAvailable(where: FindByNameClause): Promise<boolean>;
  public async isAvailable(
    where: FindByIdClause | FindByNameClause,
  ): Promise<boolean> {
    return !(await db
      .select({ id: users.id })
      .from(users)
      .where(
        "id" in where ? eq(users.id, where.id) : eq(users.username, where.name),
      )
      .limit(1)).length;
  }

  public find(
    options: FindUserOptions<FindByIdClause>,
  ): Promise<UserModel | null>;
  public find(
    options: FindUserOptions<FindByNameClause>,
  ): Promise<UserModel | null>;
  public find(
    options: FindUserOptions<FindByAccessKeyClause>,
  ): Promise<UserModel | null>;
  public async find(
    options:
      | FindUserOptions<FindByIdClause>
      | FindUserOptions<FindByNameClause>
      | FindUserOptions<FindByAccessKeyClause>,
  ): Promise<UserModel | null> {
    const result = await db.query.users.findFirst({
      where: (users, { eq }) =>
        "id" in options.where
          ? eq(users.id, options.where.id)
          : "name" in options.where
          ? eq(users.username, options.where.name)
          : eq(users.accessKey, options.where.accessKey),
      with: {
        components: options.relations?.hardware === "full" ? true : undefined,
        activeHardware: options.relations?.hardware === "full" ||
            options.relations?.hardware === true
          ? true
          : undefined,
        usersToProducts: options.relations?.products
          ? {
            with: {
              product: {
                with: {
                  version: true,
                },
              },
            },
          }
          : undefined,
      },
    });

    return result ? this.transform(result as unknown as RawUserModel) : null;
  }

  public async findAll(
    options?: FindAllModelsOptions<UserRelations>,
  ): Promise<UserModel[]> {
    const models = await db.query.users.findMany({
      with: {
        components: options?.relations?.hardware === "full" ? true : undefined,
        activeHardware: options?.relations?.hardware === "full" ||
            options?.relations?.hardware === true
          ? true
          : undefined,
        usersToProducts: options?.relations?.products
          ? {
            with: {
              product: {
                with: {
                  version: true,
                },
              },
            },
          }
          : undefined,
      },
    });

    return models.map((model) =>
      this.transform(model as unknown as RawUserModel)
    );
  }

  public async grantAccess(
    user: UserModel | string,
    product: ProductModel | string,
  ): Promise<void> {
    await db
      .insert(usersToProducts)
      .values({
        userId: typeof user === "string" ? user : user.id,
        productId: typeof product === "string" ? product : product.id,
      });
  }

  public async revokeAccess(
    user: UserModel | string,
    product: ProductModel | string,
  ): Promise<void> {
    await db.delete(usersToProducts)
      .where(
        and(
          eq(usersToProducts.userId, typeof user === "string" ? user : user.id),
          eq(
            usersToProducts.productId,
            typeof product === "string" ? product : product.id,
          ),
        ),
      );
  }

  public async handleHardwareChangeRequest(
    activeHardwareId: string,
    state: HardwareState,
  ): Promise<void> {
    await db
      .update(hardware)
      .set({ state })
      .where(eq(hardware.id, activeHardwareId));
  }

  public async update(
    user: UserModel | string,
    data: Partial<Omit<typeof users.$inferInsert, "id">>,
  ) {
    return await db
      .update(users)
      .set(data)
      .where(
        eq(users.id, typeof user === "string" ? user : user.id),
      );
  }

  public async remove(user: UserModel | string) {
    await db
      .delete(users)
      .where(
        eq(users.id, typeof user === "string" ? user : user.id),
      )
      .execute();
  }

  private transform(model: RawUserModel): UserModel;
  private transform(models: RawUserModel[]): UserModel[];
  private transform(
    data: RawUserModel | RawUserModel[],
  ): UserModel | UserModel[] {
    if (Array.isArray(data)) {
      return data.map((children) => this.transform(children));
    }

    return {
      id: data.id,
      username: data.username,
      active: data.active,
      createdAt: data.createdAt,
      password: data.password,
      accessKey: data.accessKey,
      activeHardwareId: data.activeHardwareId,
      activeHardware: data.activeHardware ?? null,
      components: data.components ?? [],
      products: (data.usersToProducts ?? []).map(({ product }) => product),
    };
  }
}

export const userRepository = new UserRepository();
