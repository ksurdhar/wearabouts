import { useState } from "react";
import { ResolvedPlace, ResolvedPlaceSchema } from "@/lib/schemas";

interface UseLocationResolverReturn {
  resolveLocation: (query: string) => Promise<void>;
  clearLocation: () => void;
  result: ResolvedPlace | null;
  candidates: ResolvedPlace[] | null;
  loading: boolean;
  error: string | null;
}

export function useLocationResolver(): UseLocationResolverReturn {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResolvedPlace | null>(null);
  const [candidates, setCandidates] = useState<ResolvedPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolveLocation = async (query: string) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setResult(null);
    setCandidates(null);
    setError(null);
    
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Resolve failed");
      
      ResolvedPlaceSchema.parse(json.place);
      if (Array.isArray(json.candidates)) {
        json.candidates.forEach((c: unknown) => ResolvedPlaceSchema.parse(c));
      }
      
      setResult(json.place);
      setCandidates(json.candidates || null);
    } catch (e) {
      console.error("Location resolution error:", e);
      setError(e instanceof Error ? e.message : "Something went wrong");
      setResult(null);
      setCandidates(null);
    } finally {
      setLoading(false);
    }
  };

  const clearLocation = () => {
    setResult(null);
    setCandidates(null);
    setError(null);
  };

  return {
    resolveLocation,
    clearLocation,
    result,
    candidates,
    loading,
    error,
  };
}