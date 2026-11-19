import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronsDownUp, Flag, Pause, Play, RotateCcw } from "lucide-react";
import { api, formatErrorMessage } from "../api";
import { Button, Skeleton, humanize } from "./ui";

/* Repository map: the imported git history drawn as a branching specimen.
   Stem = folder, bud = file. Bud size is how often it was edited, its fill is
   the chosen measure, and the small marks after a name are tripwires (diamond)
   and claims (square). Replay grows the tree commit by commit. */

const ROW = 30;
// Column width and left margin; phones get a tighter stem so two levels fit on screen.
const GEOMETRY = { wide: { col: 176, padL: 168 }, narrow: { col: 124, padL: 118 } };
const PAD_Y = 26;
const CH = 7.2; // Courier Prime advance at 12px
const MOTION_MS = 520;
const AUTHOR_COLORS = ["#a3392b", "#2f6b3f", "#4f6d8a", "#93641a", "#7a5c48", "#3f7f86", "#6d6a3a", "#5d5f74"];
const OTHER_COLOR = "#a9aeab";
const MODES = [
  ["share", "Leaver's share"],
  ["edits", "Edits"],
  ["author", "Top author"],
];

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ease = (t) => 1 - Math.pow(1 - t, 4);
const authorColor = (i) => (i < AUTHOR_COLORS.length ? AUTHOR_COLORS[i] : OTHER_COLOR);
const clip = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s);
const pct = (x) => `${Math.round(x * 100)}%`;
const addDays = (iso, d) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
const fmtDate = (iso) =>
  iso ? new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "";

function repoName(sources) {
  if (!sources?.length) return "repository";
  if (sources.length > 1) return `${sources.length} histories`;
  return sources[0].replace(/^github\//, "").replace(/\.(txt|log)$/, "");
}

/* ---------- tree building ---------- */

function buildTree(map, showDeleted) {
  const root = { id: "/", name: repoName(map.sources), dir: true, module: "root", children: [], parent: null, tw: [], claims: [] };
  const dirs = new Map([["", root]]);
  const filesById = new Map();
  map.files.forEach((f, i) => {
    if (f.deleted && !showDeleted) return;
    const parts = f.path.split("/");
    let parent = root;
    let acc = "";
    for (let d = 0; d < parts.length - 1; d++) {
      acc = acc ? `${acc}/${parts[d]}` : parts[d];
      let n = dirs.get(acc);
      if (!n) {
        n = { id: acc + "/", name: parts[d], dir: true, module: parts[0], children: [], parent, tw: [], claims: [] };
        parent.children.push(n);
        dirs.set(acc, n);
      }
      parent = n;
    }
    const leaf = { id: f.path, name: parts[parts.length - 1], dir: false, module: parts.length > 1 ? parts[0] : "root", fileIdx: i, file: f, children: [], parent, tw: [], claims: [] };
    parent.children.push(leaf);
    filesById.set(f.path, leaf);
  });

  // Flags, before folder chains are merged.
  const modNode = (m) => (m === "root" ? root : dirs.get(m));
  for (const t of map.tripwires) {
    const hit = new Set();
    for (const p of t.files) {
      const n = filesById.get(p);
      if (n && !hit.has(n)) {
        hit.add(n);
        n.tw.push(t);
      }
    }
    if (!hit.size) {
      for (const m of t.modules) {
        const n = modNode(m);
        if (n && !hit.has(n)) {
          hit.add(n);
          n.tw.push(t);
        }
      }
    }
  }
  for (const c of map.claims) {
    for (const m of c.modules) modNode(m)?.claims.push(c);
  }
  for (const [m, info] of Object.entries(map.modules || {})) {
    const n = modNode(m);
    if (n) n.risk = info;
  }

  // Merge single-folder chains: src/main/java reads as one stem.
  const compress = (n) => {
    for (const c of n.children) {
      while (c.dir && c.children.length === 1 && c.children[0].dir) {
        const g = c.children[0];
        c.name = `${c.name}/${g.name}`;
        c.id = g.id;
        c.children = g.children;
        c.tw = c.tw.concat(g.tw);
        c.claims = c.claims.concat(g.claims);
        c.children.forEach((k) => (k.parent = c));
      }
      compress(c);
    }
  };
  compress(root);

  // Aggregate and sort.
  const agg = (n, depth) => {
    n.depth = depth;
    if (!n.dir) {
      const f = n.file;
      Object.assign(n, { files: [n.fileIdx], edits: f.edits, leaverEdits: f.leaver_edits, authors: new Map(f.authors), fixes: f.fixes, reverts: f.reverts, last: f.last, first: f.first });
    } else {
      n.children.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
      Object.assign(n, { files: [], edits: 0, leaverEdits: 0, authors: new Map(), fixes: 0, reverts: 0, last: "", first: "9999" });
      for (const c of n.children) {
        agg(c, depth + 1);
        n.files.push(...c.files);
        n.edits += c.edits;
        n.leaverEdits += c.leaverEdits;
        n.fixes += c.fixes;
        n.reverts += c.reverts;
        if (c.last > n.last) n.last = c.last;
        if (c.first < n.first) n.first = c.first;
        for (const [a, k] of c.authors) n.authors.set(a, (n.authors.get(a) || 0) + k);
      }
    }
    n.topAuthor = [...n.authors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
    // Flags on this node, and on this node plus everything under it.
    const isApproved = (c) => c.review_state === "approved" || c.review_state === "corrected";
    const allTw = new Map(n.tw.map((t) => [t.id, t]));
    for (const c of n.children) for (const t of c.allTw) allTw.set(t.id, t);
    n.allTw = [...allTw.values()].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
    n.own = {
      high: n.tw.filter((t) => t.severity === "high").length,
      medium: n.tw.filter((t) => t.severity !== "high").length,
      claims: n.claims.length,
      approved: n.claims.filter(isApproved).length,
    };
    n.desc = {
      high: n.allTw.filter((t) => t.severity === "high").length,
      medium: n.allTw.filter((t) => t.severity !== "high").length,
      claims: n.claims.length + n.children.reduce((s, c) => s + c.desc.claims, 0),
      approved: n.own.approved + n.children.reduce((s, c) => s + c.desc.approved, 0),
    };
    n.flagged = n.desc.high + n.desc.medium + n.desc.claims > 0;
  };
  agg(root, 0);

  const all = new Map();
  const walk = (n) => {
    all.set(n.id, n);
    n.children.forEach(walk);
  };
  walk(root);
  return { root, all };
}

// Open the busiest folders first while the drawing stays readable; a folder with
// a long flat list of files stays closed until someone asks for it.
function defaultExpanded(root, budget = 36, wide = 14) {
  const open = new Set([root.id]);
  let visible = 1 + root.children.length;
  const queue = [...root.children].filter((c) => c.dir).sort((a, b) => b.edits - a.edits);
  while (queue.length) {
    const n = queue.shift();
    if (n.children.length > wide || visible + n.children.length > budget) continue;
    open.add(n.id);
    visible += n.children.length;
    queue.push(...n.children.filter((c) => c.dir).sort((a, b) => b.edits - a.edits));
  }
  return open;
}

function layoutTree(root, expanded, { col: COL, padL: PAD_L }) {
  const pos = new Map();
  const order = [];
  let row = 0;
  let maxRight = 0;
  const place = (n) => {
    const x = PAD_L + n.depth * COL;
    let y;
    const open = n.dir && expanded.has(n.id) && n.children.length;
    if (!open) {
      y = PAD_Y + row++ * ROW;
    } else {
      const kids = n.children.map(place);
      y = (kids[0] + kids[kids.length - 1]) / 2;
    }
    pos.set(n.id, { x, y, node: n, open: !!open });
    order.push(n);
    if (!open) maxRight = Math.max(maxRight, x + 24 + (n.name.length + 8) * CH + 90);
    return y;
  };
  place(root);
  order.sort((a, b) => pos.get(a.id).y - pos.get(b.id).y || a.depth - b.depth);
  return { pos, order, width: Math.max(maxRight, PAD_L + 300), height: PAD_Y * 2 + Math.max(0, row - 1) * ROW };
}

/* ---------- small marks ---------- */

function marksFor(n, open) {
  const f = open ? n.own : n.desc;
  const out = [];
  if (f.high) out.push({ kind: "high", count: f.high });
  if (f.medium) out.push({ kind: "medium", count: f.medium });
  if (f.claims) out.push({ kind: f.approved ? "approved" : "claim", count: f.claims });
  return out;
}
const markWidth = (m) => 12 + String(m.count).length * CH + 8;

function Marks({ marks, x, y }) {
  const starts = marks.map((_, i) => x + marks.slice(0, i).reduce((s, m) => s + markWidth(m), 0));
  return (
    <g aria-hidden="true">
      {marks.map((m, i) => {
        const at = starts[i];
        const color = m.kind === "high" ? "var(--color-error)" : m.kind === "medium" ? "var(--color-goldenrod)" : "var(--color-stamp)";
        return (
          <g key={m.kind} transform={`translate(${at},${y})`}>
            {m.kind === "high" || m.kind === "medium" ? (
              <path d="M4.5 -4.5 L9 0 L4.5 4.5 L0 0 Z" fill={color} />
            ) : (
              <rect x="0.5" y="-4" width="8" height="8" rx="1.5" fill={m.kind === "approved" ? color : "var(--color-surface-container-lowest)"} stroke={color} strokeWidth="1.25" />
            )}
            <text x="12" y="4" className="rm-mark-count" fill={color}>
              {m.count}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- component ---------- */

export default function RepoMap({ projectId, refreshKey = 0, grow = false, setActiveTab }) {
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("share");
  const [showDeleted, setShowDeleted] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState("/");
  const [hover, setHover] = useState(null);
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const centredRef = useRef(null);

  useEffect(() => {
    let live = true;
    setError(null);
    api
      .repoMap(projectId)
      .then((m) => live && (setMap(m), setExpanded(null), setSelected("/")))
      .catch((e) => live && setError(formatErrorMessage(e)));
    return () => {
      live = false;
    };
  }, [projectId, refreshKey]);

  useEffect(() => {
    if (grow && map && !map.empty) sectionRef.current?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  }, [grow, map]);

  const tree = useMemo(() => (map && !map.empty ? buildTree(map, showDeleted) : null), [map, showDeleted]);
  const open = useMemo(() => expanded || (tree ? defaultExpanded(tree.root) : new Set()), [expanded, tree]);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 640px)");
    if (!mq) return undefined;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const geo = narrow ? GEOMETRY.narrow : GEOMETRY.wide;
  const layout = useMemo(() => (tree ? layoutTree(tree.root, open, geo) : null), [tree, open, geo]);
  const maxEdits = tree ? Math.max(1, ...tree.root.children.flatMap((c) => (c.dir ? c.files.map((i) => map.files[i].edits) : [c.edits]))) : 1;

  // Bring the root into view once per loaded map.
  useEffect(() => {
    const el = frameRef.current;
    if (!layout || !el || centredRef.current === map) return;
    centredRef.current = map;
    const r = layout.pos.get("/");
    el.scrollTop = Math.max(0, r.y - el.clientHeight / 2);
    el.scrollLeft = 0;
  }, [layout, map]);

  /* ----- motion: positions tween from where they were to where they go ----- */
  const [drawn, setDrawn] = useState(() => new Map());
  const drawnRef = useRef(new Map());
  useLayoutEffect(() => {
    if (!layout) return undefined;
    const from = drawnRef.current;
    const rootTarget = layout.pos.get("/");
    const nearest = (node, inMap) => {
      for (let p = node.parent; p; p = p.parent) if (inMap.has(p.id)) return inMap.get(p.id);
      return null;
    };
    const plan = [];
    for (const [id, t] of layout.pos) {
      const f = from.get(id);
      const anc = f ? null : from.size ? nearest(t.node, from) : rootTarget;
      const start = f || { x: anc ? anc.x : t.x, y: anc ? anc.y : t.y, o: 0 };
      plan.push({ id, node: t.node, open: t.open, sx: start.x, sy: start.y, so: start.o ?? 1, ex: t.x, ey: t.y, eo: 1 });
    }
    for (const [id, f] of from) {
      if (layout.pos.has(id) || f.o === 0) continue;
      const anc = nearest(f.node, layout.pos) || f;
      plan.push({ id, node: f.node, open: false, sx: f.x, sy: f.y, so: f.o, ex: anc.x, ey: anc.y, eo: 0, exit: true });
    }
    const frame = (k) => {
      const m = new Map();
      for (const p of plan) {
        if (k === 1 && p.exit) continue;
        m.set(p.id, { node: p.node, open: p.open, x: p.sx + (p.ex - p.sx) * k, y: p.sy + (p.ey - p.sy) * k, o: p.so + (p.eo - p.so) * k });
      }
      drawnRef.current = m;
      setDrawn(m);
    };
    if (reduceMotion()) {
      frame(1);
      return undefined;
    }
    const duration = from.size ? MOTION_MS : 900;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      frame(k < 1 ? ease(k) : 1);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout]);

  /* ----- replay: the history plays commit by commit ----- */
  const timeline = useMemo(() => map?.timeline || [], [map]);
  const [replay, setReplay] = useState({ on: false, playing: false, t: 0 });
  const [pulses, setPulses] = useState([]);
  const countsRef = useRef({ t: 0, counts: null });

  const countsAt = useCallback(
    (t) => {
      const c = countsRef.current;
      if (!c.counts || t < c.t) {
        c.counts = new Uint32Array(map.files.length);
        c.t = 0;
      }
      for (let i = c.t; i < t; i++) for (const f of timeline[i][2]) c.counts[f] += 1;
      c.t = t;
      return c.counts;
    },
    [map, timeline],
  );

  // Which drawn node stands for each file right now (the file, or its closed folder).
  const repOf = useMemo(() => {
    if (!tree || !layout) return null;
    const rep = new Int32Array(map.files.length).fill(-1);
    const ids = [];
    layout.order.forEach((n) => {
      if (n.dir && layout.pos.get(n.id).open) return;
      const k = ids.push(n.id) - 1;
      for (const f of n.files) rep[f] = k;
    });
    return { rep, ids };
  }, [tree, layout, map]);

  useEffect(() => {
    if (!replay.playing) return undefined;
    const rate = Math.max(6, timeline.length / 16); // commits per second; about 16 s end to end
    let raf;
    let last = performance.now();
    let carry = 0;
    let t = replay.t;
    const step = (now) => {
      carry += ((now - last) / 1000) * rate;
      last = now;
      const n = Math.floor(carry);
      if (n > 0) {
        carry -= n;
        const fresh = [];
        for (let i = t; i < Math.min(timeline.length, t + n); i++) {
          const seen = new Set();
          // At most six rings per commit: a sweeping commit should not drown the rest.
          for (const f of timeline[i][2].slice(0, 40)) {
            if (seen.size >= 6) break;
            const k = repOf?.rep[f];
            if (k >= 0 && !seen.has(k)) {
              seen.add(k);
              fresh.push({ key: `${i}-${k}`, id: repOf.ids[k], color: authorColor(timeline[i][1]), at: now });
            }
          }
        }
        t = Math.min(timeline.length, t + n);
        if (!reduceMotion() && fresh.length) setPulses((p) => [...p.filter((x) => now - x.at < 900), ...fresh.slice(-18)].slice(-40));
        setReplay((r) => ({ ...r, t, playing: t < timeline.length }));
        if (t >= timeline.length) return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay.playing, timeline, repOf]);

  const live = replay.on ? countsAt(replay.t) : null;
  const valueOf = (n) => {
    if (!live) return { edits: n.edits, share: n.edits ? n.leaverEdits / n.edits : 0 };
    let e = 0;
    for (const f of n.files) e += live[f];
    return { edits: e, share: n.edits ? n.leaverEdits / n.edits : 0 };
  };

  const startReplay = () => {
    countsRef.current = { t: 0, counts: null };
    setPulses([]);
    setReplay({ on: true, playing: true, t: 0 });
  };
  const stopReplay = () => {
    setReplay({ on: false, playing: false, t: 0 });
    setPulses([]);
  };

  /* ----- interaction ----- */
  const toggle = (n) => {
    if (!n.dir || !n.children.length) return;
    const next = new Set(open);
    if (next.has(n.id) && n.id !== "/") {
      for (const id of next) if (id.startsWith(n.id)) next.delete(id);
    } else next.add(n.id);
    setExpanded(next);
  };
  const showFlagged = () => {
    const next = new Set(["/"]);
    for (const n of tree.all.values()) {
      if (n.tw.length || n.claims.length) for (let p = n.parent; p; p = p.parent) next.add(p.id);
    }
    setExpanded(next);
  };
  const collapseAll = () => setExpanded(new Set(["/"]));

  const svgRef = useRef(null);
  const focusNode = (id) => {
    setSelected(id);
    requestAnimationFrame(() => svgRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: false }));
  };
  const onKey = (e, n) => {
    const order = layout.order;
    const i = order.findIndex((x) => x.id === n.id);
    const isOpen = n.dir && layout.pos.get(n.id)?.open;
    if (e.key === "ArrowDown" && i < order.length - 1) focusNode(order[i + 1].id);
    else if (e.key === "ArrowUp" && i > 0) focusNode(order[i - 1].id);
    else if (e.key === "ArrowRight" && n.dir && !isOpen) toggle(n);
    else if (e.key === "ArrowRight" && isOpen) focusNode(n.children[0].id);
    else if (e.key === "ArrowLeft" && isOpen && n.id !== "/") toggle(n);
    else if (e.key === "ArrowLeft" && n.parent) focusNode(n.parent.id);
    else if (e.key === "Enter" || e.key === " ") {
      toggle(n);
      setSelected(n.id);
    }
    else return;
    e.preventDefault();
  };

  /* ----- render ----- */
  if (error) {
    return (
      <section className="bg-surface-container-lowest rounded-[12px] border border-outline-variant p-5 text-[13.5px] text-error" role="alert">
        The repository map could not load: {error}
      </section>
    );
  }
  if (!map) return <Skeleton className="h-72 w-full" />;
  if (map.empty || !tree) return null;

  const sel = tree.all.get(selected) || tree.root;
  const selPath = new Set();
  for (let p = sel; p; p = p.parent) selPath.add(p.id);
  const hoverPath = new Set();
  for (let p = hover ? tree.all.get(hover) : null; p; p = p.parent) hoverPath.add(p.id);

  // Folders are measured per file, so a big folder does not drown out a busy file.
  const perFile = (n, v) => (n.dir ? v.edits / Math.max(1, n.files.length) : v.edits);
  const fillFor = (n, v) => {
    if (mode === "author") return authorColor(n.topAuthor);
    if (mode === "edits") {
      const k = Math.sqrt(Math.min(1, perFile(n, v) / maxEdits));
      return `color-mix(in oklab, var(--color-ink) ${Math.round(18 + k * 82)}%, var(--color-surface-container-lowest))`;
    }
    return `color-mix(in oklab, var(--color-error) ${Math.round(8 + v.share * 92)}%, var(--color-outline-variant))`;
  };
  const radius = (n, v) => {
    const base = 3.2 + 8.8 * Math.sqrt(Math.min(1, perFile(n, v) / maxEdits));
    return n.dir ? base + 2 : base;
  };

  const entries = [...drawn.entries()];
  const curDay = replay.on && replay.t > 0 ? timeline[replay.t - 1][0] : null;
  const depIndex = timeline.findIndex((c) => addDays(map.start_date, c[0]) > map.departure_date);
  const leaverIdx = map.authors.indexOf(map.leaver);
  const selShare = sel.edits ? sel.leaverEdits / sel.edits : 0;
  const selAuthors = [...sel.authors.entries()].sort((a, b) => b[1] - a[1]);
  const selRisk = sel.risk || (sel.depth === 1 && !sel.dir ? map.modules.root : null);

  return (
    <section ref={sectionRef} aria-labelledby="map-h" className="bg-surface-container-lowest rounded-[12px] border border-outline-variant flex flex-col min-w-0 overflow-hidden scroll-mt-20">
      <header className="px-5 sm:px-7 pt-6 pb-4 flex flex-col gap-4 border-b border-outline-variant">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="max-w-[68ch]">
            <h2 id="map-h" className="text-[22px] sm:text-[26px] leading-[1.1] font-bold tracking-[-0.02em]">
              Repository map
            </h2>
            <p className="text-[13.5px] leading-[21px] text-on-surface-variant mt-1.5 max-w-[65ch]">
              {map.file_count.toLocaleString()} files across {map.commit_count.toLocaleString()} commits, up to {fmtDate(map.end_date)}. A bud's size is how often the file was edited. Diamonds are tripwires and squares are claims. Select a folder to open it, or replay the history to watch it grow.
              {map.files_truncated && ` Only the ${map.files.length.toLocaleString()} most edited files are drawn.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!replay.on ? (
              <Button variant="primary" size="sm" onClick={startReplay} disabled={!timeline.length} data-rm="replay">
                <Play size={14} aria-hidden="true" /> Replay history
              </Button>
            ) : (
              <>
                <Button variant="primary" size="sm" onClick={() => (replay.t >= timeline.length ? startReplay() : setReplay((r) => ({ ...r, playing: !r.playing })))}>
                  {replay.playing ? <Pause size={14} aria-hidden="true" /> : replay.t >= timeline.length ? <RotateCcw size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                  {replay.playing ? "Pause" : replay.t >= timeline.length ? "Play again" : "Resume"}
                </Button>
                <Button size="sm" onClick={stopReplay}>
                  Show today
                </Button>
              </>
            )}
            <Button size="sm" onClick={showFlagged} disabled={!tree.root.flagged}>
              <Flag size={14} aria-hidden="true" /> Open flagged
            </Button>
            <Button size="sm" variant="ghost" onClick={collapseAll} data-rm="fold">
              <ChevronsDownUp size={14} aria-hidden="true" /> Fold all
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[12.5px] text-on-surface-variant">
          <div role="group" aria-label="Colour buds by" className="inline-flex p-0.5 rounded-full bg-surface-container text-[12.5px] font-semibold">
            {MODES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
                className={`h-7 px-3 rounded-full cursor-pointer transition-colors ${mode === id ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_2px_rgb(29_32_31/0.12)]" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "share" && (
            <span className="inline-flex items-center gap-2">
              <span>Others</span>
              <span className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--color-error) 8%, var(--color-outline-variant)), var(--color-error))" }} aria-hidden="true" />
              <span>All {map.leaver}</span>
            </span>
          )}
          {mode === "edits" && (
            <span className="inline-flex items-center gap-2">
              <span>Few</span>
              <span className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--color-ink) 18%, white), var(--color-ink))" }} aria-hidden="true" />
              <span>Many edits</span>
            </span>
          )}
          {mode === "author" && (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              {map.authors.slice(0, 5).map((a, i) => (
                <span key={a} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: authorColor(i) }} aria-hidden="true" />
                  {a}
                  {i === leaverIdx && " (leaving)"}
                </span>
              ))}
            </span>
          )}
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="-0.5 -5 10 10" aria-hidden="true"><path d="M4.5 -4.5 L9 0 L4.5 4.5 L0 0 Z" fill="var(--color-error)" /></svg>High tripwire
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="-0.5 -5 10 10" aria-hidden="true"><path d="M4.5 -4.5 L9 0 L4.5 4.5 L0 0 Z" fill="var(--color-goldenrod)" /></svg>Medium
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 -5 10 10" aria-hidden="true"><rect x="0.5" y="-4" width="8" height="8" rx="1.5" fill="var(--color-stamp)" /></svg>Claim, approved
            </span>
          </span>
          {map.files.some((f) => f.deleted) && (
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="accent-[var(--color-ink)]" />
              Show deleted files
            </label>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] lg:h-[680px] min-w-0">
        {/* The tree */}
        <div className="min-w-0 min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-outline-variant">
          <div ref={frameRef} className="rm-frame overflow-auto flex-1 max-h-[560px] lg:max-h-none min-h-[260px]">
            <svg
              ref={svgRef}
              role="tree"
              aria-label={`Files of ${tree.root.name}`}
              width={layout.width}
              height={Math.max(layout.height, 240)}
              className="block rm-svg"
            >
              {/* stems */}
              <g fill="none">
                {entries.map(([id, d]) => {
                  const p = d.node.parent && drawn.get(d.node.parent.id);
                  if (!p) return null;
                  const onPath = selPath.has(id) || hoverPath.has(id);
                  const mid = p.x + (d.x - p.x) * 0.5;
                  return (
                    <path
                      key={`l-${id}`}
                      d={`M${p.x},${p.y} C${mid},${p.y} ${mid},${d.y} ${d.x},${d.y}`}
                      stroke={onPath ? "var(--color-ink)" : "var(--color-outline-variant)"}
                      strokeWidth={onPath ? 1.75 : 1.25}
                      opacity={d.o}
                    />
                  );
                })}
              </g>

              {/* pulses during replay */}
              <g aria-hidden="true">
                {pulses.map((p) => {
                  const d = drawn.get(p.id);
                  return d ? <circle key={p.key} cx={d.x} cy={d.y} r="7" className="rm-pulse" stroke={p.color} /> : null;
                })}
              </g>

              {/* buds and names */}
              {entries.map(([id, d]) => {
                const n = d.node;
                const v = valueOf(n);
                const r = radius(n, v);
                const isOpen = d.open;
                const left = n.dir && isOpen;
                const marks = marksFor(n, isOpen);
                const label = n.dir ? (left ? clip(n.name, Math.floor((geo.col - 34 - marks.reduce((s, m) => s + markWidth(m), 0)) / CH)) : `${clip(n.name, narrow ? 22 : 34)}/`) : clip(n.name, narrow ? 24 : 38);
                const labelW = label.length * CH;
                const isSel = selected === id;
                const dim = replay.on && v.edits === 0;
                const count = n.dir && !isOpen ? ` ${n.files.length}` : "";
                // Names fade out in the first half of a fold and in during the second half of an unfold,
                // so labels never pile up while buds travel.
                const lo = Math.max(0, Math.min(1, d.o * 2 - 1));
                return (
                  <g
                    key={`n-${id}`}
                    data-id={id}
                    role="treeitem"
                    aria-level={n.depth + 1}
                    aria-expanded={n.dir && n.children.length ? isOpen : undefined}
                    aria-selected={isSel}
                    aria-label={`${n.dir ? "Folder" : "File"} ${n.name}, ${n.edits} edits, ${pct(n.edits ? n.leaverEdits / n.edits : 0)} by ${map.leaver}${n.desc.high + n.desc.medium ? `, ${n.desc.high + n.desc.medium} tripwires` : ""}${n.desc.claims ? `, ${n.desc.claims} claims` : ""}`}
                    tabIndex={isSel ? 0 : -1}
                    transform={`translate(${d.x},${d.y})`}
                    opacity={d.o * (dim ? 0.28 : 1)}
                    className="rm-node cursor-pointer outline-none"
                    onClick={() => {
                      setSelected(id);
                      if (n.dir) toggle(n);
                    }}
                    onKeyDown={(e) => onKey(e, n)}
                    onMouseEnter={() => setHover(id)}
                    onMouseLeave={() => setHover((h) => (h === id ? null : h))}
                  >
                    <circle r={r + 7} className="rm-hit" />
                    {isSel && <circle r={r + 4} className="rm-sel" />}
                    <circle
                      r={r}
                      className="rm-bud"
                      fill={n.dir && isOpen ? "var(--color-surface-container-lowest)" : fillFor(n, v)}
                      stroke={n.dir ? fillFor(n, v) : "color-mix(in oklab, var(--color-ink) 22%, transparent)"}
                      strokeWidth={n.dir ? 2.25 : 1}
                    />
                    <g opacity={lo}>
                    {left ? (
                      <>
                        <text x={-r - 8} y="4" textAnchor="end" className="rm-label rm-label-dir">
                          {label}
                        </text>
                        <Marks marks={marks} x={-r - 8 - labelW - 8 - marks.reduce((s, m) => s + markWidth(m), 0)} y={0} />
                      </>
                    ) : (
                      <>
                        <text x={r + 8} y="4" className={`rm-label ${n.dir ? "rm-label-dir" : ""}`}>
                          {label}
                          {count && <tspan className="rm-count">{count}</tspan>}
                        </text>
                        <Marks marks={marks} x={r + 8 + (label.length + count.length) * CH + 10} y={0} />
                      </>
                    )}
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          {replay.on && (
            <div className="rise-in px-5 sm:px-7 py-3.5 border-t border-outline-variant flex flex-col gap-2" aria-live="off">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-mono tnum text-on-surface">{curDay === null ? fmtDate(map.start_date) : fmtDate(addDays(map.start_date, curDay))}</span>
                <span className="text-on-surface-variant tnum">
                  {replay.t > 0 && (
                    <span className="inline-flex items-center gap-1.5 mr-3">
                      <span className="h-2 w-2 rounded-full" style={{ background: authorColor(timeline[replay.t - 1][1]) }} aria-hidden="true" />
                      {map.authors[timeline[replay.t - 1][1]]}
                    </span>
                  )}
                  commit {replay.t.toLocaleString()} of {timeline.length.toLocaleString()}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max={timeline.length}
                  value={replay.t}
                  aria-label="Point in the history"
                  onChange={(e) => {
                    setPulses([]);
                    setReplay({ on: true, playing: false, t: Number(e.target.value) });
                  }}
                  className="rm-range w-full"
                  style={{ "--k": `${(replay.t / Math.max(1, timeline.length)) * 100}%` }}
                />
                {depIndex > 0 && (
                  <span className="absolute -top-1 h-4 w-px bg-error pointer-events-none" style={{ left: `${(depIndex / timeline.length) * 100}%` }} title={`${map.leaver} left on ${fmtDate(map.departure_date)}`} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Selected node */}
        <aside aria-label="Selected file or folder" className="p-5 sm:p-6 flex flex-col gap-5 min-w-0 min-h-0 lg:overflow-y-auto bg-surface-container-low">
          <div key={sel.id} className="rise-in flex flex-col gap-1 min-w-0">
            <span className="text-[12.5px] text-on-surface-variant">{sel.dir ? `Folder · ${sel.files.length.toLocaleString()} file${sel.files.length === 1 ? "" : "s"}` : sel.file?.deleted ? "File, deleted" : "File"}</span>
            <h3 className="font-mono text-[15px] leading-5 text-on-surface break-all">{sel.id === "/" ? tree.root.name : sel.id}</h3>
          </div>

          <dl className="grid grid-cols-[0.8fr_0.9fr_1.3fr] gap-3">
            {[
              ["Edits", sel.edits.toLocaleString()],
              ["Leaver's share", pct(selShare)],
              ["Last edit", fmtDate(sel.last)],
            ].map(([k, val]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11.5px] text-on-surface-variant truncate">{k}</dt>
                <dd className="text-[15px] font-bold tnum tracking-[-0.01em] text-on-surface truncate">{val}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-on-surface">Who edited it</span>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-container" aria-hidden="true">
              {selAuthors.map(([a, k]) => (
                <span key={a} className="rm-grow h-full" style={{ width: `${(k / sel.edits) * 100}%`, background: authorColor(a) }} />
              ))}
            </div>
            <ul className="flex flex-col gap-1 text-[12.5px]">
              {selAuthors.slice(0, 4).map(([a, k]) => (
                <li key={a} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: authorColor(a) }} aria-hidden="true" />
                  <span className="flex-1 truncate">
                    {map.authors[a]}
                    {a === leaverIdx && <span className="text-on-surface-variant"> (leaving)</span>}
                  </span>
                  <span className="tnum text-on-surface-variant">{k}</span>
                </li>
              ))}
              {selAuthors.length > 4 && <li className="text-on-surface-variant">and {selAuthors.length - 4} more</li>}
            </ul>
          </div>

          {(selRisk || sel.fixes > 0 || sel.reverts > 0) && (
            <p className="text-[12.5px] leading-5 text-on-surface-variant">
              {selRisk && (
                <>
                  Module risk score <span className="font-mono tnum text-on-surface">{selRisk.risk.toFixed(3)}</span>
                  {selRisk.days_stale != null && `, untouched for ${selRisk.days_stale} days before the last day`}.{" "}
                </>
              )}
              {sel.fixes > 0 && `${sel.fixes} fix commit${sel.fixes === 1 ? "" : "s"}. `}
              {sel.reverts > 0 && `${sel.reverts} revert${sel.reverts === 1 ? "" : "s"}.`}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            <span className="text-[12.5px] font-semibold text-on-surface">
              Tripwires {sel.allTw.length > 0 && <span className="font-normal text-on-surface-variant tnum">{sel.allTw.length}</span>}
            </span>
            {sel.allTw.length === 0 ? (
              <p className="text-[12.5px] text-on-surface-variant">None here. That does not mean a change is safe.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sel.allTw.slice(0, 5).map((t) => (
                  <li key={t.id} className="rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 py-2.5 flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-[12.5px] font-semibold text-on-surface">
                      <svg width="9" height="9" viewBox="0 -4.5 9 9" aria-hidden="true" className="shrink-0">
                        <path d="M4.5 -4.5 L9 0 L4.5 4.5 L0 0 Z" fill={t.severity === "high" ? "var(--color-error)" : "var(--color-goldenrod)"} />
                      </svg>
                      <span className="min-w-0 truncate" title={t.title}>{t.title}</span>
                    </span>
                    <span className="text-[12.5px] leading-[18px] text-on-surface-variant line-clamp-3">{t.warning}</span>
                  </li>
                ))}
                {sel.allTw.length > 5 && <li className="text-[12.5px] text-on-surface-variant">and {sel.allTw.length - 5} more under this folder</li>}
              </ul>
            )}
          </div>

          {sel.desc.claims > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[12.5px] font-semibold text-on-surface">
                Claims <span className="font-normal text-on-surface-variant tnum">{sel.desc.claims}</span>
              </span>
              <ul className="flex flex-col gap-1.5">
                {collectClaims(sel)
                  .slice(0, 4)
                  .map((c) => (
                    <li key={c.id} className="flex items-start gap-2 text-[12.5px] leading-[18px]">
                      <span
                        className={`mt-[5px] h-2 w-2 rounded-[2px] shrink-0 border ${c.review_state === "approved" || c.review_state === "corrected" ? "bg-stamp border-stamp" : "border-stamp"}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="text-on-surface line-clamp-2">{c.text}</span>
                        <span className="text-on-surface-variant">{humanize(c.review_state === "pending" ? "not checked" : c.review_state)}</span>
                      </span>
                    </li>
                  ))}
              </ul>
              {setActiveTab && (
                <button type="button" onClick={() => setActiveTab("review")} className="self-start text-[13px] font-semibold text-primary hover:underline underline-offset-2 cursor-pointer">
                  Check these claims
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function collectClaims(n) {
  const out = new Map();
  const walk = (x) => {
    for (const c of x.claims) out.set(c.id, c);
    x.children.forEach(walk);
  };
  walk(n);
  return [...out.values()];
}
