import { z } from "zod";

export const EncryptedDto = z.object({ data: z.base64() });

export const HardwareDto = z.object({
  cpu: z.object({
    name: z.string().nullable(),
    manufacturer: z.string().nullable(),
    id: z.string().nullable(),
    maxClockSpeed: z.number().nullable(),
    numCores: z.number().nullable(),
    numEnabledCores: z.number().nullable(),
    numLogicalProcessors: z.number().nullable(),
  }),
  motherboard: z.object({
    name: z.string().nullable(),
    model: z.string().nullable(),
    serial: z.string().nullable(),
    sku: z.string().nullable(),
  }),
  gpu: z.array(z.object({
    name: z.string(),
    deviceId: z.string(),
    uuid: z.string().optional(),
  })),
  hdds: z.array(z.object({
    size: z.number(),
    deviceId: z.string(),
    model: z.string(),
    serial: z.string(),
  })),
  memory: z.array(z.object({
    bank: z.string().nullable(),
    manufacturer: z.string().nullable(),
    model: z.string().nullable(),
    name: z.string().nullable(),
    capacity: z.number().nullable(),
    speed: z.number().nullable(),
    locator: z.string().nullable(),
  })),
  bios: z.object({
    manufacturer: z.string().nullable(),
    name: z.string().nullable(),
    serial: z.string().nullable(),
    version: z.string().nullable(),
    uuid: z.string(),
  }),
  os: z.object({
    name: z.string(),
    version: z.string(),
    build: z.number(),
    installDate: z.string(),
    registeredUser: z.string(),
    serial: z.string().nullable(),
    hostname: z.string().nullable(),
    username: z.string().nullable(),
  }),
  guid: z.string(),
});

export const LoginDto = z.object({
  username: z.string(),
  password: z.string(),
  publicKey: z.base64(),
  hardware: HardwareDto.clone(),
});

export const StreamProductDto = z.object({
  user: z.uuidv4(),
  product: z.uuidv4(),
  publicKey: z.base64(),
});

export const RequestLoaderDownloadDto = z.object({
  key: z.string().length(32),
});
