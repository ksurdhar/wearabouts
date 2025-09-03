import { NextResponse } from "next/server";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  DayForecast,
  DayAdvice,
  GenerateOutfitsRequestSchema,
  GenerateOutfitsResponseSchema,
} from "@/lib/schemas";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Temperature bands for outfit selection
const temperatureBands = [
  { max: 40, items: ['insulated coat', 'thermal base layer', 'beanie', 'warm socks', 'insulated boots'] },
  { max: 55, items: ['sweater', 'medium jacket', 'jeans', 'closed shoes'] },
  { max: 72, items: ['tee or long-sleeve', 'light layer', 'pants or jeans'] },
  { max: 84, items: ['breathable tee', 'light pants or shorts', 'comfortable shoes'] },
  { max: 200, items: ['ultra-light top', 'linen or tech shorts', 'breathable shoes'] }
];

// Persona-specific adjustments
const personaAdjustments = {
  minimal: {
    replacements: {
      'medium jacket': 'versatile jacket',
      'light layer': 'simple cardigan',
      'breathable tee': 'plain tee'
    }
  },
  outdoorsy: {
    replacements: {
      'medium jacket': 'technical fleece',
      'light layer': 'packable vest',
      'comfortable shoes': 'trail shoes',
      'breathable shoes': 'hiking sandals'
    }
  },
  street: {
    replacements: {
      'medium jacket': 'bomber or denim jacket',
      'beanie': 'stylish cap',
      'comfortable shoes': 'sneakers',
      'light pants': 'cargo pants'
    }
  },
  business: {
    replacements: {
      'tee or long-sleeve': 'button-up shirt',
      'light pants or shorts': 'chinos',
      'comfortable shoes': 'loafers or oxfords',
      'ultra-light top': 'linen shirt'
    }
  }
};

// Generate outfit items based on weather conditions (deterministic)
function generateOutfitItems(day: DayForecast, persona?: string): string[] {
  // Find base items based on temperature
  const band = temperatureBands.find(b => day.highF <= b.max);
  const baseItems = band ? [...band.items] : ['comfortable clothes'];
  
  const additionalItems: string[] = [];
  
  // Add weather-specific items
  if (day.precipChance >= 40) {
    additionalItems.push('waterproof shell', 'water-resistant shoes');
  }
  
  if (day.windMph >= 18) {
    additionalItems.push('windbreaker');
  }
  
  if (day.uvIndex >= 7) {
    additionalItems.push('sun hat', 'sunglasses', 'sunscreen');
  }
  
  if (day.lowF <= 38) {
    additionalItems.push('gloves', 'warm scarf');
  }
  
  // Cold morning adjustment
  if (day.lowF <= 50 && day.highF >= 65) {
    additionalItems.push('packable layer');
  }
  
  // Combine all items and remove duplicates
  let allItems = Array.from(new Set([...baseItems, ...additionalItems]));
  
  // Apply persona-specific replacements
  if (persona && personaAdjustments[persona as keyof typeof personaAdjustments]) {
    const adjustments = personaAdjustments[persona as keyof typeof personaAdjustments];
    allItems = allItems.map(item => {
      return adjustments.replacements[item as keyof typeof adjustments.replacements] || item;
    });
  }
  
  return allItems;
}

// Schema for LLM notes generation
const NotesResponseSchema = z.object({
  notes: z.array(z.string()).min(1)
});

// Generate friendly notes for each day using LLM
async function generateNotes(
  days: Array<{ date: string; highF: number; lowF: number; precipChance: number; windMph: number; uvIndex: number; items: string[] }>,
  placeName: string
): Promise<string[]> {
  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: NotesResponseSchema,
      system: `You write one-sentence outfit notes for daily weather in ${placeName}.
Do not change or list the items provided. Just give friendly, practical advice.
Keep it concise and natural. No brand names. Focus on comfort and practicality.
Return an array with one note per day.`,
      prompt: days.map((d, i) => 
        `Day ${i + 1}: ${d.highF}/${d.lowF}°F, ${d.precipChance}% rain, ${d.windMph}mph wind, UV ${d.uvIndex}`
      ).join('\n'),
    });
    
    return object.notes;
  } catch (error) {
    console.error("Failed to generate notes:", error);
    // Return generic notes as fallback
    return days.map(() => "Dress comfortably for the weather conditions.");
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { place, days, persona } = GenerateOutfitsRequestSchema.parse(json);
    
    // Generate outfit items for each day (deterministic)
    const outfitDays = days.map(day => ({
      date: day.date,
      highF: day.highF,
      lowF: day.lowF,
      precipChance: day.precipChance,
      windMph: day.windMph,
      uvIndex: day.uvIndex,
      items: generateOutfitItems(day, persona)
    }));
    
    // Generate friendly notes for all days at once
    const notes = await generateNotes(outfitDays, place.name);
    
    // Combine items and notes into final response
    const outfits: DayAdvice[] = outfitDays.map((day, index) => ({
      date: day.date,
      outfit: day.items,
      notes: notes[index] || undefined
    }));
    
    // Validate response
    const response = GenerateOutfitsResponseSchema.parse({ outfits });
    
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("/api/generate-outfits error:", err);
    return NextResponse.json(
      { error: "Failed to generate outfits" },
      { status: 500 }
    );
  }
}