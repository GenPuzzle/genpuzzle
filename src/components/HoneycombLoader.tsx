'use client';

import React from 'react';
import './honeycomb-loader.css';

export function HoneycombLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="honeycomb">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <p className="text-gray-600 text-sm font-medium">Loading...</p>
    </div>
  );
}
