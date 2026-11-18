import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Keyboard, LogOut, MoreHorizontal, Plus, RotateCcw, Search, Users } from "lucide-react";
import { api, canReview, getCurrentUser } from "../api";
import { signOut } from "./AuthGate";
import { consignmentNo } from "./ui";

export const ROLES = [
  { id: "incoming_dev", label: "New developer", access: "Team level", desc: "Owners, decisions, risks, dependencies and contacts." },
  { id: "incoming_pm", label: "New project manager", access: "Team level", desc: "Owners, open questions, blockers, risks and next actions." },
  { id: "lead", label: "Lead", access: "Restricted level", desc: "Reviews claims and sees restricted notes." },
];

export const NAV_ITEMS = [
  { id: "overview", n: 1, label: "Overview" },
  { id: "records", n: 2, label: "Records" },
  { id: "review", n: 3, label: "Check", long: "Check the claims" },
  { id: "debrief", n: 4, label: "Debrief", long: "Debrief questions" },
  { id: "handover", n: 5, label: "Handover" },
  { id: "backtest", n: 6, label: "Backtest" },
  { id: "trust", n: 7, label: "Trust" , long: "Trust report" },
];

/* A specimen sheet: board, one pressed stem, the collection label in the corner. */
export function Mark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
      <rect x="2" y="1" width="22" height="24" rx="2.5" fill="var(--color-ink)" />
      <path d="M9 19.5c0-5 1.6-9.5 5.5-13" fill="none" stroke="#f1f2f1" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10.2 13.6c-2.6-.4-3.9-2-4-4.3 2.4.1 3.8 1.6 4 4.3zM12.2 9.6c.2-2.5 1.8-3.9 4.2-4.1-.1 2.4-1.6 3.9-4.2 4.1z" fill="#f1f2f1" />
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

/* Close a popover on outside click or Esc, and hand focus back to its button. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => wrap.current && !wrap.current.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, wrap, btn };
}

const menuPanel =
  "pop-in absolute z-50 mt-2 rounded-[10px] border border-outline-variant bg-surface-container-lowest shadow-[0_18px_44px_-18px_rgb(29_32_31/0.45)] py-1.5";

function ProjectSwitcher({ project, projectId, onSwitchProject, onNavigate, dataVersion }) {
  const { open, setOpen, wrap, btn } = usePopover();
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    api
      .listProjects()
      .then((p) => live && setList(Array.isArray(p) ? p : []))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [open, dataVersion]);
  const leaves = fmtDate(project?.departure_date);
  return (
    <div ref={wrap} className="relative min-w-0">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-8 max-w-[15rem] pl-2.5 pr-2 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest hover:border-outline text-[13px] cursor-pointer min-w-0"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-stamp shrink-0" aria-hidden="true" />
        <span className="font-semibold truncate">{project?.name || "Loading…"}</span>
        <ChevronDown size={14} aria-hidden="true" className={`text-outline shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        <span className="sr-only">, switch project</span>
      </button>
      {open && (
        <div role="menu" aria-label="Projects" className={`${menuPanel} left-0 w-[19rem]`}>
          <p className="px-3.5 pt-1.5 pb-2 text-[12px] text-on-surface-variant border-b border-outline-variant mb-1">
            {project?.leaver_name} {leaves ? `leaves ${leaves}` : ""} · <span className="font-mono">{consignmentNo(project?.id)}</span>
          </p>
          {!list && <p className="px-3.5 py-2 text-[13px] text-on-surface-variant">Loading projects…</p>}
          <div className="max-h-[50vh] overflow-y-auto">
            {list?.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (p.id !== projectId) onSwitchProject(p.id, p.claim_count ? "overview" : "records");
                }}
                className="w-full px-3.5 py-2 flex items-center gap-3 text-left hover:bg-surface-container cursor-pointer"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold truncate">{p.name}</span>
                  <span className="block text-[12px] text-on-surface-variant truncate">
                    {p.leaver_name} · {p.claim_count} claims{p.is_sample ? " · sample" : ""}
                  </span>
                </span>
                {p.id === projectId && <Check size={15} aria-label="Open now" className="text-stamp shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-outline-variant mt-1 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                window.location.hash = "#/projects/new";
              }}
              className="w-full px-3.5 py-2 flex items-center gap-2 text-[13.5px] font-semibold text-primary hover:bg-surface-container cursor-pointer"
            >
              <Plus size={15} aria-hidden="true" /> New project
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate("projects");
              }}
              className="w-full px-3.5 py-2 text-left text-[13.5px] text-on-surface-variant hover:bg-surface-container hover:text-on-surface cursor-pointer"
            >
              All projects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MoreMenu({ isSample, onResetSample, isResetting, onShowShortcuts }) {
  const account = getCurrentUser();
  const { open, setOpen, wrap, btn } = usePopover();
  const item = "w-full px-3.5 py-2 flex items-center gap-2.5 text-[13.5px] text-left hover:bg-surface-container cursor-pointer disabled:opacity-50";
  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className={`${menuPanel} right-0 w-64`}>
          <button type="button" role="menuitem" className={item} onClick={() => (setOpen(false), onShowShortcuts())}>
            <Keyboard size={15} aria-hidden="true" className="text-outline" /> Keyboard shortcuts
          </button>
          {isSample && canReview() && (
            <button type="button" role="menuitem" className={item} disabled={isResetting} onClick={() => (setOpen(false), onResetSample())}>
              <RotateCcw size={15} aria-hidden="true" className="text-outline" /> {isResetting ? "Resetting…" : "Reset sample"}
            </button>
          )}
          {account?.is_admin && (
            <button type="button" role="menuitem" className={item} onClick={() => (setOpen(false), (window.location.hash = "#/accounts"))}>
              <Users size={15} aria-hidden="true" className="text-outline" /> Manage accounts
            </button>
          )}
          <button type="button" role="menuitem" className={item} onClick={() => (setOpen(false), signOut())}>
            <LogOut size={15} aria-hidden="true" className="text-outline" /> Sign out
          </button>
          <p className="px-3.5 pt-2.5 pb-1.5 mt-1 border-t border-outline-variant text-[12px] leading-[17px] text-on-surface-variant">
            {account && <>Signed in as <strong className="text-on-surface">{account.display_name}</strong> ({account.role.replace("_", " ")}). </>}
            {isSample ? "Synthetic sample data. " : ""}A person approves every claim.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Navbar({
  activeTab,
  onNavigate,
  onResetSample,
  isResetting,
  project,
  projectId,
  onSwitchProject,
  dataVersion,
  progress,
  onShowShortcuts,
  onOpenPalette,
}) {
  const isSample = !project || project.name === "Campus Event App";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A single pill slides under the active step.
  const navRef = useRef(null);
  const [pill, setPill] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = navRef.current?.querySelector('[aria-current="page"]');
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTab]);

  return (
    <header
      className={`no-print sticky top-0 z-40 bg-background/85 backdrop-blur-md backdrop-saturate-150 border-b transition-[border-color,box-shadow] duration-300 ${
        scrolled ? "border-outline-variant shadow-[0_8px_24px_-20px_rgb(29_32_31/0.5)]" : "border-transparent"
      }`}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 h-14 flex items-center gap-3">
        <a
          href="#/overview"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("overview");
          }}
          className="flex items-center gap-2 shrink-0 rounded-[6px]"
          aria-label="Backstop, overview"
        >
          <Mark size={24} />
          <span className="hidden sm:inline text-[16px] font-bold tracking-[-0.01em]">Backstop</span>
        </a>
        <span aria-hidden="true" className="hidden sm:block w-px h-5 bg-outline-variant" />
        <ProjectSwitcher project={project} projectId={projectId} onSwitchProject={onSwitchProject} onNavigate={onNavigate} dataVersion={dataVersion} />

        {/* Desktop steps */}
        <nav ref={navRef} aria-label="Steps" className="relative hidden lg:flex items-center gap-0.5 ml-3">
          {pill && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 -translate-y-1/2 h-8 rounded-full bg-surface-container-high transition-[left,width] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{ left: pill.left, width: pill.width }}
            />
          )}
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={`#/${item.id}`}
                title={item.long || item.label}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.id);
                }}
                className={`relative h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-[13.5px] font-medium transition-colors ${
                  active ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {item.label}
                {item.id === "review" && progress && progress.total > 0 && (
                  <span className="font-mono tnum text-[11px] text-outline">
                    {progress.done}/{progress.total}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenPalette}
            className="h-8 pl-2.5 pr-1.5 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest hover:border-outline text-[13px] text-on-surface-variant hover:text-on-surface cursor-pointer"
            aria-label="Search pages and claims"
          >
            <Search size={14} aria-hidden="true" />
            <span className="hidden md:inline">Search</span>
            <span className="kbd hidden md:inline-flex">⌘K</span>
          </button>
          <MoreMenu isSample={isSample} onResetSample={onResetSample} isResetting={isResetting} onShowShortcuts={onShowShortcuts} />
        </div>
      </div>

      {/* Phones and tablets: the steps scroll under the bar */}
      <nav aria-label="Steps" className="lg:hidden flex overflow-x-auto px-2 sm:px-6 pb-1.5 gap-0.5 [scrollbar-width:none]">
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
              className={`shrink-0 h-8 px-3 inline-flex items-center rounded-full text-[13px] font-medium whitespace-nowrap ${
                active ? "bg-on-surface text-surface-container-lowest" : "text-on-surface-variant"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
