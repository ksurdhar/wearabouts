import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { ResolvedPlaceSchema, ResolveRequestSchema } from "@/lib/schemas";

const CandidateSchema = z.object({
  name: z.string(),
  admin1: z.string().optional(),
  country: z.string().optional(),
});

const CandidatesSchema = z.object({
  candidates: z.array(CandidateSchema).min(1).max(5),
});

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { query } = ResolveRequestSchema.parse(json);

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: CandidatesSchema,
      system:
        "You extract place candidates from colloquial hints. Return 3-5 city-level candidates max with country and state/region if known. Prefer US cities when hints reference Ivy League or MLB/NFL/NBA teams. Output as JSON with a 'candidates' array of objects: name, admin1?, country?",
      prompt: `Phrase: ${query}`,
    });

    const geocoded = await geocodeCandidates(object.candidates);
    
    if (geocoded.length === 0) {
      return NextResponse.json(
        { error: "No geocoding results" },
        { status: 404 }
      );
    }

    const [top, ...rest] = geocoded.sort((a, b) => b.confidence - a.confidence);
    const response = {
      place: top,
      candidates: rest.slice(0, 4),
    };

    // Validate against our schema to ensure shape
    ResolvedPlaceSchema.parse(response.place);
    response.candidates?.forEach((c) => ResolvedPlaceSchema.parse(c));

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("/api/resolve error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function geocodeCandidates(
  candidates: z.infer<typeof CandidateSchema>[]
) {
  const results: Array<z.infer<typeof ResolvedPlaceSchema>> = [] as any;

  for (const c of candidates) {
    // Use just the city name for the search, Open-Meteo doesn't handle complex queries well
    const url = new URL(
      "https://geocoding-api.open-meteo.com/v1/search"
    );
    url.searchParams.set("name", c.name);
    url.searchParams.set("count", "5");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    try {
      const res = await fetch(url.toString());
      const json = await res.json();
      let items = (json?.results ?? []) as any[];
      
      // Filter by country/admin1 if provided
      if (c.country || c.admin1) {
        items = items.filter((item: any) => {
          const countryMatch = !c.country || 
            item.country?.toLowerCase().includes(c.country.toLowerCase()) ||
            item.country_code?.toLowerCase() === c.country.toLowerCase();
          const admin1Match = !c.admin1 || 
            item.admin1?.toLowerCase().includes(c.admin1.toLowerCase());
          return countryMatch && admin1Match;
        });
      }
      
      if (items.length === 0) continue;

      // Take the first result as the primary
      const primary = items[0];
      const primaryPlace = toResolvedPlace(primary, 0.9);
      results.push(primaryPlace);

      // Optionally include other geocoding results as alternates with lower confidence
      for (let i = 1; i < Math.min(items.length, 3); i++) {
        const alt = items[i];
        results.push(toResolvedPlace(alt, 0.6));
      }
    } catch (error) {
      // Silently skip this candidate if geocoding fails
    }
  }

  // Deduplicate by lat/lon
  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    const key = `${r.lat.toFixed(3)},${r.lon.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped;
}

function toResolvedPlace(raw: any, confidence: number) {
  return {
    name: raw?.name ?? "",
    admin1: raw?.admin1 ?? undefined,
    country: raw?.country ?? undefined,
    lat: typeof raw?.latitude === "number" ? raw.latitude : Number(raw?.latitude),
    lon: typeof raw?.longitude === "number" ? raw.longitude : Number(raw?.longitude),
    confidence,
  } satisfies z.infer<typeof ResolvedPlaceSchema>;
}


