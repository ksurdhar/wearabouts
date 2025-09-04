import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { ResolvedPlaceSchema, ResolveRequestSchema } from "@/lib/schemas";
import { fetchWithRetry } from "@/lib/utils";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper functions for progressive prompting strategies
function getSystemPromptForAttempt(attempt: number, failedLocations: string[]): string {
  const basePrompt = `You are a location extraction assistant. Extract place candidates from colloquial hints and phrases.`;
  
  if (attempt === 1) {
    return `${basePrompt}
    
Rules:
- Return 3-5 city-level candidates maximum
- Prefer US cities when hints reference Ivy League schools or US sports teams (MLB/NFL/NBA)
- For regions like "Southeast Asia", return specific major cities within that region
- Include state/province (admin1) and country when identifiable
- Use null for unknown admin1 or country fields`;
  }
  
  if (attempt === 2) {
    return `${basePrompt}

Previous attempts failed to find: ${failedLocations.join(', ')}

Alternative strategies:
- Consider common misspellings or typos
- Try phonetically similar names
- Look for alternate spellings or transliterations
- Consider historical or former names
- Try breaking compound words or joining separated words
- Consider nearby major cities if the exact location is obscure`;
  }
  
  // Attempt 3 or later
  return `${basePrompt}

All previous geocoding attempts have failed for: ${failedLocations.join(', ')}

Creative fallback strategies:
- Extract the country or region and suggest its capital or largest city
- If it's a nickname or colloquial term, find the official name
- For fictional or non-existent places, suggest the nearest real location
- Consider tourist destinations or landmarks in the mentioned area
- Try the nearest international airport city
- Default to well-known global cities if nothing else works`;
}

function getUserPromptForAttempt(query: string, attempt: number, failedLocations: string[]): string {
  if (attempt === 1) {
    return `Extract location candidates from this phrase: "${query}"
      
Examples:
- "the big apple" → New York (city), New York (state), United States (country)
- "city of lights" → Paris (city), Île-de-France (admin1), France (country)
- "emerald city" → Seattle (city), Washington (state), United States (country)
- "Southeast Asia" → Bangkok, Singapore, Kuala Lumpur, etc. (specific cities, not the region itself)`;
  }
  
  if (attempt === 2) {
    return `The query "${query}" failed to geocode with these attempts: ${failedLocations.join(', ')}

Try alternative interpretations:
- Check for typos: "Pars" → "Paris", "Londn" → "London"
- Phonetic matches: "Mosco" → "Moscow", "Bejing" → "Beijing"
- Common variations: "NYC" → "New York City", "LA" → "Los Angeles"
- Historical names: "Bombay" → "Mumbai", "Saigon" → "Ho Chi Minh City"`;
  }
  
  // Attempt 3 or later
  return `Query "${query}" has failed all standard geocoding with: ${failedLocations.join(', ')}

Please be creative and suggest major cities that could be related:
- If it mentions a country, use its capital
- If it's a region, use the largest metropolitan area
- If it's unclear, suggest global cities like London, Tokyo, New York
- Consider what a tourist might mean by this phrase`;
}

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
    ).min(1).max(5).describe("List of 1-5 location candidates"),
    confidence: z.string().optional().describe("Confidence level: high, medium, or low based on query clarity")
  }),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { query } = ResolveRequestSchema.parse(json);

    const maxAttempts = 3;
    let attempt = 0;
    let geocoded: Array<z.infer<typeof ResolvedPlaceSchema>> = [];
    const attemptedLocations: string[] = [];
    
    while (attempt < maxAttempts && geocoded.length === 0) {
      attempt++;
      
      // Get progressive system prompt based on attempt
      const systemPrompt = getSystemPromptForAttempt(attempt, attemptedLocations);
      const userPrompt = getUserPromptForAttempt(query, attempt, attemptedLocations);
      
      // Use generateText with tool calling for more reliable extraction
      const result = await generateText({
        model: openai("gpt-4o-mini"),
        tools: {
          extractPlaces: extractPlacesTool,
        },
        toolChoice: "required",
        maxRetries: 2,
        system: systemPrompt,
        prompt: userPrompt,
      });

      // Extract candidates from tool calls
      let candidates: Array<{ name: string; admin1: string | null; country: string | null }> = [];
      
      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolCall = result.toolCalls[0];
        if (toolCall.toolName === "extractPlaces" && 'input' in toolCall) {
          const input = toolCall.input as { 
            candidates: Array<{ name: string; admin1: string | null; country: string | null }>,
            confidence?: string 
          };
          candidates = input.candidates || [];
          
          if (input.confidence) {
            console.log(`Extraction confidence for "${query}": ${input.confidence}`);
          }
        }
      }

      // Fallback if no tool calls were made
      if (candidates.length === 0) {
        console.warn(`No tool calls made for query: "${query}" on attempt ${attempt}`);
        candidates = [{ 
          name: query.split(/[,\s]+/)[0] || query,
          admin1: null, 
          country: null 
        }];
      }

      // Track attempted locations
      attemptedLocations.push(...candidates.map(c => c.name));
      
      // Geocode the candidates
      geocoded = await geocodeCandidates(candidates);
      
      if (geocoded.length === 0 && attempt < maxAttempts) {
        console.log(`Attempt ${attempt} failed for "${query}", trying alternative strategies...`);
      }
    }
    
    if (geocoded.length === 0) {
      return NextResponse.json(
        { 
          error: "Could not locate the specified place",
          query: query,
          suggestions: [
            "Try a nearby major city",
            "Check the spelling", 
            "Use the full country or state name",
            "Try a well-known landmark or tourist destination"
          ],
          attemptedLocations: [...new Set(attemptedLocations)]
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
      const res = await fetchWithRetry(
        url.toString(),
        undefined,
        {
          maxRetries: 3,
          initialDelay: 500,
          timeout: 5000,
          retryOn: (response, error) => {
            // Retry on network errors or server errors
            if (error) return true;
            if (response && (response.status >= 500 || response.status === 429)) return true;
            return false;
          }
        }
      );
      
      if (!res.ok) {
        console.warn(`Geocoding failed for "${c.name}" with status ${res.status}`);
        continue;
      }
      
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
    } catch (error) {
      // Log the error but continue with other candidates
      console.error(`Failed to geocode candidate "${c.name}":`, error instanceof Error ? error.message : 'Unknown error');
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


