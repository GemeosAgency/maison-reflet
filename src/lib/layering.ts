/**
 * Le layering — deux Reflets portés ensemble, usage quotidien dans le Golfe.
 *
 * Les duos doivent sortir du nez, pas de nous : ceux-ci sont des CANDIDATS,
 * proposés le 12 septembre 2026 d'après les ponts de matières (le safran dans
 * quatre Reflets sur six, le cuir dans deux, la vanille Bourbon dans deux, le
 * jasmin sambac dans deux), et posés sur staging pour que le nez réagisse sur
 * du concret. `status: "candidate"` affiche un repère « à valider » ; passer à
 * `"validated"` quand le nez a tranché — et supprimer ceux qu'il refuse.
 *
 * Luma ne propose que ces duos-là (jamais d'autres), et dit qu'ils sont en
 * cours de validation tant qu'ils le sont.
 */
import type { Locale } from "../i18n";

export type LayeringStatus = "candidate" | "validated";

export type LayeringDuo = {
  /** Les deux Reflets, le premier est celui qu'on pose en premier. */
  pair: [string, string];
  status: LayeringStatus;
  name: Record<Locale, string>;
  /** Ce que le duo raconte, une phrase. */
  story: Record<Locale, string>;
  /** Le geste : lequel en premier, où. */
  gesture: Record<Locale, string>;
};

export const LAYERING: LayeringDuo[] = [
  {
    pair: ["minuit-bourbon", "ultra-cuir"],
    status: "candidate",
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
  },
  {
    pair: ["bois-alert", "fifth-season"],
    status: "candidate",
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
  },
  {
    pair: ["new-oud", "melting-mango"],
    status: "candidate",
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
  },
];

/** Les duos qui incluent ce Reflet, avec le partenaire en clair. */
export function duosFor(handle: string): { duo: LayeringDuo; partner: string; first: boolean }[] {
  return LAYERING.filter((d) => d.pair.includes(handle)).map((duo) => ({
    duo,
    partner: duo.pair[0] === handle ? duo.pair[1] : duo.pair[0],
    first: duo.pair[0] === handle,
  }));
}
