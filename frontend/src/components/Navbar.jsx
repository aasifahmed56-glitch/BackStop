import React from "react";
import { RotateCcw, Keyboard } from "lucide-react";
import { consignmentNo } from "./ui";

export const ROLES = [
  { id: "incoming_dev", label: "New developer", access: "Team level", desc: "Owners, decisions, risks, dependencies and contacts." },
  { id: "incoming_pm", label: "New project manager", access: "Team level", desc: "Owners, open questions, blockers, risks and next actions." },
  { id: "lead", label: "Lead", access: "Restricted level", desc: "Reviews claims and sees restricted notes." },
];

export const NAV_ITEMS = [
  { id: "overview", n: 1, label: "Overview" },
  { id: "review", n: 2, label: "Check the claims" },
  { id: "handover", n: 3, label: "Handover" },
  { id: "backtest", n: 4, label: "Backtest" },
  { id: "trust", n: 5, label: "Trust report" },
];

function Mark() {
  // Two nested boxes: a consignment inside its record.
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="24" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="6.5" y="6.5" width="13" height="13" rx="1" fill="var(--color-canary)" />
      <path d="M9.5 13.2l2.4 2.4 4.6-5" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Navbar({ activeTab, onNavigate, onResetSample, isResetting, project, progress, onShowShortcuts }) {
  return (
    <header className="sticky top-0 z-40 bg-ink text-on-ink no-print">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        <a
          href="#/overview"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("overview");
          }}
          className="flex items-center gap-2.5 shrink-0 rounded-[2px]"
        >
          <Mark />
          <span className="text-[17px] font-extrabold tracking-[-0.01em]">Backstop</span>
        </a>

        <div className="hidden lg:flex flex-col leading-tight pl-4 border-l border-ink-line min-w-0">
          <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-on-ink-muted">Consignment <span className="font-mono normal-case tracking-normal text-canary">No. {consignmentNo(project?.id)}</span></span>
          <span className="text-[13px] font-semibold truncate">
            {project?.name || "Campus Event App"}
            <span className="text-on-ink-muted font-normal"> · from {project?.leaver_name || "Riya"}</span>
          </span>
        </div>

        <nav aria-label="Steps" className="hidden md:flex items-stretch h-full ml-auto">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={`#/${item.id}`}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.id);
                }}
                className={`relative flex items-center gap-2 px-3.5 text-[13.5px] font-semibold transition-colors ${
                  active ? "text-on-ink" : "text-on-ink-muted hover:text-on-ink"
                }`}
              >
                <span
                  className={`tnum inline-flex items-center justify-center w-5 h-5 rounded-[2px] text-[11px] font-bold ${
                    active ? "bg-canary text-on-canary" : "border border-ink-line"
                  }`}
                >
                  {item.n}
                </span>
                {item.label}
                {item.id === "review" && progress && progress.total > 0 && (
                  <span className="tnum text-[11px] font-semibold text-on-ink-muted">
                    {progress.done}/{progress.total}
                  </span>
                )}
                {active && <span aria-hidden="true" className="absolute left-3 right-3 bottom-0 h-[3px] bg-canary" />}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 ml-auto md:ml-2">
          <button
            type="button"
            onClick={onShowShortcuts}
            className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-[3px] text-on-ink-muted hover:text-on-ink hover:bg-ink-2 cursor-pointer"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onResetSample}
            disabled={isResetting}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-[3px] border border-ink-line text-[13px] font-semibold text-on-ink hover:bg-ink-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            title="Reload the sample project and clear review decisions"
          >
            <RotateCcw size={15} aria-hidden="true" className={isResetting ? "animate-spin [animation-direction:reverse]" : ""} />
            <span className="hidden sm:inline">{isResetting ? "Resetting…" : "Reset sample"}</span>
          </button>
        </div>
      </div>

      {/* Mobile step bar */}
      <nav aria-label="Steps" className="md:hidden flex border-t border-ink-line">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <a
              key={item.id}
              href={`#/${item.id}`}
              aria-current={active ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.id);
              }}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[11.5px] font-semibold ${
                active ? "text-on-ink" : "text-on-ink-muted"
              }`}
            >
              <span className={`tnum inline-flex items-center justify-center w-5 h-5 rounded-[2px] text-[11px] font-bold ${active ? "bg-canary text-on-canary" : "border border-ink-line"}`}>
                {item.n}
              </span>
              <span className="truncate max-w-full px-1">{item.id === "review" ? "Check" : item.label}</span>
              {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[3px] bg-canary" />}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
