import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { api } from "../api";
import { NAV_ITEMS } from "./Navbar";
import { STATUS } from "./ui";

/* Quick jump: every page plus every claim the lead can see, filtered as you type.
   Keyboard only if you like: arrows move, Enter opens, Esc closes. */
export default function CommandPalette({ open, onClose, onNavigate, dataVersion }) {
  const ref = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [claims, setClaims] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setError(null);
    api
      .getClaims({ role: "lead" })
      .then((list) => live && setClaims(Array.isArray(list) ? list.filter((c) => !c.withheld) : []))
      .catch(() => live && setError("Claims could not be loaded. Pages still work."));
    return () => {
      live = false;
    };
  }, [open, dataVersion]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = NAV_ITEMS.concat([{ id: "check", label: "Check a change" }])
      .filter((p) => !q || (p.long || p.label).toLowerCase().includes(q))
      .map((p) => ({ key: `p-${p.id}`, kind: "page", label: p.long || p.label, go: () => onNavigate(p.id) }));
    const idMatch = q.replace(/^#/, "");
    const cl = (claims || [])
      .filter((c) => q && (String(c.id) === idMatch || c.text?.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((c) => ({ key: `c-${c.id}`, kind: "claim", claim: c, label: c.text, go: () => onNavigate("review", c.id) }));
    return [...pages, ...cl];
  }, [query, claims, onNavigate]);

  const choose = (item) => {
    if (!item) return;
    onClose();
    item.go();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-label="Jump to a page or claim"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="sheet mt-[12vh] mx-auto w-[calc(100vw-2rem)] max-w-xl p-0 rounded-[10px] border border-outline-variant bg-surface-container-lowest text-on-surface shadow-[0_24px_60px_-20px_rgb(29_32_31/0.45)]"
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <label className="flex items-center gap-3 px-4 h-14 border-b border-outline-variant">
            <Search size={18} aria-hidden="true" className="text-outline shrink-0" />
            <span className="sr-only">Search pages and claims</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Type a page, a word from a claim, or #16"
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-outline"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={items[active] ? `palette-${items[active].key}` : undefined}
            />
            <span className="kbd text-outline">Esc</span>
          </label>
          <ul id="palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto py-2">
            {items.length === 0 && (
              <li className="px-4 py-6 text-[14px] text-on-surface-variant">
                Nothing matches “{query}”. Try fewer words, or a claim number like #16.
              </li>
            )}
            {items.map((it, i) => (
              <li
                key={it.key}
                id={`palette-${it.key}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(it)}
                className={`mx-2 px-3 py-2 rounded-[6px] flex items-center gap-3 cursor-pointer ${i === active ? "bg-surface-container" : ""}`}
              >
                {it.kind === "page" ? (
                  <span className="text-[14px] font-semibold flex-1">{it.label}</span>
                ) : (
                  <>
                    <span className="font-mono text-[12.5px] text-outline tnum w-9 shrink-0">#{it.claim.id}</span>
                    <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS[it.claim.status]?.dot || "bg-outline"}`} />
                    <span className="text-[13.5px] flex-1 line-clamp-1">{it.label}</span>
                  </>
                )}
                {i === active && <CornerDownLeft size={14} aria-hidden="true" className="text-outline shrink-0" />}
              </li>
            ))}
          </ul>
          {error && <p className="px-4 pb-3 text-[12.5px] text-error">{error}</p>}
        </div>
      )}
    </dialog>
  );
}
