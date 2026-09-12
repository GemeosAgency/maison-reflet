/**
 * Le layering — deux Reflets portés ensemble, usage quotidien dans le Golfe.
 *
 * Les duos sortent du nez, pas de nous : proposés le 12 septembre 2026 d'après
 * les ponts de matières (le safran dans quatre Reflets sur six, le cuir dans
 * deux, la vanille Bourbon dans deux, le jasmin sambac dans deux), puis
 * VALIDÉS par le parfumeur le jour même (Sandro : « Notre parfumeur a validé
 * tes layering »). Un futur duo repasse par `status: "candidate"` (repère
 * « à valider » à l'écran, Luma le dit) jusqu'à ce que le nez tranche.
 *
 * `recommendation` est la version parlée — « La recommandation du parfumeur »,
 * lue par la voix des portraits (Luma relaie le parfumeur), fichiers statiques
 * public/luma/voice/{langue}/accords/{id}.mp3 générés par
 * scripts/luma-voice-accords.mjs. Les indications entre crochets sont pour le
 * modèle v3 d'ElevenLabs ; stripTags() en donne le texte à lire.
 *
 * Luma ne propose que ces duos-là, jamais d'autres.
 */
import type { Locale } from "../i18n";

export type LayeringStatus = "candidate" | "validated";

export type LayeringDuo = {
  /** Identifiant stable (nom de fichier audio, ancre). */
  id: string;
  /** Les deux Reflets, le premier est celui qu'on pose en premier. */
  pair: [string, string];
  status: LayeringStatus;
  name: Record<Locale, string>;
  /** Ce que le duo raconte, une phrase. */
  story: Record<Locale, string>;
  /** Le geste : lequel en premier, où. */
  gesture: Record<Locale, string>;
  /** La recommandation du parfumeur, parlée (balises v3 entre crochets). */
  recommendation: Record<Locale, string>;
};

export const LAYERING: LayeringDuo[] = [
  {
    id: "cuir-gourmand",
    pair: ["minuit-bourbon", "ultra-cuir"],
    status: "validated",
    name: { fr: "Cuir gourmand", en: "Gourmand leather", ar: "جلدٌ شهي" },
    story: {
      fr: "Le cuir et le safran d'Ultra Cuir sur la tonka et la vanille de Minuit Bourbon : un cuir gourmand pour le soir.",
      en: "Ultra Cuir's leather and saffron over Minuit Bourbon's tonka and vanilla: a gourmand leather for the evening.",
      ar: "جلد أولترا كوير وزعفرانه فوق تونكا مينوي بوربون وفانيليّته: جلدٌ شهي للمساء.",
    },
    gesture: {
      fr: "Minuit Bourbon d'abord, sur la peau ; Ultra Cuir ensuite, une pression sur les vêtements.",
      en: "Minuit Bourbon first, on the skin; then Ultra Cuir, one spray on clothing.",
      ar: "مينوي بوربون أولًا على البشرة؛ ثم أولترا كوير، رشّة واحدة على الملابس.",
    },
    recommendation: {
      fr: "[warmly] La recommandation de notre parfumeur pour le soir : Minuit Bourbon d'abord, sur la peau — la fève tonka, la vanille Bourbon, cette chaleur qui reste. [inhales] Puis Ultra Cuir, une seule pression, sur les vêtements. [exhales] Le cuir et le safran viennent se poser dessus, et vous avez un cuir gourmand, profond, qui vous suit toute la soirée.",
      en: "[warmly] Our perfumer's recommendation for the evening: Minuit Bourbon first, on the skin — tonka bean, Bourbon vanilla, that warmth that stays. [inhales] Then Ultra Cuir, a single spray, on your clothes. [exhales] The leather and the saffron settle over it, and you get a gourmand leather, deep, that follows you all evening.",
      ar: "[warmly] توصية عطّارنا للمساء: مينوي بوربون أولًا على البشرة — حبوب التونكا، فانيليا بوربون، تلك الدفأة التي تبقى. [inhales] ثم أولترا كوير، رشّة واحدة على الملابس. [exhales] يستقر الجلد والزعفران فوقها، فتحصلون على جلدٍ شهيّ، عميق، يرافقكم طوال المساء.",
    },
  },
  {
    id: "boise-solaire",
    pair: ["bois-alert", "fifth-season"],
    status: "validated",
    name: { fr: "Boisé solaire", en: "Sunlit woods", ar: "أخشاب مشمسة" },
    story: {
      fr: "Le safran et le jasmin sambac qu'ils partagent font le pont : le boisé net qui tient, le fruité solaire qui éclaire. Du matin au soir.",
      en: "The saffron and sambac jasmine they share build the bridge: the clean woods that hold, the sunny fruit that lights it up. From morning to night.",
      ar: "الزعفران وياسمين سامباك المشتركان بينهما يصنعان الجسر: أخشاب نقية تثبت، وفاكهة مشمسة تضيء. من الصباح إلى المساء.",
    },
    gesture: {
      fr: "Bois Alert d'abord, cou et poignets ; Fifth Season par-dessus, léger, le matin.",
      en: "Bois Alert first, neck and wrists; Fifth Season over it, lightly, in the morning.",
      ar: "بوا ألِرت أولًا على العنق والمعصمين؛ فيفث سيزن فوقه بخفّة، صباحًا.",
    },
    recommendation: {
      fr: "[upbeat] La recommandation de notre parfumeur pour la journée : Bois Alert d'abord, cou et poignets — le boisé net, le safran, le jasmin sambac. [inhales] Puis Fifth Season par-dessus, léger, le matin. [exhales] Les deux partagent le safran et le jasmin, alors ils se répondent : le bois tient, le fruit solaire éclaire. Du matin au soir, sans rien forcer.",
      en: "[upbeat] Our perfumer's recommendation for the day: Bois Alert first, neck and wrists — clean woods, saffron, sambac jasmine. [inhales] Then Fifth Season over it, lightly, in the morning. [exhales] They share the saffron and the jasmine, so they answer each other: the woods hold, the sunlit fruit lights it up. Morning to night, without forcing anything.",
      ar: "[upbeat] توصية عطّارنا للنهار: بوا ألِرت أولًا على العنق والمعصمين — أخشاب نقية، زعفران، ياسمين سامباك. [inhales] ثم فيفث سيزن فوقه بخفّة، صباحًا. [exhales] يتشاركان الزعفران والياسمين فيتجاوبان: الخشب يثبت، والفاكهة المشمسة تضيء. من الصباح إلى المساء، من دون تكلّف.",
    },
  },
  {
    id: "oud-fruite",
    pair: ["new-oud", "melting-mango"],
    status: "validated",
    name: { fr: "Oud fruité", en: "Fruity oud", ar: "عودٌ فاكهي" },
    story: {
      fr: "Safran, fruits vibrants et rose : la mangue de Melting Mango ouvre l'oud de New Oud sans l'alourdir. Très Golfe, sans lourdeur.",
      en: "Saffron, vibrant fruit and rose: Melting Mango's mango opens New Oud's oud without weighing it down. Very Gulf, never heavy.",
      ar: "زعفران وفواكه نابضة وورد: مانجو ميلتينغ مانغو تفتح عود نيو عود دون أن تُثقله. خليجيٌّ جدًا، من دون ثِقَل.",
    },
    gesture: {
      fr: "New Oud d'abord, sur la peau ; Melting Mango ensuite, une pression sur le col.",
      en: "New Oud first, on the skin; then Melting Mango, one spray on the collar.",
      ar: "نيو عود أولًا على البشرة؛ ثم ميلتينغ مانغو، رشّة واحدة على الياقة.",
    },
    recommendation: {
      fr: "[warmly] La recommandation de notre parfumeur, très Golfe : New Oud d'abord, sur la peau — l'oud, la rose de Taïf, le safran. [inhales] Puis Melting Mango, une pression sur le col. [exhales] La mangue ouvre l'oud, le rend lumineux, jamais lourd. Un oud fruité qu'on porte le soir — et qu'on vous demandera.",
      en: "[warmly] Our perfumer's recommendation, very Gulf: New Oud first, on the skin — oud, Taif rose, saffron. [inhales] Then Melting Mango, one spray on the collar. [exhales] The mango opens the oud, makes it luminous, never heavy. A fruity oud you wear in the evening — and people will ask about it.",
      ar: "[warmly] توصية عطّارنا، خليجية جدًا: نيو عود أولًا على البشرة — العود، ورد الطائف، الزعفران. [inhales] ثم ميلتينغ مانغو، رشّة واحدة على الياقة. [exhales] المانجو تفتح العود وتجعله مضيئًا، لا ثقيلًا أبدًا. عودٌ فاكهي يُلبَس في المساء — وسيسألونكم عنه.",
    },
  },
];

/** Le script sans ses indications entre crochets : le texte à lire pour qui n'écoute pas. */
export function stripVoiceTags(script: string): string {
  return script.replace(/\[[^\]]{1,40}\]/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Le fichier audio de la recommandation, généré par scripts/luma-voice-accords.mjs. */
export function accordAudioPath(locale: Locale, id: string): string | null {
  const duo = LAYERING.find((d) => d.id === id);
  return duo?.recommendation[locale] ? `/luma/voice/${locale}/accords/${id}.mp3` : null;
}

/** Les duos qui incluent ce Reflet, avec le partenaire en clair. */
export function duosFor(handle: string): { duo: LayeringDuo; partner: string; first: boolean }[] {
  return LAYERING.filter((d) => d.pair.includes(handle)).map((duo) => ({
    duo,
    partner: duo.pair[0] === handle ? duo.pair[1] : duo.pair[0],
    first: duo.pair[0] === handle,
  }));
}
