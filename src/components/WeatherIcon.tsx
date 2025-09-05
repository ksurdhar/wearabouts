import { Sun, Cloud, CloudRain, Snowflake, CloudLightning } from "lucide-react";
import { DayForecast } from "@/lib/schemas";

interface WeatherIconProps {
  condition: DayForecast["condition"];
  className?: string;
}

export function WeatherIcon({ condition, className }: WeatherIconProps) {
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