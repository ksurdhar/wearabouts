"use client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { ResolvedPlace } from "@/lib/schemas";
import { motion } from "framer-motion";

interface LocationCardProps {
  place: ResolvedPlace;
  candidates?: ResolvedPlace[] | null;
  onSelectCandidate: (candidate: ResolvedPlace) => void;
}

export function LocationCard({ place, candidates, onSelectCandidate }: LocationCardProps) {
  return (
    <motion.div 
      className="mb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <h2 className="text-base font-semibold">
                  {place.name}
                  {place.admin1 && `, ${place.admin1}`}
                </h2>
                {place.country && (
                  <p className="text-xs text-muted-foreground">{place.country}</p>
                )}
              </div>
            </div>
          </CardHeader>
          {candidates && candidates.length > 0 && (
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-2">Not quite right? Try:</p>
              <div className="flex flex-wrap gap-1.5">
                {candidates.slice(0, 3).map((candidate, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover:bg-secondary text-xs"
                    onClick={() => onSelectCandidate(candidate)}
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
  );
}