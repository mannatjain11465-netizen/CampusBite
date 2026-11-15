import React from 'react';

export function MenuCardSkeleton() {
  return (
    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-[#F2EAE0]" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-1/3 bg-[#E6DEC8] rounded" />
        <div className="h-5 w-3/4 bg-[#E6DEC8] rounded" />
        <div className="h-3.5 w-full bg-[#F2EAE0] rounded" />
        <div className="pt-2 flex items-center justify-between">
          <div className="h-5 w-16 bg-[#E6DEC8] rounded" />
          <div className="h-9 w-24 bg-[#E6DEC8] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="animate-pulse border-b border-[#E6DEC8]">
      {Array.from({ length: cols }).map((_, idx) => (
        <td key={idx} className="py-3.5 px-4">
          <div className="h-4 bg-[#F2EAE0] rounded w-4/5" />
        </td>
      ))}
    </tr>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-5 animate-pulse space-y-2.5">
      <div className="h-3.5 w-24 bg-[#F2EAE0] rounded" />
      <div className="h-7 w-28 bg-[#E6DEC8] rounded" />
      <div className="h-3 w-32 bg-[#F2EAE0] rounded" />
    </div>
  );
}
