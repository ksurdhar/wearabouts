import { useState, useCallback, useEffect, useRef } from "react";
import { ResolvedPlace } from "@/lib/schemas";
import { useLocationResolver } from "./useLocationResolver";
import { useForecast } from "./useForecast";
import { useOutfitGenerator } from "./useOutfitGenerator";

interface UseSearchWorkflowReturn {
  // State
  query: string;
  setQuery: (query: string) => void;
  hasSearched: boolean;
  layoutTransitioned: boolean;
  isTransitioning: boolean;
  
  // Data from hooks
  location: ResolvedPlace | null;
  candidates: ResolvedPlace[] | null;
  forecast: ReturnType<typeof useForecast>["forecast"];
  outfits: ReturnType<typeof useOutfitGenerator>["outfits"];
  
  // Loading states
  loadingLocation: boolean;
  loadingForecast: boolean;
  loadingOutfits: boolean;
  
  // Errors
  error: string | null;
  
  // Actions
  handleSearch: () => Promise<void>;
  selectCandidate: (candidate: ResolvedPlace) => Promise<void>;
  startNewSearch: () => void;
  handleAnimationComplete: () => void;
}

export function useSearchWorkflow(): UseSearchWorkflowReturn {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [layoutTransitioned, setLayoutTransitioned] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const fetchedLocationRef = useRef<string | null>(null);

  const {
    resolveLocation,
    clearLocation,
    result: location,
    candidates,
    loading: loadingLocation,
    error: locationError,
  } = useLocationResolver();

  const {
    fetchForecast,
    clearForecast,
    forecast,
    loading: loadingForecast,
    error: forecastError,
  } = useForecast();

  const {
    generateOutfits,
    clearOutfits,
    outfits,
    loading: loadingOutfits,
    error: outfitError,
  } = useOutfitGenerator();

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    // Clear previous data before starting new search
    clearLocation();
    clearForecast();
    clearOutfits();
    fetchedLocationRef.current = null;
    
    setHasSearched(true);
    await resolveLocation(query);
  }, [query, resolveLocation, clearLocation, clearForecast, clearOutfits]);

  const selectCandidate = useCallback(async (candidate: ResolvedPlace) => {
    const days = await fetchForecast(candidate.lat, candidate.lon);
    if (days && days.length > 0) {
      generateOutfits(candidate, days);
    }
  }, [fetchForecast, generateOutfits]);

  const startNewSearch = useCallback(() => {
    setIsTransitioning(true);
    setLayoutTransitioned(false);
    fetchedLocationRef.current = null; // Reset the fetched location tracker
  }, []);

  const handleAnimationComplete = useCallback(() => {
    if (isTransitioning) {
      // Reset everything after workspace fades out
      setHasSearched(false);
      setQuery("");
      setIsTransitioning(false);
    } else if (hasSearched) {
      // After splash fades out, show workspace
      setLayoutTransitioned(true);
    }
  }, [isTransitioning, hasSearched]);

  // Auto-fetch forecast when location is resolved
  useEffect(() => {
    if (location && layoutTransitioned) {
      // Create a unique key for this location
      const locationKey = `${location.lat}-${location.lon}`;
      
      // Only fetch if we haven't already fetched for this location
      if (fetchedLocationRef.current !== locationKey) {
        fetchedLocationRef.current = locationKey;
        
        fetchForecast(location.lat, location.lon).then((days) => {
          if (days && days.length > 0) {
            generateOutfits(location, days);
          }
        });
      }
    }
  }, [location, layoutTransitioned, fetchForecast, generateOutfits]);

  const error = locationError || forecastError || outfitError;

  return {
    // State
    query,
    setQuery,
    hasSearched,
    layoutTransitioned,
    isTransitioning,
    
    // Data
    location,
    candidates,
    forecast,
    outfits,
    
    // Loading states
    loadingLocation,
    loadingForecast,
    loadingOutfits,
    
    // Errors
    error,
    
    // Actions
    handleSearch,
    selectCandidate,
    startNewSearch,
    handleAnimationComplete,
  };
}