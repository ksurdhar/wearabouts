import { z } from "zod";

export const ResolvedPlaceSchema = z.object({
  name: z.string(),
  admin1: z.string().optional(),
  country: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
  confidence: z.number().min(0).max(1),
  altCandidates: z
    .array(
      z.object({
        name: z.string(),
        admin1: z.string().optional(),
        country: z.string().optional(),
        lat: z.number(),
        lon: z.number(),
        confidence: z.number().min(0).max(1),
      })
    )
    .optional(),
});

export type ResolvedPlace = z.infer<typeof ResolvedPlaceSchema>;

export const ResolveRequestSchema = z.object({
  query: z.string().min(1),
});


