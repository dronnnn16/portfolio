"use client";

import { useRef, type ReactNode } from "react";
import { ArrowUpRight } from "../ui/Arrow";

/** Native horizontal scroller with snap, mouse drag-to-scroll and prev/next controls. */
export function DragRow({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  const by = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 280) + 16), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        data-lenis-prevent-wheel
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 md:scroll-px-[max(32px,calc((100vw-1168px)/2))] md:px-[max(32px,calc((100vw-1168px)/2))] [&.dragging]:snap-none [&.dragging]:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !ref.current) return;
          drag.current = { down: true, x: e.clientX, left: ref.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = ref.current;
          if (!d.down || !el) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4 && !d.moved) {
            d.moved = true;
            el.classList.add("dragging");
            el.setPointerCapture(e.pointerId);
          }
          if (d.moved) el.scrollLeft = d.left - dx;
        }}
        onPointerUp={(e) => {
          const el = ref.current;
          drag.current.down = false;
          if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
          el?.classList.remove("dragging");
        }}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
      >
        {children}
      </div>
      <div className="container-x mt-6 flex justify-end gap-2">
        {([-1, 1] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => by(d)}
            aria-label={d < 0 ? "Previous projects" : "Next projects"}
            className="glass grid size-11 place-items-center rounded-full text-white/80 transition-colors hover:border-white/20 hover:text-white"
          >
            <ArrowUpRight className={`size-4 ${d < 0 ? "-rotate-[135deg]" : "rotate-45"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
