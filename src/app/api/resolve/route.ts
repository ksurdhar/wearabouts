import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { ResolvedPlaceSchema, ResolveRequestSchema } from "@/lib/schemas";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define the tool for extracting place candidates
const extractPlacesTool = tool({
  description: "Extract location candidates from a colloquial phrase or hint",
  inputSchema: z.object({
    candidates: z.array(
      z.object({
        name: z.string().describe("The city or location name"),
        admin1: z.string().nullable().describe("State, province, or region (null if unknown)"),
        country: z.string().nullable().describe("Country name or code (null if unknown)")
      })
    ).min(1).max(5).describe("List of 1-5 location candidates")
  }),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { query } = ResolveRequestSchema.parse(json);

    // Use generateText with tool calling for more reliable extraction
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      tools: {
        extractPlaces: extractPlacesTool,
      },
      toolChoice: "required",
      maxRetries: 3,
      system: `You are a location extraction assistant. Extract place candidates from colloquial hints and phrases.
        
Rules:
- Return 3-5 city-level candidates maximum
- Prefer US cities when hints reference Ivy League schools or US sports teams (MLB/NFL/NBA)
- For regions like "Southeast Asia", return specific major cities within that region
- Include state/province (admin1) and country when identifiable
- Use null for unknown admin1 or country fields`,
      prompt: `Extract location candidates from this phrase: "${query}"
      
Examples:
- "the big apple" → New York (city), New York (state), United States (country)
- "city of lights" → Paris (city), Île-de-France (admin1), France (country)
- "emerald city" → Seattle (city), Washington (state), United States (country)
- "Southeast Asia" → Bangkok, Singapore, Kuala Lumpur, etc. (specific cities, not the region itself)`,
    });

    // Extract candidates from tool calls
    let candidates: Array<{ name: string; admin1: string | null; country: string | null }> = [];
    
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls[0];
      if (toolCall.toolName === "extractPlaces" && 'input' in toolCall) {
        const input = toolCall.input as { candidates: Array<{ name: string; admin1: string | null; country: string | null }> };
        candidates = input.candidates || [];
      }
    }

    // Fallback if no tool calls were made
    if (candidates.length === 0) {
      console.warn("No tool calls made for query:", query, "- using fallback extraction");
      candidates = [{ 
        name: query.split(/[,\s]+/)[0] || query,
        admin1: null, 
        country: null 
      }];
    }

    // Geocode the candidates
    const geocoded = await geocodeCandidates(candidates);
    
    if (geocoded.length === 0) {
      return NextResponse.json(
        { 
          error: "No geocoding results found",
          suggestion: "Try a more specific location name"
        },
        { status: 404 }
      );
    }

    // Sort by confidence and prepare response
    const [top, ...rest] = geocoded.sort((a, b) => b.confidence - a.confidence);
    const response = {
      place: top,
      candidates: rest.slice(0, 4),
    };

    // Validate response structure
    ResolvedPlaceSchema.parse(response.place);
    response.candidates?.forEach((c) => ResolvedPlaceSchema.parse(c));

    return NextResponse.json(response);
    
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("Validation error:", err.issues);
      return NextResponse.json({ 
        error: "Invalid request format",
        details: err.issues 
      }, { status: 400 });
    }
    
    console.error("/api/resolve error", err);
    return NextResponse.json({ 
      error: "Failed to process location query",
      message: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 });
  }
}

type Candidate = {
  name: string;
  admin1: string | null;
  country: string | null;
};

async function geocodeCandidates(
  candidates: Candidate[]
) {
  const results: Array<z.infer<typeof ResolvedPlaceSchema>> = [];

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
      let items = (json?.results ?? []) as Array<{
        name?: string;
        admin1?: string;
        country?: string;
        country_code?: string;
        latitude?: number | string;
        longitude?: number | string;
      }>;
      
      // Filter by country/admin1 if provided
      if (c.country || c.admin1) {
        items = items.filter((item) => {
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
    } catch {
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

function toResolvedPlace(raw: {
  name?: string;
  admin1?: string;
  country?: string;
  latitude?: number | string;
  longitude?: number | string;
}, confidence: number) {
  return {
    name: raw?.name ?? "",
    admin1: raw?.admin1 ?? undefined,
    country: raw?.country ?? undefined,
    lat: typeof raw?.latitude === "number" ? raw.latitude : Number(raw?.latitude),
    lon: typeof raw?.longitude === "number" ? raw.longitude : Number(raw?.longitude),
    confidence,
  } satisfies z.infer<typeof ResolvedPlaceSchema>;
}


