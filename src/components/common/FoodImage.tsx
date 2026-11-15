import React, { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { resolveFoodImage } from '../../lib/foodAssets';

interface FoodImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function FoodImage({ src, alt, className = 'w-full h-full object-cover' }: FoodImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveFoodImage(src);

  if (failed || !resolved) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-stone-100 to-amber-50 text-zinc-500 p-4 text-center ${className}`}
      >
        <UtensilsCrossed className="w-7 h-7 text-[#EA580C]/70 mb-1.5" />
        <span className="text-xs font-medium text-zinc-600 line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
