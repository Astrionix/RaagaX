'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'lucide-react';
import { ArtistImageResolver } from '@/lib/artist/ArtistImageResolver';

interface ArtistAvatarProps {
  name: string;
  id?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  alt?: string;
  language?: string;
  priority?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-10 h-10 text-xs',
  md: 'w-20 h-20 sm:w-24 sm:h-24 text-base',
  lg: 'w-28 h-28 sm:w-36 sm:h-36 text-xl',
  xl: 'w-36 h-36 sm:w-48 sm:h-48 text-3xl',
  full: 'w-full h-full text-base',
};

export const ArtistAvatar: React.FC<ArtistAvatarProps> = ({
  name,
  id,
  imageUrl,
  size = 'md',
  className = '',
  alt,
  language,
}) => {
  const resolver = useMemo(() => ArtistImageResolver.getInstance(), []);

  // 1. Initial cached check (synchronous)
  const initialImage = useMemo(() => {
    if (imageUrl && !imageUrl.includes('/null/') && imageUrl !== '/app-icon.png') {
      return imageUrl;
    }
    return resolver.getCachedImageUrl(name, id);
  }, [imageUrl, name, id, resolver]);

  const [currentSrc, setCurrentSrc] = useState<string | null>(initialImage);
  const [isLoaded, setIsLoaded] = useState(Boolean(initialImage));
  const [hasError, setHasError] = useState(false);

  // 2. Asynchronous background resolution if image is missing or needs resolving
  useEffect(() => {
    let isCancelled = false;

    if (!currentSrc || hasError) {
      resolver
        .resolveArtistImage({
          id,
          name,
          existingImageUrl: imageUrl,
          language,
        })
        .then((resolvedUrl) => {
          if (!isCancelled && resolvedUrl && resolvedUrl !== '/app-icon.png') {
            setCurrentSrc(resolvedUrl);
            setHasError(false);
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
    };
  }, [name, id, imageUrl, language, currentSrc, hasError, resolver]);

  const initials = useMemo(() => {
    if (!name) return 'A';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const handleError = () => {
    if (currentSrc) {
      resolver.markImageFailed(name, id, currentSrc);
    }
    setHasError(true);
    setCurrentSrc(null);
  };

  const containerSizeClass = size !== 'full' ? SIZE_CLASSES[size] : '';

  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 bg-white/5 border border-white/10 flex items-center justify-center select-none ${containerSizeClass} ${className}`}
    >
      {/* 1. Sleek Placeholder / Initials fallback */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 text-slate-300 font-black">
        {name ? (
          <span>{initials}</span>
        ) : (
          <User className="w-1/2 h-1/2 text-slate-400 opacity-60" />
        )}
      </div>

      {/* 2. Real Artist Portrait with smooth fade-in */}
      {currentSrc && !hasError && (
        <img
          src={currentSrc}
          alt={alt || name || 'Artist'}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={handleError}
          className={`w-full h-full object-cover relative z-10 transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};
