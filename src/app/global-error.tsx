'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#07090E] text-white flex items-center justify-center min-h-screen p-6">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-2xl font-bold">Application Error</h2>
          <p className="text-sm text-slate-400">
            {error.message || 'A critical error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 rounded-2xl bg-[#FA233B] text-white text-xs font-bold shadow-lg cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
