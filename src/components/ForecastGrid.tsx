"use client";
import { ForecastCard } from "./ForecastCard";
import { DayForecast, DayAdvice } from "@/lib/schemas";
import { motion } from "framer-motion";

interface ForecastGridProps {
  forecast: DayForecast[];
  outfits: DayAdvice[] | null;
  loadingOutfits: boolean;
}

export function ForecastGrid({ forecast, outfits, loadingOutfits }: ForecastGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <h3 className="text-lg font-semibold mb-4 text-center">
        7-Day Forecast
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {forecast.map((day, i) => {
          const dayOutfit = outfits?.find(o => o.date === day.date);
          return (
            <ForecastCard
              key={i}
              day={day}
              outfit={dayOutfit}
              loadingOutfit={loadingOutfits}
            />
          );
        })}
      </div>
    </motion.div>
  );
}