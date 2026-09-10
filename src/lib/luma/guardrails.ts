/**
 * Garde-fous de sortie — « Ce qu'elle ne dit jamais », section 7 du persona.
 *
 * Vérification APRÈS génération, côté serveur. Une sortie qui déclenche un
 * interdit est régénérée avec un rappel ; à la récidive, elle est remplacée par
 * une réponse de secours. Le modèle n'est jamais le dernier rempart sur des
 * règles de marque : celles-ci se vérifient par du code.
 *
 * Deux principes de construction :
 *
 * 1. **Aucun mot n'est ajouté à la liste de Sandro.** Les motifs ci-dessous ne
 *    couvrent que la section 7, traduite en anglais et en arabe puisque Luma
 *    parle trois langues alors que la section est écrite en français.
 *
 * 2. **Les faux positifs coûtent cher.** Un interdit qui se déclenche à tort
 *    fait régénérer une bonne réponse, donc double la latence et le coût. D'où
 *    des limites de mots et des exclusions explicites : « offre » est interdit,
 *    « livraison offerte » est une réassurance officielle ; « code » n'est
 *    traqué qu'accolé à une remise, parce que « les codes de courtoisie du
 *    Golfe » est du vocabulaire de marque.
 */

export type Violation = {
  /** Famille d'interdit, pour le rappel envoyé au modèle à la régénération. */
  rule: string;
  /** Extrait fautif, tel qu'il apparaît dans la sortie. */
  match: string;
};

type Pattern = { rule: string; re: RegExp };

/**
 * Construit un motif à frontières de mots UNICODE.
 *
 * `\b` de JavaScript ne connaît que l'ASCII : entre l'apostrophe et le « é »
 * de « l'équivalent », il ne voit aucune frontière, puisque ni l'un ni l'autre
 * n'est un caractère de mot à ses yeux. `/\béquivalent\b/` ne trouvait donc
 * rien — un interdit majeur passait, et le même piège guettait « à fraction du
 * prix » et tout motif arabe. `\p{L}` et `\p{N}`, eux, couvrent les trois
 * alphabets du site.
 */
function w(pattern: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * « Son verbe est découvrir. » Le vocabulaire d'achat est interdit à Luma —
 * c'est l'interface qui porte le bouton, pas elle.
 */
const CART_VOCABULARY: Pattern[] = [
  { rule: "verbe d'achat", re: w(`ajouter au panier`) },
  { rule: "verbe d'achat", re: w(`add to (?:cart|bag)`) },
  { rule: "verbe d'achat", re: w(`achet(?:er|ez)`) },
  { rule: "verbe d'achat", re: w(`buy now`) },
  { rule: "verbe d'achat", re: w(`أضف إلى (?:السلة|الحقيبة)`) },
];

/**
 * Le cœur du positionnement : un Reflet réinterprète, il ne copie pas. C'est
 * l'interdit le plus coûteux si on le laisse passer — il transforme la marque
 * en marque de dupes.
 */
const COPY_VOCABULARY: Pattern[] = [
  { rule: "vocabulaire de copie", re: w(`copie[sr]?`) },
  { rule: "vocabulaire de copie", re: w(`dupes?`) },
  { rule: "vocabulaire de copie", re: w(`clones?`) },
  { rule: "vocabulaire de copie", re: w(`équivalent(?:e|s|es)?`) },
  { rule: "vocabulaire de copie", re: w(`le m[êe]me que`) },
  { rule: "vocabulaire de copie", re: w(`pareil(?:le|s)?`) },
  { rule: "vocabulaire de copie", re: w(`cop(?:y|ies|ycat)`) },
  { rule: "vocabulaire de copie", re: w(`same as`) },
  { rule: "vocabulaire de copie", re: w(`identical to`) },
  { rule: "vocabulaire de copie", re: w(`knock-?off`) },
  { rule: "vocabulaire de copie", re: w(`تقليد|نسخة طبق الأصل`) },
];

/**
 * « Elle parle de ce que le Reflet apporte, pas de ce qu'il coûte de moins » —
 * y compris quand le visiteur fait la comparaison lui-même.
 */
const PRICE_COMPARISON: Pattern[] = [
  { rule: "comparaison de prix", re: w(`moins ch(?:er|ère|ers|ères)`) },
  { rule: "comparaison de prix", re: w(`cheaper`) },
  { rule: "comparaison de prix", re: w(`fraction of the price`) },
  { rule: "comparaison de prix", re: w(`à (?:une )?fraction du prix`) },
  { rule: "comparaison de prix", re: w(`أرخص`) },
];

/**
 * « La Maison ne pratique pas de remise. » « offre » est traqué comme nom
 * commercial ; « offerte » et « offerts », qui portent les réassurances du
 * site, sont hors motif par construction (frontière de mot).
 */
const DISCOUNT_VOCABULARY: Pattern[] = [
  { rule: "vocabulaire promotionnel", re: w(`promotions?`) },
  { rule: "vocabulaire promotionnel", re: w(`promos?`) },
  { rule: "vocabulaire promotionnel", re: w(`remises?`) },
  { rule: "vocabulaire promotionnel", re: w(`offres?`) },
  { rule: "vocabulaire promotionnel", re: w(`soldes?`) },
  { rule: "vocabulaire promotionnel", re: w(`(?:discount|promo|coupon) code`) },
  { rule: "vocabulaire promotionnel", re: w(`code (?:promo|de r[ée]duction|de remise)`) },
  { rule: "vocabulaire promotionnel", re: w(`discounts?`) },
  { rule: "vocabulaire promotionnel", re: w(`sale`) },
  { rule: "vocabulaire promotionnel", re: w(`خصم|كود الخصم`) },
];

/** « Elle distingue, elle ne classe pas. » */
const RANKING: Pattern[] = [
  { rule: "classement", re: w(`meilleur(?:e|s|es)? que`) },
  { rule: "classement", re: w(`better than`) },
  { rule: "classement", re: w(`sup[ée]rieur(?:e|s|es)? [àa]`) },
  { rule: "classement", re: w(`أفضل من`) },
];

/** « Je suis la conseillère de la Maison. » Pas plus. */
const AI_DISCLOSURE: Pattern[] = [
  { rule: "révélation d'IA", re: w(`je suis une (?:ia|intelligence artificielle)`) },
  { rule: "révélation d'IA", re: w(`en tant qu'(?:assistant|ia|intelligence)`) },
  { rule: "révélation d'IA", re: w(`(?:i am|i'm) an? (?:ai|artificial intelligence|assistant)`) },
  { rule: "révélation d'IA", re: w(`as an? (?:ai|assistant|language model)`) },
  { rule: "révélation d'IA", re: w(`mod[èe]le de langage`) },
  { rule: "révélation d'IA", re: w(`أنا ذكاء اصطناعي`) },
];

/**
 * « Une tenue en heures » : la donnée n'existe nulle part, donc tout chiffre
 * d'heures est une invention. C'est la question numéro un au Golfe, donc celle
 * qu'on est le plus tenté d'inventer.
 */
const UNDOCUMENTED_LONGEVITY: Pattern[] = [
  { rule: "tenue inventée", re: w(`\\d{1,2}\\s?(?:h|heures?|hours?)`) },
  { rule: "tenue inventée", re: w(`(?:tient|dure|lasts?)\\s+(?:environ\\s+)?\\d`) },
  { rule: "tenue inventée", re: w(`\\d{1,2}\\s?ساعات?`) },
];

/** Ni fournisseur, ni parfumeur, ni laboratoire — même quand le site en parle. */
const SUPPLIER_NAMES: Pattern[] = [
  { rule: "nom de fournisseur ou parfumeur", re: w(`symrise`) },
  { rule: "nom de fournisseur ou parfumeur", re: w(`givaudan`) },
  { rule: "nom de fournisseur ou parfumeur", re: w(`firmenich`) },
  { rule: "nom de fournisseur ou parfumeur", re: w(`iff`) },
  { rule: "nom de fournisseur ou parfumeur", re: w(`mane`) },
  { rule: "nom de fournisseur ou parfumeur", re: w(`robertet`) },
  { rule: "nom de fournisseur ou parfumeur", re: w(`takasago`) },
  { rule: "nom de fournisseur ou parfumeur", re: w(`laboratoire`) },
];

const TEXT_PATTERNS: Pattern[] = [
  ...CART_VOCABULARY,
  ...COPY_VOCABULARY,
  ...PRICE_COMPARISON,
  ...DISCOUNT_VOCABULARY,
  ...RANKING,
  ...AI_DISCLOSURE,
  ...UNDOCUMENTED_LONGEVITY,
  ...SUPPLIER_NAMES,
];

/**
 * Emoji : plages Unicode plutôt que `\p{Emoji}`, qui marque aussi les chiffres
 * et le signe dièse comme émoji et ferait échouer « 320 AED ».
 */
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

/**
 * Trois capitales ou plus : l'emphase interdite. Les sigles connus sont admis.
 *
 * `\p{Lu}` et non `[A-ZÀ-Ÿ]` : cette plage court de U+00C0 à U+0178 et englobe
 * donc les minuscules accentuées, si bien que « été » aurait pu passer pour un
 * cri.
 */
const SHOUTING = /(?<![\p{L}])\p{Lu}{3,}(?![\p{L}])/gu;
const ALLOWED_UPPERCASE = new Set(["AED", "SAR", "EUR", "GBP", "CHF", "USD", "ML", "EDP", "CPO"]);

/**
 * Vérifie une sortie de Luma. Retourne la liste des infractions, vide si tout
 * va bien. Ne modifie rien : la décision de régénérer appartient à l'appelant.
 */
export function checkOutput(text: string): Violation[] {
  const violations: Violation[] = [];

  for (const { rule, re } of TEXT_PATTERNS) {
    // `lastIndex` doit repartir de zéro : ces expressions sont globales et
    // partagées entre appels.
    re.lastIndex = 0;
    const found = text.match(re);
    if (found) {
      for (const match of new Set(found)) violations.push({ rule, match });
    }
  }

  if (EMOJI.test(text)) {
    violations.push({ rule: "emoji", match: text.match(EMOJI)?.[0] ?? "" });
  }

  // Le point d'exclamation est interdit, y compris en arabe.
  if (/[!！]/.test(text)) {
    violations.push({ rule: "point d'exclamation", match: "!" });
  }

  for (const word of text.match(SHOUTING) ?? []) {
    if (!ALLOWED_UPPERCASE.has(word)) {
      violations.push({ rule: "majuscules d'emphase", match: word });
    }
  }

  return violations;
}

/**
 * Contexte de délai : ce qui suit un chiffre et en fait une promesse.
 *
 * La section 7 interdit « un délai de livraison qui n'est pas dans Sanity ou
 * Shopify », et aucun n'y est renseigné — tout chiffre de jours est donc une
 * invention, quelle que soit sa taille. Les heures sont déjà couvertes par
 * `UNDOCUMENTED_LONGEVITY`.
 */
const DELAY_CONTEXT =
  /\d+\s*(?:à|-|–|et)?\s*\d*\s*(?:jours?|jour ouvré|ouvrés?|ouvrables?|semaines?|mois|days?|business days?|weeks?|months?|أيام|يوم|أسابيع|أسبوع)/giu;

/** Contexte de stock : « il ne reste que N », « N en stock ». */
const STOCK_CONTEXT =
  /(?:reste[nt]?\s+(?:que\s+)?|en stock\s*:?\s*|only\s+)\d+|\d+\s*(?:en stock|left|in stock|flacons? restants?)/giu;

/**
 * Vérifie que tout nombre de la sortie vient d'une source connue.
 *
 * « Aucun chiffre qui ne vienne d'une fiche ou de la FAQ. » Deux filets :
 *
 * 1. **Le contexte** — un chiffre accolé à des jours, des semaines ou du stock
 *    est fautif quelle que soit sa valeur. C'est ce qui rattrape « comptez 3 à
 *    5 jours ouvrés », qu'un simple seuil de grandeur laissait passer alors que
 *    c'est précisément l'invention la plus probable.
 *
 * 2. **La grandeur** — au-delà de 100, tout nombre doit figurer dans `allowed`.
 *    En dessous, les nombres comptent des notes, des parfums ou des
 *    millilitres (« 6 × 2 ml », « les six Reflets ») et les traquer ferait
 *    régénérer presque chaque réponse.
 *
 * `allowed` doit contenir les prix lus dans Shopify ET les nombres qui vivent
 * dans les noms de référence — « Baccarat Rouge 540 » est un nom, pas un
 * chiffre inventé, et Luma a le droit de le citer. `allowedNumbers()` de
 * `knowledge.ts` s'en charge.
 */
export function checkNumbers(text: string, allowed: number[]): Violation[] {
  const permitted = new Set(allowed.map((n) => String(n)));
  const violations: Violation[] = [];

  for (const [re, rule] of [
    [DELAY_CONTEXT, "délai non sourcé"],
    [STOCK_CONTEXT, "stock non sourcé"],
  ] as const) {
    re.lastIndex = 0;
    for (const match of new Set(text.match(re) ?? [])) {
      violations.push({ rule, match: match.trim() });
    }
  }

  for (const raw of text.match(/\d[\d\s.,]*/g) ?? []) {
    // « 2 200 AED » s'écrit avec une espace : on la retire avant de comparer,
    // sinon chaque prix du site passerait pour un chiffre inventé.
    const normalised = raw.replace(/[\s,]/g, "").replace(/\.$/, "");
    const value = Number(normalised);
    if (!Number.isFinite(value) || value < 100) continue;
    if (permitted.has(String(value))) continue;
    violations.push({ rule: "chiffre non sourcé", match: raw.trim() });
  }

  return violations;
}

/**
 * Rappel injecté à la régénération. Nommer la règle enfreinte plutôt que de
 * relancer à l'identique : une relance nue reproduit souvent la même faute.
 */
export function reminderFor(violations: Violation[]): string {
  const rules = [...new Set(violations.map((v) => v.rule))];
  const quoted = violations.map((v) => `« ${v.match} »`).join(", ");
  return (
    `Ta réponse précédente enfreignait la section 7 du persona sur ces points : ${rules.join(", ")} — ` +
    `${quoted}. Reformule sans ces éléments, en gardant le même fond. ` +
    `Rappel : ton verbe est « découvrir » ; un Reflet réinterprète et enrichit, ` +
    `il ne copie pas ; la Maison ne pratique pas de remise ; tu ne classes pas ; ` +
    `tu n'annonces aucune tenue en heures, cette donnée n'existe pas.`
  );
}
