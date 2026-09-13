/**
 * Les graphiques de la tour de contrôle : du SVG rendu côté serveur, sans
 * librairie — des barres et des courbes dans l'encre et le rose du site.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export type Series = { key: string; label: string; value: number }[];

/** Barres journalières. `labels` sous les barres tous les `every` points. */
export function bars(series: Series, opts: { width?: number; height?: number; color?: string; every?: number } = {}): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 140;
  const color = opts.color ?? "var(--ink)";
  const pad = { top: 8, bottom: 22, left: 0, right: 0 };
  const innerH = height - pad.top - pad.bottom;
  const n = Math.max(1, series.length);
  const max = Math.max(1, ...series.map((s) => s.value));
  const gap = n > 40 ? 1 : 3;
  const bw = Math.max(1, (width - gap * (n - 1)) / n);
  const every = opts.every ?? (n > 40 ? 15 : n > 10 ? 5 : 1);
  const rects = series
    .map((s, i) => {
      const h = Math.max(s.value > 0 ? 2 : 0, (s.value / max) * innerH);
      const x = i * (bw + gap);
      const y = pad.top + innerH - h;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${color}" opacity="${s.value > 0 ? 0.85 : 0.18}"><title>${esc(s.label)} : ${s.value}</title></rect>`;
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

/** Un anneau de parts (sources, appareils) : `parts` dans l'ordre, couleurs fournies. */
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

/** Deux séries sur les mêmes jours : des barres (montants) et une ligne (compte), pour lire le CA et les commandes ensemble. */
export function barsAndLine(barsSeries: Series, lineSeries: Series, opts: { width?: number; height?: number; barColor?: string; lineColor?: string; barFormat?: (v: number) => string; lineFormat?: (v: number) => string } = {}): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 160;
  const barColor = opts.barColor ?? "var(--ink)";
  const lineColor = opts.lineColor ?? "var(--rose)";
  const fb = opts.barFormat ?? ((v: number) => String(v));
  const fl = opts.lineFormat ?? ((v: number) => String(v));
  const pad = { top: 10, bottom: 22 };
  const innerH = height - pad.top - pad.bottom;
  const n = Math.max(1, barsSeries.length);
  const maxB = Math.max(1, ...barsSeries.map((s) => s.value));
  const maxL = Math.max(1, ...lineSeries.map((s) => s.value));
  const gap = n > 40 ? 1 : 3;
  const bw = Math.max(1, (width - gap * (n - 1)) / n);
  const every = n > 40 ? 15 : n > 10 ? 5 : 1;
  const rects = barsSeries
    .map((s, i) => {
      const h = Math.max(s.value > 0 ? 2 : 0, (s.value / maxB) * innerH);
      return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(pad.top + innerH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${barColor}" opacity="${s.value > 0 ? 0.8 : 0.14}"><title>${esc(s.label)} : ${esc(fb(s.value))}</title></rect>`;
    })
    .join("");
  const pts = lineSeries.map((s, i) => [i * (bw + gap) + bw / 2, pad.top + innerH - (s.value / maxL) * innerH] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dots = lineSeries.map((s, i) => (s.value > 0 ? `<circle cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="3" fill="${lineColor}"><title>${esc(s.label)} : ${esc(fl(s.value))}</title></circle>` : "")).join("");
  const labels = barsSeries
    .map((s, i) => (i % every === 0 || i === n - 1 ? `<text x="${(i * (bw + gap) + bw / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.55">${esc(s.label)}</text>` : ""))
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" role="img" aria-label="Barres et courbe"><line x1="0" y1="${pad.top + innerH + 0.5}" x2="${width}" y2="${pad.top + innerH + 0.5}" stroke="currentColor" opacity="0.15"/>${rects}<path d="${d}" fill="none" stroke="${lineColor}" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${dots}${labels}</svg>`;
}
