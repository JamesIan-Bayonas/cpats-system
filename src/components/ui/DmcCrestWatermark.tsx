// src/components/ui/DmcCrestWatermark.tsx
import React from 'react';

export default function DmcCrestWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none fixed bottom-6 left-6 sm:bottom-10 sm:left-10 z-0"
      style={{ opacity: 0.04 }}
    >
      <img
        src="/dmc-logo.png"
        alt=""
        width={320}
        height={320}
        className="w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 object-contain"
        draggable={false}
      />
    </div>
  );
}