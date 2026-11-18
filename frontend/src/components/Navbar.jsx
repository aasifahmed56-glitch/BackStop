import React from "react";
import { RotateCcw, Keyboard, Search } from "lucide-react";
import { consignmentNo } from "./ui";

export const ROLES = [
  { id: "incoming_dev", label: "New developer", access: "Team level", desc: "Owners, decisions, risks, dependencies and contacts." },
  { id: "incoming_pm", label: "New project manager", access: "Team level", desc: "Owners, open questions, blockers, risks and next actions." },
  { id: "lead", label: "Lead", access: "Restricted level", desc: "Reviews claims and sees restricted notes." },
];

export const NAV_ITEMS = [
  { id: "overview", n: 1, label: "Overview" },
  { id: "review", n: 2, label: "Check the claims", short: "Check" },
  { id: "debrief", n: 3, label: "Debrief questions", short: "Debrief" },
  { id: "handover", n: 4, label: "Handover" },
  { id: "backtest", n: 5, label: "Backtest" },
  { id: "trust", n: 6, label: "Trust report", short: "Trust" },
];

/* A specimen sheet: board, one pressed stem, the collection label in the corner. */
export function Mark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
      <rect x="2" y="1" width="22" height="24" rx="2.5" fill="var(--color-surface-container-lowest)" />
      <path d="M9 19.5c0-5 1.6-9.5 5.5-13" fill="none" stroke="var(--color-tertiary)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.2 13.6c-2.6-.4-3.9-2-4-4.3 2.4.1 3.8 1.6 4 4.3zM12.2 9.6c.2-2.5 1.8-3.9 4.2-4.1-.1 2.4-1.6 3.9-4.2 4.1z" fill="var(--color-tertiary)" />
      <rect x="14.5" y="18" width="7" height="4.5" rx="0.8" fill="var(--color-stamp)" />
    </svg>
  );
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function NavLink({ item, active, progress, onNavigate, compact = false }) {
  return (
    <a
      href={`#/${item.id}`}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item.id);
      }}
      className={
        compact
          ? `relative shrink-0 flex items-center gap-1.5 px-3 h-10 text-[13px] font-semibold whitespace-nowrap ${
              active ? "text-on-ink" : "text-on-ink-muted"
            }`
          : `group flex items-center gap-3 px-3 h-10 rounded-[6px] text-[14px] font-medium transition-colors ${
              active ? "bg-ink-2 text-on-ink" : "text-on-ink-muted hover:text-on-ink hover:bg-ink-2/60"
            }`
      }
    >
      <span className={`font-mono tnum text-[12px] w-4 text-right ${active ? "text-canary" : "text-on-ink-muted/80"}`}>{item.n}</span>
      <span className="flex-1 truncate">{compact ? item.short || item.label : item.label}</span>
      {!compact && item.id === "review" && progress && progress.total > 0 && (
        <span className="font-mono tnum text-[11.5px] text-on-ink-muted">
          {progress.done}/{progress.total}
        </span>
      )}
      {compact && active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-canary" />}
    </a>
  );
}

export default function Navbar({ activeTab, onNavigate, onResetSample, isResetting, project, progress, onShowShortcuts, onOpenPalette }) {
  const leaves = fmtDate(project?.departure_date);
  return (
    <>
      {/* Desktop: the green rail */}
      <aside className="no-print hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col bg-ink text-on-ink z-40">
        <a
          href="#/overview"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("overview");
          }}
          className="flex items-center gap-2.5 px-5 h-16 shrink-0"
        >
          <Mark />
          <span className="text-[18px] font-bold tracking-[-0.01em]">Backstop</span>
        </a>

        <div className="mx-5 pb-4 mb-3 border-b border-ink-line">
          <p className="text-[14px] font-semibold leading-5 truncate">{project?.name || "Campus Event App"}</p>
          <p className="text-[12.5px] text-on-ink-muted leading-5">
            {project?.leaver_name || "Riya"} {leaves ? `leaves ${leaves}` : "is leaving"}
          </p>
          <p className="font-mono text-[11.5px] text-on-ink-muted/90 mt-1">Acc. no. {consignmentNo(project?.id)}</p>
        </div>

        <button
          type="button"
          onClick={onOpenPalette}
          className="mx-3 mb-3 flex items-center gap-2 h-9 px-3 rounded-[6px] bg-ink-2/70 hover:bg-ink-2 text-[13px] text-on-ink-muted hover:text-on-ink cursor-pointer"
        >
          <Search size={15} aria-hidden="true" />
          <span className="flex-1 text-left">Jump to…</span>
          <span className="kbd border-on-ink-muted/60">⌘K</span>
        </button>

        <nav aria-label="Steps" className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.id} item={item} active={activeTab === item.id} progress={progress} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="mt-auto px-3 pb-4 flex flex-col gap-1">
          <button
            type="button"
            onClick={onShowShortcuts}
            className="flex items-center gap-2.5 h-9 px-3 rounded-[6px] text-[13px] text-on-ink-muted hover:text-on-ink hover:bg-ink-2/60 cursor-pointer"
          >
            <Keyboard size={16} aria-hidden="true" />
            Keyboard shortcuts
          </button>
          <button
            type="button"
            onClick={onResetSample}
            disabled={isResetting}
            className="flex items-center gap-2.5 h-9 px-3 rounded-[6px] text-[13px] text-on-ink-muted hover:text-on-ink hover:bg-ink-2/60 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            title="Reload the sample project and clear review decisions"
          >
            <RotateCcw size={16} aria-hidden="true" className={isResetting ? "animate-spin [animation-direction:reverse]" : ""} />
            {isResetting ? "Resetting…" : "Reset sample"}
          </button>
          <p className="px-3 pt-3 mt-1 border-t border-ink-line text-[11.5px] leading-4 text-on-ink-muted">
            Synthetic sample data. Roles are simulated; there is no sign-in. A person approves every claim.
          </p>
        </div>
      </aside>

      {/* Mobile and tablet: a top bar with scrolling steps */}
      <header className="no-print lg:hidden sticky top-0 z-40 bg-ink text-on-ink">
        <div className="h-14 px-4 flex items-center gap-3">
          <a
            href="#/overview"
            onClick={(e) => {
              e.preventDefault();
              onNavigate("overview");
            }}
            className="flex items-center gap-2 shrink-0"
          >
            <Mark size={24} />
            <span className="text-[17px] font-bold">Backstop</span>
          </a>
          <span className="truncate text-[12.5px] text-on-ink-muted min-w-0">
            {project?.name || "Campus Event App"} · {project?.leaver_name || "Riya"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenPalette}
              aria-label="Jump to a page or claim"
              className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] text-on-ink-muted hover:text-on-ink hover:bg-ink-2 cursor-pointer"
            >
              <Search size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onResetSample}
              disabled={isResetting}
              aria-label="Reset sample"
              title="Reload the sample project and clear review decisions"
              className="inline-flex items-center justify-center w-9 h-9 rounded-[6px] text-on-ink-muted hover:text-on-ink hover:bg-ink-2 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={17} aria-hidden="true" className={isResetting ? "animate-spin [animation-direction:reverse]" : ""} />
            </button>
          </div>
        </div>
        <nav aria-label="Steps" className="flex overflow-x-auto border-t border-ink-line [scrollbar-width:none]">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.id} item={item} active={activeTab === item.id} onNavigate={onNavigate} compact />
          ))}
        </nav>
      </header>
    </>
  );
}
