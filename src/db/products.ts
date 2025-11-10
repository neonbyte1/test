import { eq } from "drizzle-orm";
import {
  FindAllModelsOptions,
  FindByIdClause,
  FindByNameClause,
  FindModelOptions,
} from "./_internal.ts";
import { db } from "./mod.ts";
import { products, productVersions, users } from "./schema.ts";

type CreateProductModel = typeof products.$inferInsert;
type RawProductModel = typeof products.$inferSelect & {
  version: typeof productVersions.$inferSelect | null;
  versions: typeof productVersions.$inferSelect[];
  usersToProducts: typeof users.$inferSelect[];
};

export type ProductModel = Omit<RawProductModel, "usersToProducts"> & {
  users: typeof users.$inferSelect[];
};

interface ProductRelations {
  version?: boolean | "full";
  users?: boolean;
}

type FindProductOptions<T extends FindByIdClause | FindByNameClause> =
  FindModelOptions<T, ProductRelations>;

class ProductRepository {
  public async create(data: CreateProductModel): Promise<ProductModel> {
    data.id ??= crypto.randomUUID();

    const [product] = await db
      .insert(products)
      .values(data)
      .returning();

    return { ...product, version: null, versions: [], users: [] };
  }

  public async createVersion(
    product: ProductModel | string,
    version: string,
  ): Promise<typeof productVersions.$inferSelect> {
    const [newVersion] = await db
      .insert(productVersions)
      .values({
        productId: typeof product === "string" ? product : product.id,
        version,
        key: crypto.randomUUID(), // will be updated afterwards
      })
      .returning();

    return newVersion;
  }

  public async updateVersion(
    version: typeof productVersions.$inferSelect | string,
    key: string,
  ): Promise<void> {
    await db
      .update(productVersions)
      .set({ lastUpdate: new Date(), key })
      .where(
        eq(
          productVersions.id,
          typeof version === "string" ? version : version.id,
        ),
      );
  }

  public isAvailable(where: FindByIdClause): Promise<boolean>;
  public isAvailable(where: FindByNameClause): Promise<boolean>;
  public async isAvailable(
    where: FindByIdClause | FindByNameClause,
  ): Promise<boolean> {
    return !(await db
      .select({ id: products.id })
      .from(products)
      .where(
        "id" in where
          ? eq(products.id, where.id)
          : eq(products.name, where.name),
      )
      .limit(1)).length;
  }

  public find(
    options: FindProductOptions<FindByIdClause>,
  ): Promise<ProductModel | null>;
  public find(
    options: FindProductOptions<FindByNameClause>,
  ): Promise<ProductModel | null>;
  public async find(
    options:
      | FindProductOptions<FindByIdClause>
      | FindProductOptions<FindByNameClause>,
  ): Promise<ProductModel | null> {
    const model = await db.query.products.findFirst({
      where: (products, { eq }) =>
        "id" in options.where
          ? eq(products.id, options.where.id)
          : eq(products.name, options.where.name),
      with: {
        version: options.relations?.version === "full" ||
            options.relations?.version === true
          ? true
          : undefined,
        versions: options.relations?.version === "full" ? true : undefined,
        usersToProducts: options.relations?.users ? true : undefined,
      },
    });

    if (!model) {
      return null;
    }

    return this.transform(model as unknown as RawProductModel);
  }

  public async findAll(
    options?: FindAllModelsOptions<ProductRelations>,
  ): Promise<ProductModel[]> {
    const models = await db.query.products.findMany({
      with: {
        version: options?.relations?.version === "full" ||
            options?.relations?.version === true
          ? true
          : undefined,
        versions: options?.relations?.version === "full" ? true : undefined,
        usersToProducts: options?.relations?.users ? true : undefined,
      },
    });

    return models.map((model) =>
      this.transform(model as unknown as RawProductModel)
    );
  }

  public async update(
    product: ProductModel | string,
    data: Partial<Omit<CreateProductModel, "id">>,
  ) {
    return await db
      .update(products)
      .set(data)
      .where(
        eq(products.id, typeof product === "string" ? product : product.id),
      );
  }

  public async remove(product: ProductModel | string) {
    await db
      .delete(products)
      .where(
        eq(products.id, typeof product === "string" ? product : product.id),
      )
      .execute();
  }

  private transform(data: RawProductModel): ProductModel;
  private transform(data: RawProductModel[]): ProductModel[];
  private transform(
    data: RawProductModel | RawProductModel[],
  ): ProductModel | ProductModel[] {
    if (Array.isArray(data)) {
      return data.map((model) => this.transform(model));
    }

    return {
      id: data.id,
      name: data.name,
      status: data.status,
      createdAt: data.createdAt,
      process: data.process,
      versionId: data.versionId,
      lastUpdate: data.lastUpdate,
      key: data.key,
      version: data.version,
      versions: data.versions,
      users: data.usersToProducts,
    };
  }
}

export const productRepository = new ProductRepository();
