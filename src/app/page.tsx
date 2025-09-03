"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { z } from "zod";
import { ResolvedPlaceSchema } from "@/lib/schemas";

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    place: z.infer<typeof ResolvedPlaceSchema>;
    candidates?: z.infer<typeof ResolvedPlaceSchema>[];
  } | null>(null);

  async function onSubmit() {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
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
      setResult(json);
    } catch (e) {
      console.error(e);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center px-6 py-12">
      <main className="w-full text-center">
        <h1 className="mb-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Wearabouts
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-balance text-muted-foreground">
          Outfit forecaster. Fit in anywhere with style recs based on place and weather.
        </p>

        <div className="mx-auto flex w-full max-w-xl items-center gap-2">
          <Input
            placeholder="Try: ivy league weekend, or Yankees vs Red Sox in May"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Location or vibe"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
          />
          <Button
            className="shrink-0"
            aria-label="Get outfits"
            onClick={onSubmit}
            disabled={loading}
          >
            Get outfits
          </Button>
        </div>
        <div className="mx-auto mt-8 w-full max-w-xl text-left">
          {loading ? (
            <p className="text-sm text-muted-foreground">Resolving…</p>
          ) : result ? (
            <pre className="whitespace-pre-wrap rounded-md border bg-card p-4 text-xs text-foreground">{JSON.stringify(result, null, 2)}</pre>
          ) : null}
        </div>
      </main>

      <footer className="mt-16 text-xs text-muted-foreground">
        <span>v0</span>
      </footer>
    </div>
  );
}
