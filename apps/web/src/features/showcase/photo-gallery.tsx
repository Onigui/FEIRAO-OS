"use client";

import { useRef, useState } from "react";
import { Car } from "lucide-react";

/** Galeria de arrastar (scroll-snap): leve no celular, sem biblioteca. */
export function PhotoGallery({
  photos,
  alt,
}: {
  photos: { url: string; width: number; height: number }[];
  alt: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Car className="h-14 w-14" aria-hidden />
      </div>
    );
  }

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        data-testid="gallery"
        className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto rounded-2xl bg-muted [scrollbar-width:none]"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.url}
            src={p.url}
            alt={i === 0 ? alt : `${alt} — foto ${i + 1}`}
            width={p.width}
            height={p.height}
            loading={i === 0 ? "eager" : "lazy"}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {photos.length > 1 ? (
        <>
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white">
            {index + 1}/{photos.length}
          </span>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              <button
                key={p.url}
                type="button"
                onClick={() => go(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-primary" : "border-transparent opacity-70"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
