"use client";
import { GlobeASCII } from "@/components/GlobeASCII";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingGlobeProps {
  show: boolean;
}

export function LoadingGlobe({ show }: LoadingGlobeProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          key="globe"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-x-0 top-24 flex justify-center pointer-events-none"
        >
          <GlobeASCII
            size={50}
            autoRotate={true}
            rotationSpeed={0.01}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}