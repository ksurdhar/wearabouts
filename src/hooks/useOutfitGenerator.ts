import { useState } from "react";
import { ResolvedPlace, DayForecast, DayAdvice } from "@/lib/schemas";

interface UseOutfitGeneratorReturn {
  generateOutfits: (place: ResolvedPlace, days: DayForecast[]) => Promise<void>;
  clearOutfits: () => void;
  outfits: DayAdvice[] | null;
  loading: boolean;
  error: string | null;
}

export function useOutfitGenerator(): UseOutfitGeneratorReturn {
  const [outfits, setOutfits] = useState<DayAdvice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateOutfits = async (place: ResolvedPlace, days: DayForecast[]) => {
    setLoading(true);
    setOutfits(null);
    setError(null);
    
    try {
      const res = await fetch("/api/generate-outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place, days }),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Outfit generation failed");
      
      setOutfits(json.outfits);
    } catch (e) {
      console.error("Outfit generation error:", e);
      setError("Failed to generate outfits");
    } finally {
      setLoading(false);
    }
  };

  const clearOutfits = () => {
    setOutfits(null);
    setError(null);
  };

  return {
    generateOutfits,
    clearOutfits,
    outfits,
    loading,
    error,
  };
}