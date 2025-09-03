"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");

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
          />
          <Button className="shrink-0" aria-label="Get outfits">
            Get outfits
          </Button>
        </div>
      </main>

      <footer className="mt-16 text-xs text-muted-foreground">
        <span>v0</span>
      </footer>
    </div>
  );
}
