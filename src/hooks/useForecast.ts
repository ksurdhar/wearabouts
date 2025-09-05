import { useState } from "react";
import { DayForecast } from "@/lib/schemas";

interface UseForecastReturn {
  fetchForecast: (lat: number, lon: number) => Promise<DayForecast[] | null>;
  clearForecast: () => void;
  forecast: DayForecast[] | null;
  loading: boolean;
  error: string | null;
}

export function useForecast(): UseForecastReturn {
  const [forecast, setForecast] = useState<DayForecast[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = async (lat: number, lon: number): Promise<DayForecast[] | null> => {
    setLoading(true);
    setForecast(null);
    setError(null);
    
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon }),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Forecast failed");
      
      setForecast(json.days);
      return json.days;
    } catch (e) {
      console.error("Forecast error:", e);
      setError("Failed to fetch forecast");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearForecast = () => {
    setForecast(null);
    setError(null);
  };

  return {
    fetchForecast,
    clearForecast,
    forecast,
    loading,
    error,
  };
}