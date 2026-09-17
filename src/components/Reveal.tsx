"use client";
import { useEffect, useRef } from "react";

export default function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            // also reveal nested .reveal children with stagger
            e.target.querySelectorAll?.(".reveal").forEach((c) => c.classList.add("in-view"));
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    // mark nested reveals
    el.querySelectorAll?.(".reveal").forEach((c) => {
      if ((c as HTMLElement).getBoundingClientRect().top < window.innerHeight * 0.9) {
        (c as HTMLElement).classList.add("in-view");
      }
    });
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
