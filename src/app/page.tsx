"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobeASCII } from "@/components/GlobeASCII";
import { useState } from "react";
import { z } from "zod";
import { ResolvedPlaceSchema, DayForecastSchema, DayAdviceSchema } from "@/lib/schemas";
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
  Shirt,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type ResolvedPlace = z.infer<typeof ResolvedPlaceSchema>;
type DayForecast = z.infer<typeof DayForecastSchema>;
type DayAdvice = z.infer<typeof DayAdviceSchema>;

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
  const [outfits, setOutfits] = useState<DayAdvice[] | null>(null);
  const [loadingOutfits, setLoadingOutfits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [layoutTransitioned, setLayoutTransitioned] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  async function fetchOutfits(place: ResolvedPlace, days: DayForecast[]) {
    setLoadingOutfits(true);
    setOutfits(null);
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
      // Don't set error - let forecast still show even if outfits fail
    } finally {
      setLoadingOutfits(false);
    }
  }

  async function fetchForecast(lat: number, lon: number, place: ResolvedPlace) {
    setLoadingForecast(true);
    setForecast(null);
    setOutfits(null);
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Forecast failed");
      setForecast(json.days);
      
      // Fetch outfits in the background after forecast succeeds
      if (json.days && json.days.length > 0) {
        fetchOutfits(place, json.days);
      }
    } catch (e) {
      console.error("Forecast error:", e);
      setError("Failed to fetch forecast");
    } finally {
      setLoadingForecast(false);
    }
  }

  async function onSubmit() {
    if (!query.trim()) return;
    setHasSearched(true);
    setLoadingResolve(true);
    setResult(null);
    setForecast(null);
    setOutfits(null);
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
      fetchForecast(json.place.lat, json.place.lon, json.place);
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
    fetchForecast(candidate.lat, candidate.lon, candidate);
  }

  function startNewQuery() {
    // Trigger the transition by setting this flag
    setIsTransitioning(true);
    setLayoutTransitioned(false);
  }

  return (
    <div className="min-h-dvh">
      {/* Animated Header for workspace mode */}
      <AnimatePresence>
        {(layoutTransitioned || (hasSearched && isTransitioning)) && (
          <motion.header 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 0.3,
              ease: "easeOut"
            }}
            className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md"
          >
            <div className="px-6 py-4 grid grid-cols-3 items-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                wearabouts
              </h1>
              <div className="flex justify-center">
                {query && (
                  <h2 className="text-3xl font-semibold">
                    "{query}"
                  </h2>
                )}
              </div>
              <div className="flex justify-end">
                {result && (
                  <Button
                    onClick={startNewQuery}
                    variant="ghost"
                    size="sm"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Search again
                  </Button>
                )}
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <div className={`mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col px-6 ${layoutTransitioned || (hasSearched && isTransitioning) ? 'pt-20 pb-12' : 'justify-center'} transition-all duration-1000`}>
        <main className="w-full">
          {/* Main content with proper animation sequencing */}
          <AnimatePresence 
            mode="wait"
            onExitComplete={() => {
              if (isTransitioning) {
                // After workspace fades out, reset everything
                setHasSearched(false);
                setQuery("");
                setResult(null);
                setForecast(null);
                setOutfits(null);
                setError(null);
                setIsTransitioning(false);
              } else if (hasSearched) {
                // After splash fades out, show workspace
                setLayoutTransitioned(true);
              }
            }}
          >
            {!hasSearched && !isTransitioning && (
              <motion.div 
                initial={{ opacity: 1 }}
                exit={{ 
                  opacity: 0
                }}
                transition={{ 
                  duration: 0.3,
                  ease: "easeOut"
                }}
                className="text-center"
              >
                <motion.h1 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="mb-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
                >
                  wearabouts
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.4 }}
                  className="mx-auto mb-8 max-w-xl text-balance text-muted-foreground"
                >
                  Outfit forecaster. Fit in anywhere with recs based on place and weather.
                </motion.p>

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
              </motion.div>
            )}

            {/* All workspace content wrapped in one motion container */}
            {layoutTransitioned && !isTransitioning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                {/* Globe Loading Indicator - Absolute positioned to not affect layout */}
                <AnimatePresence>
                  {!result && (loadingResolve || loadingForecast || loadingOutfits) && (
                    <motion.div 
                      key="globe"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-x-0 top-24 flex justify-center pointer-events-none"
                    >
                      <GlobeASCII
                        size={50}
                        autoRotate={true}
                        rotationSpeed={0.01}
                        className="text-muted-foreground"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Location result */}
                {result && (
                  <motion.div 
                    className="mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="mx-auto max-w-md">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <h2 className="text-base font-semibold">
                                {result.place.name}
                                {result.place.admin1 && `, ${result.place.admin1}`}
                              </h2>
                              {result.place.country && (
                                <p className="text-xs text-muted-foreground">{result.place.country}</p>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        {result.candidates && result.candidates.length > 0 && (
                          <CardContent className="pt-0">
                            <p className="text-xs text-muted-foreground mb-2">Not quite right? Try:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.candidates.slice(0, 3).map((candidate, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-secondary text-xs"
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
                  </motion.div>
                )}

                {/* Forecast display */}
                {forecast && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <h3 className="text-lg font-semibold mb-4 text-center">
                      7-Day Forecast
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {
                        // Actual forecast cards
                        forecast.map((day, i) => {
                          const dayOutfit = outfits?.find(o => o.date === day.date);
                          return (
                            <div key={i}>
                              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                  <div className="space-y-3">
                                    {/* Weather Section */}
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
                                        {/* Weather conditions - fixed height container for UV and rain side by side */}
                                        <div className="h-5 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                                          {day.precipChance > 30 && (
                                            <div className="flex items-center gap-1">
                                              <Droplets className="h-3 w-3" />
                                              {day.precipChance}%
                                            </div>
                                          )}
                                          {day.uvIndex > 6 && (
                                            <div className="flex items-center gap-1">
                                              <SunMedium className="h-3 w-3" />
                                              UV {day.uvIndex}
                                            </div>
                                          )}
                                        </div>
                                        {/* Wind on separate line if needed */}
                                        {day.windMph > 15 && (
                                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                            <Wind className="h-3 w-3" />
                                            {day.windMph} mph
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Outfit Section */}
                                    {(loadingOutfits || dayOutfit) && (
                                      <>
                                        <div className="border-t pt-3">
                                          <div className="flex items-center justify-center gap-1 mb-2">
                                            <Shirt className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs font-medium text-muted-foreground">What to wear</span>
                                          </div>
                                          {loadingOutfits && !dayOutfit ? (
                                            <div className="space-y-2">
                                              <Skeleton className="h-4 w-full" />
                                              <Skeleton className="h-4 w-3/4 mx-auto" />
                                            </div>
                                          ) : dayOutfit ? (
                                            <div className="space-y-2">
                                              <div className="flex flex-wrap gap-1 justify-center">
                                                {dayOutfit.outfit.slice(0, 4).map((item, idx) => (
                                                  <Badge key={idx} variant="outline" className="text-xs py-0 px-1.5">
                                                    {item}
                                                  </Badge>
                                                ))}
                                              </div>
                                              {dayOutfit.outfit.length > 4 && (
                                                <p className="text-xs text-center text-muted-foreground">
                                                  +{dayOutfit.outfit.length - 4} more
                                                </p>
                                              )}
                                              {dayOutfit.notes && (
                                                <p className="text-xs text-center text-muted-foreground italic mt-2 px-2">
                                                  {dayOutfit.notes}
                                                </p>
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          );
                        })
                      }
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        {/* Error display */}
        {error && (
          <div className="mx-auto max-w-xl mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}



        {/* Debug view - collapsible */}
        {/* {result && (
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
        )} */}
        </main>
      </div>
    </div>
  );
}