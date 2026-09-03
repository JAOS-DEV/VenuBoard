import { z } from "zod";

import {
  ATMOSPHERE_EXPIRY_MINUTES,
  ATMOSPHERE_PRESENTATIONS,
  ATMOSPHERE_STATES,
} from "./constants";

export const SetAtmosphereSchema = z.object({
  venueId: z.string().uuid(),
  state: z.enum(ATMOSPHERE_STATES),
  expiryMinutes: z.coerce
    .number()
    .refine((value) =>
      (ATMOSPHERE_EXPIRY_MINUTES as readonly number[]).includes(value),
    ),
});

export type SetAtmosphereInput = z.infer<typeof SetAtmosphereSchema>;

export const ClearAtmosphereSchema = z.object({
  venueId: z.string().uuid(),
});

export type ClearAtmosphereInput = z.infer<typeof ClearAtmosphereSchema>;

export const UpdateAtmosphereSettingsSchema = z.object({
  venueId: z.string().uuid(),
  isEnabled: z.boolean(),
  isPubliclyVisible: z.boolean(),
  defaultExpiryMinutes: z.coerce
    .number()
    .refine((value) =>
      (ATMOSPHERE_EXPIRY_MINUTES as readonly number[]).includes(value),
    ),
  frontOfHouseMayUpdate: z.boolean(),
  presentation: z.enum(ATMOSPHERE_PRESENTATIONS),
  headingEn: z.string().max(80).optional(),
  headingTh: z.string().max(80).optional(),
});

export type UpdateAtmosphereSettingsInput = z.infer<
  typeof UpdateAtmosphereSettingsSchema
>;
