import { NextResponse } from "next/server";
import { z } from "zod";
import {
  DayForecast,
  ForecastRequestSchema,
  ForecastResponseSchema,
} from "@/lib/schemas";
import { fetchWithRetry } from "@/lib/utils";

// WMO weather code to condition mapping
function mapWeatherCode(code: number): DayForecast["condition"] {
  if (code >= 0 && code <= 3) return "sun"; // Clear to overcast
  if (code === 45 || code === 48) return "clouds"; // Fog
  if (code >= 51 && code <= 65) return "rain"; // Drizzle and rain
  if (code >= 71 && code <= 77) return "snow"; // Snow
  if (code >= 80 && code <= 82) return "rain"; // Rain showers
  if (code >= 85 && code <= 86) return "snow"; // Snow showers
  if (code >= 95 && code <= 99) return "mixed"; // Thunderstorms
  return "clouds"; // Default for unmapped codes
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    uv_index_max: number[];
    weather_code: number[];
  };
}

function normalizeDays(raw: OpenMeteoResponse): DayForecast[] {
  const days: DayForecast[] = [];
  const n = raw.daily.time.length;
  
  for (let i = 0; i < Math.min(n, 7); i++) {
    days.push({
      date: raw.daily.time[i],
      highF: Math.round(raw.daily.temperature_2m_max[i]),
      lowF: Math.round(raw.daily.temperature_2m_min[i]),
      precipChance: Math.round(raw.daily.precipitation_probability_max?.[i] ?? 0),
      windMph: Math.round(raw.daily.wind_speed_10m_max?.[i] ?? 0),
      uvIndex: Math.round(raw.daily.uv_index_max?.[i] ?? 0),
      condition: mapWeatherCode(raw.daily.weather_code?.[i] ?? 0),
    });
  }
  
  return days;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { lat, lon } = ForecastRequestSchema.parse(json);

    // Build Open-Meteo API URL
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lon.toString());
    url.searchParams.set("daily", [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "uv_index_max",
      "weather_code"
    ].join(","));
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("timezone", "auto");
    
    // Fetch forecast data with retry logic
    const res = await fetchWithRetry(
      url.toString(),
      undefined,
      {
        maxRetries: 3,
        initialDelay: 500,
        timeout: 8000,
        retryOn: (response, error) => {
          // Retry on network errors or server errors
          if (error) return true;
          if (response && (response.status >= 500 || response.status === 429)) return true;
          // Don't retry on client errors (4xx except 429)
          return false;
        }
      }
    );
    
    if (!res.ok) {
      console.error(`Open-Meteo forecast API error: ${res.status} for lat=${lat}, lon=${lon}`);
      throw new Error(`Weather service unavailable (status: ${res.status})`);
    }
    
    const data = await res.json() as OpenMeteoResponse;
    const days = normalizeDays(data);
    
    // Validate response shape
    const response = ForecastResponseSchema.parse({ days });
    
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("/api/forecast error:", err);
    return NextResponse.json(
      { error: "Failed to fetch forecast" },
      { status: 500 }
    );
  }
}