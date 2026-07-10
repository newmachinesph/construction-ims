import { z } from "zod";
import { isValidTin } from "@/lib/ph";

/** A positive decimal quantity, accepted as string or number, kept as string. */
export const qtySchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v) && Number(v) > 0, {
    message: "Must be a positive number with up to 3 decimal places.",
  });

/** A non-negative money amount (2 dp), kept as string. */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0, {
    message: "Must be a non-negative amount with up to 2 decimal places.",
  });

export const uuidSchema = z.string().uuid();

export const vatClassSchema = z.enum(["VATABLE", "ZERO_RATED", "EXEMPT"]);

export const tinSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidTin(v), { message: "Invalid TIN. Use 000-000-000 or 000-000-000-00000." });

export const emailSchema = z.string().trim().toLowerCase().email();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
