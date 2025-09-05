"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SearchFormProps {
  query: string;
  setQuery: (query: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function SearchForm({ query, setQuery, onSubmit, loading }: SearchFormProps) {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.4 }}
        className="mx-auto mb-4 max-w-xl text-balance text-muted-foreground"
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
          aria-label="Get fitted"
          onClick={onSubmit}
          disabled={loading}
        >
          Get fitted
        </Button>
      </div>
    </motion.div>
  );
}