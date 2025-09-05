"use client";
import { useSearchWorkflow } from "@/hooks/useSearchWorkflow";
import { SearchForm } from "@/components/SearchForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { LocationCard } from "@/components/LocationCard";
import { ForecastGrid } from "@/components/ForecastGrid";
import { LoadingGlobe } from "@/components/LoadingGlobe";
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const {
    query,
    setQuery,
    hasSearched,
    layoutTransitioned,
    isTransitioning,
    location,
    candidates,
    forecast,
    outfits,
    loadingLocation,
    loadingForecast,
    loadingOutfits,
    error,
    handleSearch,
    selectCandidate,
    startNewSearch,
    handleAnimationComplete,
  } = useSearchWorkflow();

  const isLoading = loadingLocation || loadingForecast || loadingOutfits;

  return (
    <div className="min-h-dvh">
      {/* Animated Header for workspace mode */}
      <AnimatePresence>
        {(layoutTransitioned || (hasSearched && isTransitioning)) && (
          <WorkspaceHeader
            query={query}
            showResult={!!location}
            onNewSearch={startNewSearch}
          />
        )}
      </AnimatePresence>

      <div className={`mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col px-6 ${layoutTransitioned || (hasSearched && isTransitioning) ? 'pt-20 pb-12' : 'justify-center'} transition-all duration-1000`}>
        <main className="w-full">
          {/* Main content with proper animation sequencing */}
          <AnimatePresence 
            mode="wait"
            onExitComplete={handleAnimationComplete}
          >
            {/* Search form - initial state */}
            {!hasSearched && !isTransitioning && (
              <SearchForm
                key="search-form"
                query={query}
                setQuery={setQuery}
                onSubmit={handleSearch}
                loading={loadingLocation || loadingForecast}
              />
            )}

            {/* Workspace content */}
            {layoutTransitioned && !isTransitioning && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                {/* Loading Globe */}
                <LoadingGlobe show={!location && isLoading} />

                {/* Location result */}
                {location && (
                  <LocationCard
                    place={location}
                    candidates={candidates}
                    onSelectCandidate={selectCandidate}
                  />
                )}

                {/* Forecast display */}
                {forecast && (
                  <ForecastGrid
                    forecast={forecast}
                    outfits={outfits}
                    loadingOutfits={loadingOutfits}
                  />
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
        </main>
      </div>
    </div>
  );
}