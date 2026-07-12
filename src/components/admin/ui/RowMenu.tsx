"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import m from "./rowMenu.module.css";

/* ============================================================
   Menu d'actions « … » par ligne de tableau. Items = liens ou
   callbacks ; variante danger. Se ferme au clic extérieur / Échap.
   ============================================================ */

export type RowMenuItem = {
  label: string;
  href?: string;
  newTab?: boolean;
  onClick?: () => void;
  danger?: boolean;
};

export default function RowMenu({
  items,
  disabled,
}: {
  items: RowMenuItem[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={m.wrap} ref={ref}>
      <button
        type="button"
        className={m.trigger}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Actions"
      >
        <span>⋯</span>
      </button>
      {open && (
        <div className={m.menu} role="menu">
          {items.map((item, i) =>
            item.href ? (
              <Link
                key={i}
                href={item.href}
                className={`${m.item} ${item.danger ? m.danger : ""}`}
                target={item.newTab ? "_blank" : undefined}
                rel={item.newTab ? "noreferrer" : undefined}
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                className={`${m.item} ${item.danger ? m.danger : ""}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                role="menuitem"
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
