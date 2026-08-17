'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  size?: 'thumb' | 'card' | 'full';
  className?: string;
  fallbackSrc?: string;
}

/**
 * OptimizedImage
 * High-performance artwork image component for RaagaX:
 * - Smart sizing (JioSaavn CDN compatible: 500x500 / 150x150)
 * - Instant rendering from memory / disk cache
 * - Zero flash / fast load
 * - Fallback recovery on error
 */
export function OptimizedImage({
  src,
  alt,
  size = 'card',
  className = '',
  fallbackSrc = '/app-icon.png',
  style,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Normalize and transform artwork resolution based on target size
  const resolveArtworkUrl = (rawUrl?: string | null): string => {
    if (!rawUrl || rawUrl.includes('/null/') || rawUrl.trim() === '') {
      return fallbackSrc;
    }

    let url = rawUrl.replace('http://', 'https://');

    if (size === 'thumb') {
      // 150x150 for track rows, mini player
      url = url.replace(/500x500|50x50/g, '150x150');
    } else {
      // 500x500 high-res for cards, shelves, expanded modal (Never 250x250 which 404s on JioSaavn CDN)
      url = url.replace(/50x50|150x150/g, '500x500');
    }

    return url;
  };

  const finalSrc = hasError ? fallbackSrc : resolveArtworkUrl(src);

  // Immediate check if image is already completed in browser cache
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [finalSrc]);

  // Reset error and loaded state when source changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-slate-800/80 ${className}`}>
      {/* Skeleton placeholder while loading */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-white/[0.06] animate-pulse pointer-events-none" />
      )}

      <img
        ref={imgRef}
        src={finalSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (!hasError) {
            setHasError(true);
            setIsLoaded(true);
          }
        }}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isLoaded || hasError ? 'opacity-100' : 'opacity-0'
        }`}
        style={style}
        {...props}
      />
    </div>
  );
}
