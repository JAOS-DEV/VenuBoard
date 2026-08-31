import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1)
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

export const passwordSchema = z.string().min(8).max(72);

export const signInPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const signInMagicLinkSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "mismatch",
  });

export const registerFromInvitationSchema = z.object({
  token: z
    .string()
    .min(16)
    .max(128)
    .regex(/^[A-Za-z0-9._~-]+$/),
  password: passwordSchema,
});
