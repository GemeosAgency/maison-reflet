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
