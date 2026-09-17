/**
 * Remplit la tour de contrôle de données de démonstration, pour voir les pages
 * avec du volume plutôt qu'avec des zéros.
 *
 * TOUT est marqué `test: true`. La tour de contrôle écarte ces lignes par
 * défaut et ne les montre qu'en cochant « données de test » : les vrais
 * chiffres ne bougent donc jamais, et rien de ce qui est posé ici ne peut être
 * confondu avec une vente.
 *
 * Les parcours sont cohérents de bout en bout : un même `anon_id` porte ses
 * pages vues, ses fiches produit, son panier, parfois son paiement, et la
 * commande qui en découle. Sans cette cohérence l'entonnoir et l'attribution
 * afficheraient n'importe quoi, et on jugerait le design sur des chiffres faux.
 *
 *   node scripts/seed-demo.mjs            # 30 jours
 *   node scripts/seed-demo.mjs --jours 60
 *   node scripts/seed-demo.mjs --live     # juste une vague pour « En direct »
 *   node scripts/seed-demo.mjs --purge    # retire tout ce que ce script a posé
 */
import { createClient as pg } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d;
};
const PURGE = process.argv.includes("--purge");
/*
 * « En direct » ne regarde que les dix dernières minutes : une vague posée à
 * midi a disparu à midi dix. `--live` en repose une, sans toucher au reste, pour
 * regarder la page quand on veut.
 */
const LIVE_SEUL = process.argv.includes("--live");
const JOURS = arg("jours", 30);

/** Marqueur porté par chaque ligne posée ici : c'est lui qui rend le retrait sûr. */
const MARQUE = "demo";
const ID_BASE = 900000000000; // les commandes de démo vivent au-dessus des vraies

const db = pg(process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const REFLETS = [
  { handle: "ultra-cuir", titre: "Ultra Cuir", prix: 320, poids: 22 },
  { handle: "minuit-bourbon", titre: "Minuit Bourbon", prix: 320, poids: 18 },
  { handle: "new-oud", titre: "New Oud", prix: 320, poids: 20 },
  { handle: "bois-alert", titre: "Bois Alert", prix: 320, poids: 16 },
  { handle: "melting-mango", titre: "Melting Mango", prix: 320, poids: 14 },
  { handle: "fifth-season", titre: "Fifth Season", prix: 320, poids: 10 },
];
const COFFRET = { handle: "sample-box", titre: "Coffret découverte", prix: 160 };

const PAYS = [
  { code: "AE", ville: "Dubai", poids: 46, locale: "en" },
  { code: "SA", ville: "Riyadh", poids: 18, locale: "ar" },
  { code: "KW", ville: "Kuwait City", poids: 6, locale: "ar" },
  { code: "QA", ville: "Doha", poids: 5, locale: "ar" },
  { code: "FR", ville: "Paris", poids: 12, locale: "fr" },
  { code: "GB", ville: "London", poids: 5, locale: "en" },
  { code: "CH", ville: "Genève", poids: 4, locale: "fr" },
  { code: "US", ville: "New York", poids: 4, locale: "en" },
];
const SOURCES = [
  { ref: null, utm: null, poids: 26 },
  { ref: "https://www.instagram.com/", utm: { utm_source: "instagram", utm_medium: "social", utm_campaign: "reflets-septembre" }, poids: 30 },
  { ref: "https://www.instagram.com/", utm: { utm_source: "meta", utm_medium: "cpc", utm_campaign: "acquisition-ae", utm_content: "ultra-cuir-suspension" }, poids: 18 },
  { ref: "https://www.google.com/", utm: null, poids: 14 },
  { ref: "https://www.tiktok.com/", utm: { utm_source: "tiktok", utm_medium: "social", utm_campaign: "twist" }, poids: 8 },
  { ref: null, utm: { utm_source: "klaviyo", utm_medium: "email", utm_campaign: "bienvenue" }, poids: 4 },
];
const APPAREILS = ["mobile", "mobile", "mobile", "desktop", "tablet"];

let graine = 20260917;
const rnd = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pese = (a) => {
  const t = a.reduce((n, x) => n + x.poids, 0);
  let r = rnd() * t;
  for (const x of a) if ((r -= x.poids) <= 0) return x;
  return a[a.length - 1];
};
const entier = (min, max) => min + Math.floor(rnd() * (max - min + 1));

/** Une journée pèse plus le week-end du Golfe (vendredi, samedi) et le soir. */
function instant(jourOffset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - jourOffset);
  const heure = pese([
    { v: entier(8, 11), poids: 18 },
    { v: entier(12, 16), poids: 26 },
    { v: entier(17, 21), poids: 40 },
    { v: entier(22, 23), poids: 16 },
  ]).v;
  d.setUTCHours(heure - 4, entier(0, 59), entier(0, 59), 0); // Dubaï = UTC+4
  return d;
}

async function purge() {
  const { error: e1 } = await db.from("site_events").delete().contains("props", { seed: MARQUE });
  if (e1) throw e1;
  const { error: e2 } = await db.from("shop_orders").delete().gte("id", ID_BASE);
  if (e2) throw e2;
  // Les messages et les profils partent en cascade avec leur session.
  const { error: e3 } = await db.from("luma_sessions").delete().like("anon_id", "demo-%");
  if (e3) throw e3;
  console.log("Données de démonstration retirées.");
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant.");
  if (PURGE) return purge();
  if (LIVE_SEUL) {
    const vague = vagueLive();
    const { error } = await db.from("site_events").insert(vague);
    if (error) throw error;
    console.log(`${vague.length} événements posés sur les dix dernières minutes. « En direct » a de quoi montrer.`);
    return;
  }

  const events = [];
  const orders = [];
  let noCommande = 0;

  for (let j = JOURS - 1; j >= 0; j--) {
    // La fréquentation monte doucement : un tableau tout plat n'apprend rien.
    const tendance = 0.55 + (1 - j / JOURS) * 0.9;
    const visiteurs = Math.round(entier(26, 48) * tendance);

    for (let v = 0; v < visiteurs; v++) {
      const anon = `demo-${j}-${v}-${entier(1000, 9999)}`;
      const pays = pese(PAYS);
      const src = pese(SOURCES);
      const appareil = pick(APPAREILS);
      const t0 = instant(j);
      const at = (minutes) => new Date(t0.getTime() + minutes * 60000).toISOString();
      const base = {
        anon_id: anon,
        locale: pays.locale,
        country: pays.code,
        city: pays.ville,
        test: true,
      };
      const props = (extra = {}) => ({ seed: MARQUE, device: appareil, ...extra });

      // `landing: true` et `utm` en objet : c'est la forme que le site envoie
      // (voir lib/site-events.ts), et la seule que la tour de contrôle sait lire.
      events.push({ ...base, name: "page_view", path: "/", created_at: at(0), props: props({ landing: true, ref: src.ref, utm: src.utm }) });

      const profondeur = entier(1, 5);
      const vus = [];
      for (let p = 0; p < profondeur; p++) {
        const r = pese(REFLETS);
        if (!vus.includes(r.handle)) vus.push(r.handle);
        events.push({ ...base, name: "page_view", path: `/${pays.locale}/parfums/${r.handle}`, created_at: at(1 + p * 2), props: props() });
        events.push({ ...base, name: "product_view", path: `/${pays.locale}/parfums/${r.handle}`, created_at: at(1 + p * 2), props: props({ handle: r.handle }) });
        if (rnd() < 0.34) {
          events.push({ ...base, name: "audio_play", created_at: at(2 + p * 2), props: props({ kind: "portrait", id: r.handle, source: "page" }) });
          if (rnd() < 0.45) events.push({ ...base, name: "audio_complete", created_at: at(3 + p * 2), props: props({ kind: "portrait", id: r.handle }) });
        }
        if (rnd() < 0.18) events.push({ ...base, name: "menu_reflet", created_at: at(1 + p * 2), props: props({ handle: r.handle }) });
      }

      // Le guide : filtres, carte olfactive, accords. Sans ces gestes, les pages
      // Trafic et Luma restent vides alors que le reste est plein.
      if (rnd() < 0.22) {
        events.push({ ...base, name: "page_view", path: `/${pays.locale}/parfums/guide`, created_at: at(2), props: props() });
        const filtres = [
          ["when", pick(["day", "evening", "both"])],
          ["universe", pick(["boise", "gourmand", "floral", "cuir"])],
          ["materials", pick(["safran", "vanille", "rose", "cuir", "framboise"])],
        ];
        for (const [group, value] of filtres.slice(0, entier(1, 3))) {
          events.push({ ...base, name: "guide_filter", created_at: at(3), props: props({ group, value, on: true }) });
        }
        const r = pese(REFLETS);
        events.push({ ...base, name: "map_select", created_at: at(4), props: props({ handle: r.handle }) });
        if (rnd() < 0.3) events.push({ ...base, name: "map_pair", created_at: at(5), props: props({ handle: r.handle, other: pese(REFLETS).handle }) });
      }
      if (rnd() < 0.12) {
        const r = pese(REFLETS);
        events.push({ ...base, name: "accord_add", created_at: at(7), props: props({ handle: r.handle, source: "cart" }) });
      }

      // Entonnoir : ~24 % ajoutent au panier, ~55 % d'entre eux vont au paiement,
      // ~62 % de ceux-là paient vraiment. On atterrit vers 8 % de conversion.
      if (rnd() > 0.24 || vus.length === 0) continue;
      const achete = vus.slice(0, entier(1, Math.min(2, vus.length)));
      const avecCoffret = rnd() < 0.18;
      const lignes = achete.map((h) => {
        const r = REFLETS.find((x) => x.handle === h);
        return { handle: h, titre: r.titre, quantity: 1, price: r.prix, total: r.prix };
      });
      if (avecCoffret) lignes.push({ handle: COFFRET.handle, titre: COFFRET.titre, quantity: 1, price: COFFRET.prix, total: COFFRET.prix });
      const total = lignes.reduce((n, l) => n + l.total, 0);

      events.push({
        ...base,
        name: "add_to_cart",
        created_at: at(6 + profondeur * 2),
        props: props({ total, currency: "AED", handles: lignes.map((l) => l.handle), lines: lignes.map((l) => ({ handle: l.handle, quantity: l.quantity, amount: l.total })) }),
      });

      if (rnd() > 0.55) continue;
      events.push({ ...base, name: "checkout", created_at: at(9 + profondeur * 2), props: props({ total, currency: "AED", lines: lignes.map((l) => ({ handle: l.handle, quantity: l.quantity, amount: l.total })) }) });

      if (rnd() > 0.62) continue;
      const port = total >= 400 ? 0 : 25;
      const quand = new Date(t0.getTime() + (12 + profondeur * 2) * 60000).toISOString();
      orders.push({
        id: ID_BASE + noCommande++,
        name: `#D${1000 + noCommande}`,
        created_at: quand,
        processed_at: quand,
        test: true,
        financial_status: "paid",
        currency: "AED",
        total: total + port,
        subtotal: total,
        discounts: 0,
        shipping: port,
        country: pays.code,
        locale: pays.locale,
        source_name: "web",
        referring_site: src.ref ? new URL(src.ref).host : null,
        landing_site: src.utm ? `https://maisonreflet.com/?${new URLSearchParams(src.utm)}` : null,
        discount_codes: [],
        lines: lignes.map((l, i) => ({ variant_id: 1000 + i, product_id: 2000 + i, title: l.titre, handle: l.handle, quantity: l.quantity, price: l.price, total: l.total })),
        anon_id: anon,
      });
    }
  }

  events.push(...vagueLive());

  console.log(`${events.length} événements et ${orders.length} commandes à poser (${JOURS} jours).`);
  for (let i = 0; i < events.length; i += 500) {
    const { error } = await db.from("site_events").insert(events.slice(i, i + 500));
    if (error) throw error;
  }
  for (let i = 0; i < orders.length; i += 200) {
    const { error } = await db.from("shop_orders").upsert(orders.slice(i, i + 200));
    if (error) throw error;
  }
  await poserLuma(events);

  const ca = orders.reduce((n, o) => n + o.total, 0);
  console.log(`Posé. ${orders.length} commandes, ${Math.round(ca).toLocaleString("fr-FR")} AED, panier moyen ${Math.round(ca / orders.length)} AED.`);
  console.log("Tout est marqué test : cocher « données de test » dans la tour de contrôle pour les voir.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

/**
 * Des conversations Luma rattachées aux visiteurs déjà posés : la page Luma, les
 * Conversations et les Questions lisent ces tables et resteraient vides sinon.
 * Les questions sont celles que les gens posent vraiment sur une fiche, reprises
 * des pastilles du site.
 */
const DEMANDES = [
  ["Quelle différence avec Tuscan Leather ?", "Ultra Cuir en garde le cuir et la framboise, mais l'éclaire : un trio de safrans et une facette d'iris le rendent plus lumineux et moins fumé."],
  ["Pour quel moment le porter ?", "Le soir. Il prend de l'ampleur sur la peau chaude, et sa traîne tient jusqu'au lendemain sur les vêtements."],
  ["Lequel des six me correspond ?", "Dites-moi ce que vous portez aujourd'hui et je vous oriente. Si vous aimez les ambrés sucrés, Melting Mango ; si vous cherchez du caractère, Ultra Cuir."],
  ["C'est pour offrir, lequel choisir ?", "Le coffret découverte, sans hésiter : six Reflets à porter, et 160 AED d'avoir sur le flacon que la personne choisira."],
  ["Est-ce que ça tient longtemps ?", "Ce sont des eaux de parfum : huit heures et plus. Vaporisez sur les points chauds et sur le tissu pour la traîne."],
  ["Vos parfums sont-ils mixtes ?", "Les six. Nous composons pour un caractère, pas pour un genre."],
  ["Quelle différence avec Baccarat Rouge 540 ?", "Melting Mango en reprend le sillage sucré et ambré, avec une mangue plus franche et une mousse de chêne qui le sèche en fin de journée."],
  ["Je cherche quelque chose de frais pour la journée", "Fifth Season : mandarine et fruits exotiques au départ, vanille et musc en fond. Il accompagne une journée entière sans peser."],
];

async function poserLuma(events) {
  const anons = [...new Set(events.filter((e) => e.name === "product_view").map((e) => e.anon_id))];
  const sessions = [];
  const messages = [];
  const signaux = [];
  for (const anon of anons) {
    if (rnd() > 0.16) continue;
    const src = events.find((e) => e.anon_id === anon);
    const id = randomUUID();
    const debut = new Date(new Date(src.created_at).getTime() + entier(2, 9) * 60000);
    sessions.push({
      id,
      anon_id: anon,
      locale: src.locale,
      country: src.country,
      currency: "AED",
      created_at: debut.toISOString(),
      last_seen_at: new Date(debut.getTime() + entier(2, 14) * 60000).toISOString(),
      test: true,
    });
    const tours = entier(1, 3);
    for (let t = 0; t < tours; t++) {
      const [q, a] = DEMANDES[Math.floor(rnd() * DEMANDES.length)];
      const at = new Date(debut.getTime() + t * 90000);
      messages.push({ session_id: id, role: "user", content: q, created_at: at.toISOString() });
      messages.push({
        session_id: id,
        role: "assistant",
        content: a,
        model: "claude-opus-5",
        tokens_in: entier(600, 1400),
        tokens_out: entier(80, 260),
        created_at: new Date(at.getTime() + 4000).toISOString(),
      });
    }
    if (rnd() < 0.6) {
      const r = pese(REFLETS);
      signaux.push({
        session_id: id,
        recommended_handle: r.handle,
        alternative_handle: pese(REFLETS).handle,
        for_whom: pick(["pour moi", "pour offrir"]),
        occasion: pick(["tous les jours", "le soir", "un mariage", "un cadeau"]),
        wears_today: pick(["Tuscan Leather", "Baccarat Rouge 540", "Oud Maracuja", "rien de précis"]),
      });
    }
  }
  if (!sessions.length) return;
  for (let i = 0; i < sessions.length; i += 200) {
    const { error } = await db.from("luma_sessions").insert(sessions.slice(i, i + 200));
    if (error) throw error;
  }
  for (let i = 0; i < messages.length; i += 400) {
    const { error } = await db.from("luma_messages").insert(messages.slice(i, i + 400));
    if (error) throw error;
  }
  for (let i = 0; i < signaux.length; i += 200) {
    const { error } = await db.from("luma_profile_signals").insert(signaux.slice(i, i + 200));
    if (error) throw error;
  }
  console.log(`${sessions.length} conversations Luma, ${messages.length} messages, ${signaux.length} profils.`);
}

/** Une poignée de visiteurs sur les dix dernières minutes, pour « En direct ». */
function vagueLive() {
  const maintenant = Date.now();
  const out = [];
  for (let v = 0; v < 9; v++) {
    const pays = pese(PAYS);
    const anon = `demo-live-${v}-${entier(1000, 9999)}`;
    const base = { anon_id: anon, locale: pays.locale, country: pays.code, city: pays.ville, test: true };
    const props = (extra = {}) => ({ seed: MARQUE, device: pick(APPAREILS), ...extra });
    // Réparti sur les huit dernières minutes : une vague toute en même temps se
    // vide d'un coup et la page clignote.
    const ilYA = (min) => new Date(maintenant - min * 60000).toISOString();
    const r = pese(REFLETS);
    const srcLive = pese(SOURCES);
    out.push({ ...base, name: "page_view", path: "/", created_at: ilYA(entier(5, 8)), props: props({ landing: true, ref: srcLive.ref, utm: srcLive.utm }) });
    out.push({ ...base, name: "page_view", path: `/${pays.locale}/parfums/${r.handle}`, created_at: ilYA(entier(2, 4)), props: props() });
    out.push({ ...base, name: "product_view", path: `/${pays.locale}/parfums/${r.handle}`, created_at: ilYA(entier(1, 3)), props: props({ handle: r.handle }) });
    if (v < 4) {
      out.push({
        ...base,
        name: "add_to_cart",
        created_at: ilYA(entier(0, 2)),
        props: props({ total: r.prix, currency: "AED", handles: [r.handle], lines: [{ handle: r.handle, quantity: 1, amount: r.prix }] }),
      });
    }
    if (v < 2) out.push({ ...base, name: "checkout", created_at: ilYA(0), props: props({ total: r.prix, currency: "AED", lines: [{ handle: r.handle, quantity: 1, amount: r.prix }] }) });
  }
  return out;
}
