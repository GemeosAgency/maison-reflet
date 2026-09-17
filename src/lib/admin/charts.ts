/**
 * Les graphiques de la tour de contrôle : du SVG et du HTML rendus côté
 * serveur, sans librairie — dans l'encre, le sable et le rose du site. Les
 * courbes du temps portent leurs points en données pour l'infobulle au survol
 * et le jour par jour au clic (script dans AdminLayout).
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export type Series = { key: string; label: string; value: number }[];

/** Barres journalières simples. */
export function bars(series: Series, opts: { width?: number; height?: number; color?: string; every?: number } = {}): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 140;
  const color = opts.color ?? "var(--ink)";
  const pad = { top: 8, bottom: 22 };
  const innerH = height - pad.top - pad.bottom;
  const n = Math.max(1, series.length);
  const max = Math.max(1, ...series.map((s) => s.value));
  const gap = n > 40 ? 1 : 3;
  const bw = Math.max(1, (width - gap * (n - 1)) / n);
  const every = opts.every ?? (n > 40 ? 15 : n > 10 ? 5 : 1);
  const rects = series
    .map((s, i) => {
      const h = Math.max(s.value > 0 ? 2 : 0, (s.value / max) * innerH);
      return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(pad.top + innerH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${color}" opacity="${s.value > 0 ? 0.85 : 0.18}"><title>${esc(s.label)} : ${s.value}</title></rect>`;
    })
    .join("");
  const labels = series
    .map((s, i) => (i % every === 0 || i === n - 1 ? `<text x="${(i * (bw + gap) + bw / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.55">${esc(s.label)}</text>` : ""))
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" role="img" aria-label="Barres"><line x1="0" y1="${pad.top + innerH + 0.5}" x2="${width}" y2="${pad.top + innerH + 0.5}" stroke="currentColor" opacity="0.15"/>${rects}${labels}</svg>`;
}

/** Une courbe fine avec son aire, pour les tendances. */
export function sparkline(values: number[], opts: { width?: number; height?: number; color?: string } = {}): string {
  const width = opts.width ?? 160;
  const height = opts.height ?? 40;
  const color = opts.color ?? "var(--rose)";
  if (values.length < 2) return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"></svg>`;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${area}" fill="${color}" opacity="0.10"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.5" fill="${color}"/></svg>`;
}

/** Une jauge horizontale de 0 à 1 (part), en encre sur sable. */
export function gauge(part: number, opts: { color?: string } = {}): string {
  const pct = Math.max(0, Math.min(1, part)) * 100;
  return `<span class="gauge" aria-hidden="true"><span class="gauge-fill" style="width:${pct.toFixed(1)}%;background:${opts.color ?? "var(--ink)"}"></span></span>`;
}

/** Un anneau de parts (canaux, appareils). */
export function donut(parts: { label: string; value: number; color: string }[], opts: { size?: number; thickness?: number } = {}): string {
  const size = opts.size ?? 120;
  const thickness = opts.thickness ?? 14;
  const total = parts.reduce((n, p) => n + p.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  if (total <= 0) return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--sand)" stroke-width="${thickness}"/></svg>`;
  let offset = 0;
  const arcs = parts
    .filter((p) => p.value > 0)
    .map((p) => {
      const len = (p.value / total) * c;
      const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.color}" stroke-width="${thickness}" stroke-dasharray="${Math.max(0, len - 1.5).toFixed(2)} ${(c - Math.max(0, len - 1.5)).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(p.label)} : ${p.value}</title></circle>`;
      offset += len;
      return el;
    })
    .join("");
  return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Répartition">${arcs}</svg>`;
}

/** Deux séries sur les mêmes jours : des barres et une ligne (gardé pour les pages Luma). */
export function barsAndLine(barsSeries: Series, lineSeries: Series, opts: { width?: number; height?: number; barColor?: string; lineColor?: string; barFormat?: (v: number) => string; lineFormat?: (v: number) => string } = {}): string {
  return timeChart(barsSeries, { secondary: lineSeries, height: opts.height, width: opts.width, primaryColor: opts.barColor, secondaryColor: opts.lineColor, primaryFormat: opts.barFormat, secondaryFormat: opts.lineFormat });
}

/**
 * La courbe du temps : une aire pour la série principale (montants ou compte),
 * des barres discrètes pour la secondaire, une grille de trois repères avec
 * leurs valeurs, les jours sous l'axe. Les points sont dans `data-points` pour
 * l'infobulle au survol ; un clic ouvre la fenêtre `data-modal` sur le jour.
 */
export function timeChart(
  primary: Series,
  opts: {
    secondary?: Series;
    width?: number;
    height?: number;
    primaryColor?: string;
    secondaryColor?: string;
    primaryFormat?: (v: number) => string;
    secondaryFormat?: (v: number) => string;
    primaryLabel?: string;
    secondaryLabel?: string;
    /** Courbe étroite (fenêtre de détail) : moitié moins d'étiquettes de dates. */
    compact?: boolean;
    modal?: string;
    area?: boolean;
  } = {}
): string {
  // Les formes (grille, aire, courbe, barres) vivent dans un SVG étiré à la
  // largeur de la carte (repère 0–1000 en pour-mille, traits non déformés) ;
  // les points et les étiquettes sont du HTML posé en pourcentage : rien ne
  // s'étire, quelle que soit la largeur de l'écran.
  const height = opts.height ?? 200;
  const pc = opts.primaryColor ?? "var(--rose)";
  const sc = opts.secondaryColor ?? "var(--ink)";
  const fp = opts.primaryFormat ?? ((v: number) => String(v));
  const fs = opts.secondaryFormat ?? ((v: number) => String(v));
  const n = Math.max(1, primary.length);
  const maxP = Math.max(0, ...primary.map((s) => s.value));
  const maxS = Math.max(1, ...(opts.secondary ?? []).map((s) => s.value));
  const niceMax = (() => {
    if (maxP <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(maxP)));
    const m = maxP / p;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return nice * p;
  })();
  const X = (i: number) => ((i + 0.5) / n) * 1000; // pour-mille
  const Y = (v: number) => 1000 - (v / niceMax) * 1000;
  const seen = new Set<string>();
  const ticks = [0, 0.5, 1]
    .map((t) => ({ t, label: fp(niceMax * t) }))
    .filter((k) => (seen.has(k.label) ? false : (seen.add(k.label), true)));
  const grid = [0, 0.5, 1].map((t) => `<line x1="0" x2="1000" y1="${(1000 - t * 1000).toFixed(1)}" y2="${(1000 - t * 1000).toFixed(1)}" stroke="currentColor" opacity="${t === 0 ? 0.22 : 0.08}" vector-effect="non-scaling-stroke"/>`).join("");
  const step = 1000 / n;
  const bw = Math.min(step * 0.45, 22);
  const secondaryBars = (opts.secondary ?? [])
    .map((s, i) => {
      if (s.value <= 0) return "";
      const h = Math.max(6, (s.value / maxS) * 900);
      return `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${(1000 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${sc}" opacity="0.22"/>`;
    })
    .join("");
  const pts = primary.map((s, i) => [X(i), Y(s.value)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = opts.area === false ? "" : `<path d="${line} L${pts[pts.length - 1][0].toFixed(1)},1000 L${pts[0][0].toFixed(1)},1000 Z" fill="${pc}" opacity="0.08"/>`;
  const dots = primary.map((s, i) => (s.value > 0 ? `<span class="tchart-dot${n > 45 ? " is-small" : ""}" style="left:${(X(i) / 10).toFixed(2)}%;top:${(Y(s.value) / 10).toFixed(2)}%;background:${pc}"></span>` : "")).join("");
  // Une étiquette sur `every`. Dans une fenêtre de détail la courbe n'a que la
  // moitié de la largeur : on en garde deux fois moins, sinon les dates se
  // chevauchent et la courbe paraît écrasée.
  const base = n > 60 ? 14 : n > 31 ? 7 : n > 14 ? 3 : 1;
  const every = opts.compact ? base * 2 : base;
  const xLabels = primary.map((s, i) => (i % every === 0 || i === n - 1 ? `<span class="tchart-xlabel" style="left:${(X(i) / 10).toFixed(2)}%">${esc(s.label)}</span>` : "")).join("");
  const yLabels = ticks.map((k) => `<span class="tchart-ylabel" style="top:${(100 - k.t * 100).toFixed(1)}%">${esc(k.label)}</span>`).join("");
  const points = primary.map((s, i) => ({ k: s.key, l: s.label, p: fp(s.value), s: opts.secondary ? fs(opts.secondary[i]?.value ?? 0) : null }));
  return `<div class="tchart${opts.modal ? " is-clickable" : ""}" style="--tchart-h:${height}px" role="img" aria-label="Évolution" data-chart data-count="${n}" data-primary-label="${esc(opts.primaryLabel ?? "")}" data-secondary-label="${esc(opts.secondaryLabel ?? "")}" ${opts.modal ? `data-modal="${esc(opts.modal)}"` : ""} data-points="${esc(JSON.stringify(points))}"><div class="tchart-y">${yLabels}</div><div class="tchart-plot" data-plot><svg class="tchart-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${grid}${secondaryBars}${area}<path d="${line}" fill="none" stroke="${pc}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>${dots}<span class="tchart-guide" data-guide hidden></span></div><div class="tchart-x">${xLabels}</div></div>`;
}

/** Une liste de barres horizontales : étiquette, jauge, valeur. `href` ou `modal` rend la ligne cliquable. */
export function hbars(rows: { label: string; value: number; text?: string; color?: string; href?: string; modal?: string; prefix?: string }[], opts: { max?: number } = {}): string {
  if (!rows.length) return `<p class="empty">Rien sur la période.</p>`;
  const max = Math.max(1, opts.max ?? Math.max(...rows.map((r) => r.value)));
  return `<ul class="hbars">${rows
    .map((r) => {
      const inner = `<span class="hbar-label">${r.prefix ? `<span class="hbar-prefix">${r.prefix}</span>` : ""}<span class="hbar-text">${esc(r.label)}</span></span><span class="hbar-track"><span class="hbar-fill" style="width:${((r.value / max) * 100).toFixed(1)}%;background:${r.color ?? "var(--ink)"}"></span></span><span class="hbar-value">${esc(r.text ?? String(r.value))}</span>`;
      if (r.modal) return `<li><button type="button" class="hbar hbar-btn" data-open-modal="${esc(r.modal)}">${inner}</button></li>`;
      if (r.href) return `<li><a class="hbar" href="${esc(r.href)}">${inner}</a></li>`;
      return `<li><span class="hbar">${inner}</span></li>`;
    })
    .join("")}</ul>`;
}

/**
 * Le parcours en marches : chaque étape avec sa part du départ et la conversion
 * depuis l'étape précédente.
 *
 * `sub` ajoute un second chiffre sous le libellé, typiquement un montant : sur
 * les paniers, le nombre seul ne dit pas ce qui est en jeu. `modal` rend la
 * marche cliquable, comme les segments d'une barre empilée.
 */
export function funnelSteps(
  steps: { label: string; value: number; sub?: string; modal?: string }[],
  fmt: (n: number) => string
): string {
  const first = Math.max(1, steps[0]?.value ?? 1);
  return `<ol class="fsteps">${steps
    .map((s, i) => {
      const prev = steps[i - 1]?.value ?? null;
      const rate = prev ? `${Math.round((s.value / prev) * 100)} %` : "";
      const w = Math.max(3, (s.value / first) * 100);
      const label = `<span class="fstep-label">${esc(s.label)}${s.sub ? `<span class="fstep-sub">${esc(s.sub)}</span>` : ""}</span>`;
      const corps = `${label}<span class="fstep-bar"><span class="fstep-fill" style="width:${w.toFixed(1)}%"></span></span><span class="fstep-value">${esc(fmt(s.value))}</span><span class="fstep-rate">${rate}</span>`;
      return s.modal
        ? `<li class="fstep is-clickable"><button type="button" class="fstep-btn" data-open-modal="${esc(s.modal)}">${corps}</button></li>`
        : `<li class="fstep">${corps}</li>`;
    })
    .join("")}</ol>`;
}

/** Une carte de chaleur 7 jours × 24 heures (Dubaï) : plus la case est foncée, plus la valeur est forte. */
export function heatmap(matrix: number[][], opts: { color?: string; format?: (v: number) => string } = {}): string {
  const rgb = opts.color ?? "129, 37, 56";
  const fmt = opts.format ?? ((v: number) => String(v));
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const max = Math.max(1, ...matrix.flat());
  const hours = Array.from({ length: 24 }, (_, h) => `<span class="heat-hour">${h % 3 === 0 ? `${h}h` : ""}</span>`).join("");
  const rows = matrix
    .map((row, d) => `<span class="heat-day">${days[d]}</span>${row.map((v, h) => `<span class="heat-cell" style="background:rgba(${rgb},${v > 0 ? (0.12 + 0.88 * (v / max)).toFixed(2) : "0.04"})" title="${esc(days[d])} ${h}h–${h + 1}h : ${esc(fmt(v))}"></span>`).join("")}`)
    .join("");
  return `<div class="heat" role="img" aria-label="Carte de chaleur par jour et heure"><span class="heat-corner"></span>${hours}${rows}</div>`;
}

/** Une barre segmentée avec sa légende (paniers, canaux). */
export function stackBar(parts: { label: string; value: number; color: string; text?: string; modal?: string }[]): string {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const segs = parts.filter((p) => p.value > 0).map((p) => `<span class="stack-seg" style="width:${((p.value / Math.max(1, total)) * 100).toFixed(2)}%;background:${p.color}"><span class="sr">${esc(p.label)}</span></span>`).join("");
  const legend = parts
    .map((p) => {
      const inner = `<span class="dot" style="background:${p.color}"></span><span class="legend-label">${esc(p.label)}</span><span class="legend-num">${esc(p.text ?? String(p.value))}</span>`;
      return p.modal ? `<li><button type="button" class="legend-btn" data-open-modal="${esc(p.modal)}">${inner}</button></li>` : `<li>${inner}</li>`;
    })
    .join("");
  return `<div class="stack${total > 0 ? "" : " is-empty"}" aria-hidden="true">${segs}</div><ul class="legend">${legend}</ul>`;
}
