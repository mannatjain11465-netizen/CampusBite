import React from 'react';

interface TopNavProps {
  onNavigateSection: (sectionId: string) => void;
  onExploreFood: () => void;
  onPrimaryAction: () => void;
  primaryLabel: string;
}

export function TopNav({
  onNavigateSection,
  onExploreFood,
  onPrimaryAction,
  primaryLabel,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-b border-white/10 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single clean wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          CampusBite
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={onExploreFood}
            className="hover:text-white hover:underline underline-offset-4 decoration-[#F97316] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Explore Food
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('stalls')}
            className="hover:text-white hover:underline underline-offset-4 decoration-[#F97316] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Food Stalls
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('menu')}
            className="hover:text-white hover:underline underline-offset-4 decoration-[#F97316] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Bestsellers
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('how-it-works')}
            className="hover:text-white hover:underline underline-offset-4 decoration-[#F97316] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            How It Works
          </button>
        </nav>

        {/* Zone 3: Primary Saffron CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
