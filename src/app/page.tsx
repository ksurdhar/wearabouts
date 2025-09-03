"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { z } from "zod";
import { ResolvedPlaceSchema, DayForecastSchema } from "@/lib/schemas";
import {
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  CloudLightning,
  Wind,
  Droplets,
  SunMedium,
  MapPin,
} from "lucide-react";

type ResolvedPlace = z.infer<typeof ResolvedPlaceSchema>;
type DayForecast = z.infer<typeof DayForecastSchema>;

// Map weather conditions to Lucide icons
function WeatherIcon({ condition, className }: { condition: DayForecast["condition"]; className?: string }) {
  const iconProps = { className: className || "h-8 w-8" };
  switch (condition) {
    case "sun":
      return <Sun {...iconProps} />;
    case "clouds":
      return <Cloud {...iconProps} />;
    case "rain":
      return <CloudRain {...iconProps} />;
    case "snow":
      return <Snowflake {...iconProps} />;
    case "mixed":
      return <CloudLightning {...iconProps} />;
    default:
      return <Cloud {...iconProps} />;
  }
}

// Format date to day of week
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loadingResolve, setLoadingResolve] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [result, setResult] = useState<{
    place: ResolvedPlace;
    candidates?: ResolvedPlace[];
  } | null>(null);
  const [forecast, setForecast] = useState<DayForecast[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchForecast(lat: number, lon: number) {
    setLoadingForecast(true);
    setForecast(null);
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Forecast failed");
      setForecast(json.days);
    } catch (e) {
      console.error("Forecast error:", e);
      setError("Failed to fetch forecast");
    } finally {
      setLoadingForecast(false);
    }
  }

  async function onSubmit() {
    if (!query.trim()) return;
    setLoadingResolve(true);
    setResult(null);
    setForecast(null);
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
      setResult(json);
      
      // Automatically fetch forecast for the resolved place (don't await - let it load in background)
      fetchForecast(json.place.lat, json.place.lon);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Something went wrong");
      setResult(null);
    } finally {
      setLoadingResolve(false);
    }
  }

  async function selectCandidate(candidate: ResolvedPlace) {
    setResult(prev => prev ? { ...prev, place: candidate } : null);
    // Fetch forecast in background - don't await
    fetchForecast(candidate.lat, candidate.lon);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-12">
      <main className="w-full">
        <div className="text-center mb-12">
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
              disabled={loadingResolve || loadingForecast}
            >
              Get outfits
            </Button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-auto max-w-xl mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Location result */}
        {(loadingResolve || result) && (
          <div className="mb-8">
            {loadingResolve ? (
              <div className="mx-auto max-w-xl">
                <Skeleton className="h-20 w-full" />
              </div>
            ) : result ? (
              <div className="mx-auto max-w-xl">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h2 className="text-lg font-semibold">
                            {result.place.name}
                            {result.place.admin1 && `, ${result.place.admin1}`}
                          </h2>
                          {result.place.country && (
                            <p className="text-sm text-muted-foreground">{result.place.country}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {(result.place.confidence * 100).toFixed(0)}% match
                      </Badge>
                    </div>
                  </CardHeader>
                  {result.candidates && result.candidates.length > 0 && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Not quite right? Try:</p>
                      <div className="flex flex-wrap gap-2">
                        {result.candidates.map((candidate, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="cursor-pointer hover:bg-secondary"
                            onClick={() => selectCandidate(candidate)}
                          >
                            {candidate.name}
                            {candidate.admin1 && `, ${candidate.admin1}`}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            ) : null}
          </div>
        )}

        {/* Forecast display */}
        {(loadingForecast || forecast) && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-center">7-Day Forecast</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {loadingForecast ? (
                // Loading skeletons
                Array.from({ length: 7 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                  </Card>
                ))
              ) : forecast ? (
                // Actual forecast cards
                forecast.map((day, i) => (
                  <Card key={i} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="text-center space-y-2">
                        <p className="text-sm font-medium">
                          {formatDate(day.date)}
                        </p>
                        <div className="flex justify-center py-2">
                          <WeatherIcon condition={day.condition} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-semibold">
                            {day.highF}° / {day.lowF}°
                          </p>
                          {day.precipChance > 30 && (
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                              <Droplets className="h-3 w-3" />
                              {day.precipChance}%
                            </div>
                          )}
                          {day.windMph > 15 && (
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                              <Wind className="h-3 w-3" />
                              {day.windMph} mph
                            </div>
                          )}
                          {day.uvIndex > 6 && (
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                              <SunMedium className="h-3 w-3" />
                              UV {day.uvIndex}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : null}
            </div>
          </div>
        )}

        {/* Debug view - collapsible */}
        {result && (
          <details className="mx-auto mt-12 max-w-4xl">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              View raw data
            </summary>
            <div className="mt-2 grid md:grid-cols-2 gap-4">
              <pre className="whitespace-pre-wrap rounded-md border bg-card p-4 text-xs text-foreground overflow-auto">
                {JSON.stringify({ place: result.place, candidates: result.candidates }, null, 2)}
              </pre>
              {forecast && (
                <pre className="whitespace-pre-wrap rounded-md border bg-card p-4 text-xs text-foreground overflow-auto">
                  {JSON.stringify(forecast, null, 2)}
                </pre>
              )}
            </div>
          </details>
        )}
      </main>

      <footer className="mt-16 text-center text-xs text-muted-foreground">
        <span>v0</span>
      </footer>
    </div>
  );
}