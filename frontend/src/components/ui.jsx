import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

/* Shared vocabulary for every screen: the herbarium sheet.
   Status = what the automated checks found (leaf, ochre, rust, graphite).
   Review = what a person decided (violet stamp). */

export const STATUS = {
  verified: {
    label: "Quote matched",
    short: "Matched",
    help: "The quote exists word for word in the source and supports the claim, or code calculated it.",
    chip: "bg-tertiary-fixed text-on-tertiary-fixed",
    dot: "bg-tertiary",
  },
  inferred: {
    label: "Inferred",
    short: "Inferred",
    help: "The quote exists but only partly supports the claim. Read it before approving.",
    chip: "bg-goldenrod-container text-on-goldenrod",
    dot: "bg-goldenrod",
  },
  conflicting: {
    label: "Conflicting",
    short: "Conflict",
    help: "Two sources disagree. Decide which one is current before approving.",
    chip: "bg-error-container text-on-error-container",
    dot: "bg-error",
  },
  missing: {
    label: "Missing evidence",
    short: "Missing",
    help: "The records do not say who owns this or why. Ask the person leaving.",
    chip: "bg-surface-container-high text-on-surface",
    dot: "bg-outline",
  },
  withheld: {
    label: "Withheld",
    short: "Withheld",
    help: "The source needs higher access than this view has, so its text and check result are hidden.",
    chip: "bg-surface-container text-on-surface-variant",
    dot: "bg-outline-variant",
  },
};

export const REVIEW = {
  pending: { label: "Not checked", text: "text-on-surface-variant", tick: "bg-surface-container-highest" },
  approved: { label: "Approved", text: "text-stamp", tick: "bg-stamp" },
  corrected: { label: "Corrected", text: "text-stamp", tick: "bg-stamp/55" },
  rejected: { label: "Rejected", text: "text-error", tick: "bg-error" },
};

// Accession number for the collection, derived from the project id.
export const consignmentNo = (id) => `BS-${String(id || 1).padStart(4, "0")}`;

export const humanize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ") : "");

export function StatusChip({ status, size = "md" }) {
  const s = STATUS[status] || STATUS.withheld;
  return (
    <span
      title={s.help}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${s.chip} ${
        size === "sm" ? "px-2 py-px text-[11.5px] leading-4" : "px-2.5 py-0.5 text-[12.5px] leading-[18px]"
      }`}
    >
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* A label field: a hairline above, a quiet label, the content beneath. No box. */
export function Field({ label, aside, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`border-t border-outline-variant ${className}`}>
      <div className="flex items-center justify-between gap-2 pt-2.5">
        <h3 className="field-label">{label}</h3>
        {aside}
      </div>
      <div className={`pb-3 pt-1.5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* Determination slip: one per human decision, stamped violet. */
export function Slip({ who, when, what, note, className = "" }) {
  return (
    <div className={`slip stamp-in w-fit max-w-full sm:max-w-[30rem] px-3 py-2 text-[12.5px] leading-[18px] ${className}`}>
      <p className="font-mono">
        <span className="font-bold">det.</span> {who}
        {when ? <span className="opacity-75"> · {when}</span> : null}
      </p>
      <p className="font-semibold text-[13px]">{what}</p>
      {note ? <p className="opacity-80 line-clamp-2">{note}</p> : null}
    </div>
  );
}

const BTN = {
  primary: "bg-primary text-on-primary hover:bg-primary-container border border-primary",
  stamp: "bg-stamp text-white hover:bg-stamp-2 border border-stamp",
  ink: "bg-secondary text-on-secondary hover:bg-secondary-container border border-secondary",
  outline: "bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-outline hover:bg-surface-container-low",
  danger: "bg-surface-container-lowest text-error border border-outline-variant hover:border-error hover:bg-error-container",
  ghost: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-transparent",
};

export function Button({ variant = "outline", size = "md", className = "", children, ...props }) {
  const sz = size === "sm" ? "h-8 px-2.5 text-[13px] gap-1.5" : size === "lg" ? "h-11 px-5 text-[15px] gap-2" : "h-9 px-3.5 text-[14px] gap-2";
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-[6px] font-semibold transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${sz} ${BTN[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* Native <dialog>: real focus trap, Esc to close, top layer (never clipped). */
export function Dialog({ open, onClose, title, description, children, footer, width = "max-w-md" }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal focuses the first focusable (the close button); start in the first field instead.
      requestAnimationFrame(() => d.querySelector("textarea, input, select")?.focus());
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.();
      }}
      className={`sheet m-auto w-[calc(100vw-2rem)] ${width} p-0 rounded-[10px] border border-outline-variant bg-surface-container-lowest text-on-surface shadow-[0_24px_60px_-20px_rgb(23_41_31/0.45)]`}
      aria-labelledby="dialog-title"
    >
      {open && (
        <div className="flex flex-col">
          <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-outline-variant">
            <div>
              <h2 id="dialog-title" className="text-[17px] leading-6 font-bold">{title}</h2>
              {description && <p className="text-[13px] leading-5 text-on-surface-variant mt-0.5">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1 -m-1 rounded-[2px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer">
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="px-5 py-4 flex flex-col gap-4">{children}</div>
          {footer && <footer className="px-5 py-3 border-t border-outline-variant bg-surface-container-low flex justify-end gap-2">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function TextArea({ id, label, hint, ...props }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <textarea
        id={id}
        className="w-full min-h-24 p-2.5 rounded-[6px] border border-outline-variant bg-surface-container-lowest text-[14px] leading-[22px] text-on-surface placeholder:text-outline focus:outline-2 focus:outline-stamp focus:border-stamp"
        {...props}
      />
      {hint && <span className="text-[12px] text-on-surface-variant">{hint}</span>}
    </label>
  );
}

export function TextInput({ id, label, hint, ...props }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <input
        id={id}
        type="text"
        className="w-full h-10 px-2.5 rounded-[6px] border border-outline-variant bg-surface-container-lowest text-[14px] text-on-surface placeholder:text-outline focus:outline-2 focus:outline-stamp focus:border-stamp"
        {...props}
      />
      {hint && <span className="text-[12px] text-on-surface-variant">{hint}</span>}
    </label>
  );
}

/* Signature move: one tick per claim, coloured by what a person decided.
   Unchecked ticks show what the checks found (conflict / missing) as a notch. */
export function TallyStrip({ claims, selectedId, onSelect, className = "" }) {
  if (!claims?.length) return null;
  const counts = claims.reduce((acc, c) => {
    acc[c.review_state] = (acc[c.review_state] || 0) + 1;
    return acc;
  }, {});
  const done = (counts.approved || 0) + (counts.corrected || 0) + (counts.rejected || 0);
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-[13px] text-on-surface-variant">
          <span className="font-bold text-on-surface tnum">{done}</span> of <span className="tnum">{claims.length}</span> claims determined
        </p>
        <ul className="flex items-center gap-3 text-[12px] text-on-surface-variant flex-wrap" aria-label="Legend">
          {["approved", "corrected", "rejected", "pending"].map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`w-2 h-3 rounded-[1px] ${REVIEW[k].tick}`} />
              {REVIEW[k].label} <span className="tnum font-semibold text-on-surface">{counts[k] || 0}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-px sm:gap-[2px] h-6 items-stretch" aria-hidden="true">
        {claims.map((c) => {
          const sel = c.id === selectedId;
          const flag = c.review_state === "pending" && (c.status === "conflicting" || c.status === "missing" || c.status === "inferred");
          return (
            <button
              key={c.id}
              type="button"
              tabIndex={-1}
              title={`Claim ${c.id}: ${REVIEW[c.review_state]?.label || c.review_state} · ${STATUS[c.status]?.label || c.status}`}
              onClick={() => onSelect?.(c)}
              className={`relative flex-1 min-w-0 rounded-[1px] cursor-pointer transition-[transform,background-color] duration-300 hover:scale-y-110 ${
                REVIEW[c.review_state]?.tick || "bg-surface-container-highest"
              } ${sel ? "outline-2 outline-offset-1 outline-on-surface !bg-on-surface" : ""}`}
            >
              {flag && <span className={`absolute inset-x-0 top-0 h-1.5 rounded-t-[1px] ${STATUS[c.status].dot}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-[2px] bg-surface-container ${className}`} />;
}
