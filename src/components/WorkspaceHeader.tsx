"use client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface WorkspaceHeaderProps {
  query: string;
  showResult: boolean;
  onNewSearch: () => void;
}

export function WorkspaceHeader({ query, showResult, onNewSearch }: WorkspaceHeaderProps) {
  return (
    <motion.header 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md"
    >
      <div className="px-6 py-4 grid grid-cols-3 items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          wearabouts
        </h1>
        <div className="flex justify-center">
          {query && (
            <h2 className="text-3xl font-semibold">
              &ldquo;{query}&rdquo;
            </h2>
          )}
        </div>
        <div className="flex justify-end">
          {showResult && (
            <Button
              onClick={onNewSearch}
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
  );
}