"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WeatherIcon } from "./WeatherIcon";
import { formatDate } from "@/lib/date-utils";
import { DayForecast, DayAdvice } from "@/lib/schemas";
import {
  Wind,
  Droplets,
  SunMedium,
  Shirt,
} from "lucide-react";

interface ForecastCardProps {
  day: DayForecast;
  outfit?: DayAdvice | null;
  loadingOutfit: boolean;
}

export function ForecastCard({ day, outfit, loadingOutfit }: ForecastCardProps) {
  return (
    <div className="h-full">
      <Card className="overflow-hidden hover:shadow-md focus-within:shadow-md hover:border-pink-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-0 transition-all h-full group relative" tabIndex={0}>
        <CardContent className="p-4 h-full">
          <div className="flex flex-col h-full gap-3">
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
                {/* Weather conditions - all on one line */}
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
                  {day.windMph > 15 && (
                    <div className="flex items-center gap-1">
                      <Wind className="h-3 w-3" />
                      {day.windMph} mph
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Outfit Section */}
            {(loadingOutfit || outfit) && (
              <>
                <div className="border-t pt-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Shirt className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">What to wear</span>
                  </div>
                  {loadingOutfit && !outfit ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4 mx-auto" />
                    </div>
                  ) : outfit ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {outfit.outfit.slice(0, 4).map((item, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs py-0 px-1.5 border-muted-foreground/20 bg-muted/30">
                            {item}
                          </Badge>
                        ))}
                      </div>
                      {outfit.outfit.length > 4 && (
                        <p className="text-xs text-center text-muted-foreground">
                          +{outfit.outfit.length - 4} more
                        </p>
                      )}
                      {outfit.notes && (
                        <p className="text-xs text-center text-muted-foreground italic mt-2 px-2">
                          {outfit.notes}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
          
          {/* Hover/Focus overlay with full outfit list */}
          {outfit && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 p-4 flex flex-col justify-center pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
              <div className="space-y-1">
                {outfit.outfit.map((item, idx) => (
                  <p key={idx} className="text-xs text-center">
                    {item}
                  </p>
                ))}
              </div>
              {outfit.notes && (
                <p className="text-xs text-center text-muted-foreground italic px-2 mt-3">
                  {outfit.notes}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}