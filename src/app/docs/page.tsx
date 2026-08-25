'use client';

import React, { useEffect } from 'react';

export default function DocsPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.href = '/api/docs';
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen text-white text-sm">
      Redirecting to API documentation...
    </div>
  );
}
