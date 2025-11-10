import { STATUS_TEXT } from "@std/http/status";
import { join } from "@std/path/join";
import { Context, Hono, type MiddlewareHandler } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { validator } from "hono/validator";
import z, { ZodObject } from "zod";
import { ENV_API_TOKEN } from "../constants.ts";

const validate = (
  obj: ZodObject,
): ReturnType<typeof validator> =>
  validator("json", (value, c) => {
    const parsed = obj.safeParse(value);

    if (!parsed.success) {
      return c.json({
        error: "Bad Request",
        message: "Invalid request body",
        statusCode: 400,
        extraMessages: parsed.error.issues.map((issue) =>
          issue.message.replace("Invalid input", issue.path.join("."))
        ),
      }, 400);
    }

    return parsed.data;
  });

function payload<T extends ZodObject>(_: T, c: Context): z.infer<T> {
  return c.req.valid("json" as unknown as never) as z.infer<T>;
}

const error = (
  c: Context,
  statusCode: number,
  message: string,
) =>
  c.json({
    error: (STATUS_TEXT as { [key: number]: string })[statusCode],
    message,
    statusCode,
  }, statusCode as ContentfulStatusCode);

type PathGeneratorFn = (path?: string) => string;
type InitializerFn = (
  app: Hono,
  funcs: {
    path: PathGeneratorFn;
    validate: typeof validate;
    adminApiTokenAware: MiddlewareHandler;
    payload: typeof payload;
    error: typeof error;
  },
) => void | Promise<void>;

const initializerMetadata = new Map<string, InitializerFn[]>();

export function defineRoute(initializer: InitializerFn): void;
export function defineRoute(basePath: string, initializer: InitializerFn): void;
export function defineRoute(
  initializerOrBasePath: InitializerFn | string,
  optionalInitializer?: InitializerFn,
): void {
  const basePath = typeof initializerOrBasePath === "string"
    ? initializerOrBasePath
    : "";

  const path = basePath.startsWith("/") ? basePath : `/${basePath}`;
  let cache = initializerMetadata.get(path);

  if (!cache) {
    cache = [];
  }

  cache.push(
    optionalInitializer ??
      (initializerOrBasePath as InitializerFn),
  );

  initializerMetadata.set(path, cache);
}

async function collectFiles(
  basePath: string,
  path?: string,
): Promise<string[]> {
  const files: string[] = [];
  path ??= "";

  for await (const file of Deno.readDir(basePath)) {
    if (file.isDirectory) {
      files.push(
        ...await collectFiles(join(basePath, file.name), join(path, file.name)),
      );
    } else if (
      file.isFile &&
      !file.isSymlink &&
      !file.name.startsWith("_") &&
      file.name.endsWith(".ts")
    ) {
      files.push(join(path, file.name));
    }
  }

  return files;
}
const ADMIN_API_TOKEN = Deno.env.get(ENV_API_TOKEN) ??
  crypto.randomUUID();

const adminApiTokenAware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header("valkyrie-api-token");

  if (!token || token !== ADMIN_API_TOKEN) {
    return c.json(
      {
        error: "Unauthorized: invalid or missing token",
      },
      401,
    );
  }
  await next();
};

export async function listen(): Promise<void> {
  const app = new Hono();

  // lazy load all files related to this directory expect for this file
  for (const file of await collectFiles(import.meta.dirname!)) {
    await import(`./${file}`);
  }

  // run all initializers
  for (const [basePath, initializers] of initializerMetadata.entries()) {
    for (const initializer of initializers) {
      initializer(app, {
        path: (path?: string) => join(basePath, path ?? ""),
        validate,
        adminApiTokenAware,
        payload,
        error,
      });
    }
  }

  // finally serve the hono application
  Deno.serve(
    {
      port: 3000,
      hostname: Deno.env.get("VALKYRIE_SERVER_HOSTNAME"),
    },
    app.fetch,
  );
}
