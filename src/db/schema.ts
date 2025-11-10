import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const loaders = pgTable(
  "core_loader",
  {
    id: uuid()
      .notNull()
      .defaultRandom()
      .primaryKey(),
    active: boolean()
      .notNull()
      .default(false),
    version: varchar({ length: 32 })
      .notNull()
      .default("1.0.0"),
    lastUpdate: timestamp({ mode: "date" })
      .default(sql`NULL`),
    publicKey: varchar({ length: 64 })
      .notNull(),
    privateKey: varchar({ length: 64 })
      .notNull(),
  },
);

export const users = pgTable(
  "users",
  {
    id: uuid()
      .notNull()
      .defaultRandom()
      .primaryKey(),
    username: varchar({ length: 64 })
      .notNull()
      .unique(),
    active: boolean()
      .notNull()
      .default(false),
    createdAt: timestamp({ mode: "date" })
      .defaultNow(),
    password: varchar()
      .default(sql`NULL`),
    accessKey: varchar({ length: 32 })
      .notNull()
      .unique()
      .$default(() => crypto.randomUUID().replaceAll("-", "")),
    activeHardwareId: uuid(),
  },
);

export const usersRelations = relations(users, ({ many, one }) => ({
  usersToProducts: many(usersToProducts),
  components: many(hardware),
  activeHardware: one(hardware, {
    fields: [users.activeHardwareId],
    references: [hardware.id],
  }),
}));

export enum HardwareState {
  Pending = 0,
  Rejected,
  Approved,
}

export const hardware = pgTable(
  "hardware",
  {
    id: uuid()
      .notNull()
      .defaultRandom()
      .primaryKey(),
    createdAt: timestamp({ mode: "date" })
      .defaultNow(),
    state: integer()
      .notNull(),
    hash: varchar()
      .notNull(),
    components: jsonb()
      .notNull()
      .$type<Record<string, unknown>>(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
);

export const hardwareRelations = relations(hardware, ({ one }) => ({
  user: one(users, {
    fields: [hardware.userId],
    references: [users.id],
  }),
}));

export enum ProductStatus {
  Offline = 0,
  Detected,
  Updating,
  Testing,
  Online,
}

export const products = pgTable(
  "products",
  {
    id: uuid()
      .notNull()
      .defaultRandom()
      .primaryKey(),
    name: varchar({ length: 64 })
      .notNull()
      .unique(),
    status: integer()
      .notNull()
      .default(ProductStatus.Offline),
    createdAt: timestamp({ mode: "date" })
      .defaultNow(),
    process: varchar({ length: 64 })
      .notNull(),
    versionId: uuid()
      .default(sql`NULL`),
    lastUpdate: timestamp({ mode: "date" })
      .default(sql`NULL`),
  },
);

export const productsRelations = relations(products, ({ many, one }) => ({
  versions: many(productVersions),
  usersToProducts: many(usersToProducts),
  version: one(productVersions, {
    fields: [products.versionId],
    references: [productVersions.id],
  }),
}));

export const productVersions = pgTable(
  "product_versions",
  {
    id: uuid()
      .notNull()
      .defaultRandom()
      .primaryKey(),
    productId: uuid()
      .references(() => products.id, { onDelete: "cascade" }),
    version: varchar({ length: 32 })
      .notNull(),
    createdAt: timestamp({ mode: "date" })
      .defaultNow(),
    lastUpdate: timestamp({ mode: "date" })
      .defaultNow(),
    key: varchar({ length: 64 })
      .notNull(),
  },
);

export const productVersionsRelations = relations(
  productVersions,
  ({ one }) => ({
    product: one(products, {
      fields: [productVersions.productId],
      references: [products.id],
    }),
  }),
);

export const usersToProducts = pgTable(
  "users_to_products",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
);

export const usersToProductsRelations = relations(
  usersToProducts,
  ({ one }) => ({
    product: one(products, {
      fields: [usersToProducts.productId],
      references: [products.id],
    }),
    user: one(users, {
      fields: [usersToProducts.userId],
      references: [users.id],
    }),
  }),
);
