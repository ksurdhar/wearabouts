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

// Forecast schemas
export const DayForecastSchema = z.object({
  date: z.string(), // ISO date format YYYY-MM-DD
  highF: z.number(),
  lowF: z.number(),
  precipChance: z.number().min(0).max(100),
  windMph: z.number().min(0),
  uvIndex: z.number().min(0),
  condition: z.enum(['sun', 'clouds', 'rain', 'snow', 'mixed']),
});

export type DayForecast = z.infer<typeof DayForecastSchema>;

export const ForecastRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const ForecastResponseSchema = z.object({
  days: z.array(DayForecastSchema).length(7),
});


