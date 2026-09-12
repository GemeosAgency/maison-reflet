/**
 * Le contenu de la page guide « Les 6 Reflets côte à côte » et de la ligne
 * twist du panneau d'achat — dans les trois langues, en dur, parce que Sanity
 * n'a ni les traductions des matières ni ces textes (décision Sandro,
 * 12 septembre 2026 : construire d'abord, passer dans Sanity quand ça se
 * stabilise). Les univers viennent de lib/universes.ts, les références
 * (« inspiré de ») de Sanity via inspiredBy.
 *
 * Vocabulaire : « inspiré de » et « twist », jamais celui de la copie — la
 * Maison parle d'elle-même (persona, Kapferer).
 */
import type { Locale } from "../i18n";

export type L10n = Record<Locale, string>;

export type GuideReflet = {
  /** Trois matières signature, dans l'ordre où on les sent. */
  materials: [L10n, L10n, L10n];
  /** Le moment où le porter, une ligne. */
  moment: L10n;
  /** Ce que la référence a de grand, ce que le Reflet y ajoute — une phrase. */
  twistLine: L10n;
  /** Le twist en quelques mots, pour le panneau d'achat : « notre twist : … ». */
  twistShort: L10n;
};

export const GUIDE_REFLETS: Record<string, GuideReflet> = {
  "bois-alert": {
    materials: [
      { fr: "Safran", en: "Saffron", ar: "زعفران" },
      { fr: "Jasmin sambac", en: "Sambac jasmine", ar: "ياسمين سامباك" },
      { fr: "Cèdre", en: "Cedarwood", ar: "خشب الأرز" },
    ],
    moment: { fr: "Du matin au soir", en: "From morning to night", ar: "من الصباح إلى المساء" },
    twistLine: {
      fr: "Bois Impérial a fait du boisé une signature nette. Bois Alert y ajoute le safran, le jasmin et une mousse sucrée : la profondeur et le sillage.",
      en: "Bois Impérial made woods a clean signature. Bois Alert adds saffron, jasmine and a sweet moss: depth and trail.",
      ar: "بوا أمبريال جعل الأخشاب توقيعًا نقيًا. بوا ألِرت يضيف الزعفران والياسمين وطحلبًا حلوًا: العمق والأثر.",
    },
    twistShort: {
      fr: "le safran, le jasmin et une mousse sucrée pour la profondeur",
      en: "saffron, jasmine and a sweet moss for depth",
      ar: "الزعفران والياسمين وطحلب حلو من أجل العمق",
    },
  },
  "new-oud": {
    materials: [
      { fr: "Fruit de la passion", en: "Passion fruit", ar: "فاكهة الباشن" },
      { fr: "Rose de Taïf", en: "Taif rose", ar: "ورد الطائف" },
      { fr: "Oud", en: "Oud", ar: "عود" },
    ],
    moment: { fr: "Le soir, les grandes occasions", en: "Evenings and grand occasions", ar: "المساء والمناسبات الكبيرة" },
    twistLine: {
      fr: "Oud Maracuja a ouvert l'oud au fruit. New Oud y met la rose de Taïf, un santal crémeux et des fleurs blanches : un oud qui respire.",
      en: "Oud Maracuja opened oud to fruit. New Oud brings Taif rose, creamy sandalwood and white florals: an oud that breathes.",
      ar: "عود ماراكوجا فتح العود على الفاكهة. نيو عود يضيف ورد الطائف وصندلًا كريميًا وأزهارًا بيضاء: عودٌ يتنفّس.",
    },
    twistShort: {
      fr: "la rose de Taïf, un santal crémeux et des fleurs blanches",
      en: "Taif rose, creamy sandalwood and white florals",
      ar: "ورد الطائف وصندل كريمي وأزهار بيضاء",
    },
  },
  "melting-mango": {
    materials: [
      { fr: "Mangue", en: "Mango", ar: "مانجو" },
      { fr: "Safran", en: "Saffron", ar: "زعفران" },
      { fr: "Mousse de chêne", en: "Oakmoss", ar: "طحلب البلوط" },
    ],
    moment: { fr: "Le jour, les fins d'après-midi", en: "Daytime, late afternoons", ar: "النهار وأواخر العصر" },
    twistLine: {
      fr: "Baccarat Rouge 540 a la signature ambrée la plus reconnaissable qui soit. Melting Mango y verse une surdose de mangue : l'ouverture juteuse que l'original n'a pas.",
      en: "Baccarat Rouge 540 owns the most recognisable ambery signature there is. Melting Mango pours in an overdose of mango: the juicy opening the original never had.",
      ar: "باكارا روج 540 يملك أشهر توقيع عنبري على الإطلاق. ميلتينغ مانغو يصبّ فيه جرعة مفرطة من المانجو: الافتتاحية العصيرة التي لم تكن للأصل.",
    },
    twistShort: {
      fr: "une surdose de mangue, l'ouverture juteuse que l'original n'a pas",
      en: "an overdose of mango, the juicy opening the original never had",
      ar: "جرعة مفرطة من المانجو، الافتتاحية العصيرة التي لم تكن للأصل",
    },
  },
  "ultra-cuir": {
    materials: [
      { fr: "Framboise", en: "Raspberry", ar: "توت العليق" },
      { fr: "Safran", en: "Saffron", ar: "زعفران" },
      { fr: "Cuir", en: "Leather", ar: "جلد" },
    ],
    moment: { fr: "Le soir", en: "Evenings", ar: "المساء" },
    twistLine: {
      fr: "Tuscan Leather a imposé le cuir fruité. Ultra Cuir le rend plus lumineux : une framboise plus vive, un trio de safrans, une facette d'iris.",
      en: "Tuscan Leather set the fruity leather standard. Ultra Cuir makes it brighter: a livelier raspberry, a trio of saffrons, a facet of orris.",
      ar: "توسكان ليذر رسّخ الجلد الفاكهي. أولترا كوير يجعله أكثر إشراقًا: توت عليق أكثر حيوية، ثلاثية من الزعفران، ولمسة سوسن.",
    },
    twistShort: {
      fr: "une framboise plus vive, un trio de safrans, une facette d'iris",
      en: "a livelier raspberry, a trio of saffrons, a facet of orris",
      ar: "توت عليق أكثر حيوية، ثلاثية من الزعفران، ولمسة سوسن",
    },
  },
  "minuit-bourbon": {
    materials: [
      { fr: "Cardamome", en: "Cardamom", ar: "هيل" },
      { fr: "Fève tonka", en: "Tonka bean", ar: "حبوب التونكا" },
      { fr: "Cuir", en: "Leather", ar: "جلد" },
    ],
    moment: { fr: "Le soir, les nuits fraîches", en: "Evenings and cooler nights", ar: "المساء والليالي الباردة" },
    twistLine: {
      fr: "Althaïr a fait de la vanille une gourmandise chic. Minuit Bourbon la tient par un accord cuir et l'éclaire de fleur d'oranger et de lavande.",
      en: "Althaïr turned vanilla into a chic indulgence. Minuit Bourbon holds it with a leather accord and lights it with orange blossom and lavender.",
      ar: "ألتير جعل الفانيليا شهوةً أنيقة. مينوي بوربون يشدّها بأكورد جلدي ويضيئها بزهر البرتقال والخزامى.",
    },
    twistShort: {
      fr: "un accord cuir sous la vanille, éclairé de fleur d'oranger et de lavande",
      en: "a leather accord beneath the vanilla, lit with orange blossom and lavender",
      ar: "أكورد جلدي تحت الفانيليا، مضاءٌ بزهر البرتقال والخزامى",
    },
  },
  "fifth-season": {
    materials: [
      { fr: "Mandarine", en: "Mandarin", ar: "ماندرين" },
      { fr: "Jasmin sambac", en: "Sambac jasmine", ar: "ياسمين سامباك" },
      { fr: "Vanille Bourbon", en: "Bourbon vanilla", ar: "فانيليا بوربون" },
    ],
    moment: { fr: "Le jour, l'été", en: "Daytime and summer", ar: "النهار والصيف" },
    twistLine: {
      fr: "Erba Pura a le fruité le plus solaire. Fifth Season le fond dans une fraîcheur fougère et une douceur lactée : plus portable, plus fondu.",
      en: "Erba Pura has the sunniest fruit there is. Fifth Season melts it into a fougère freshness and a milky softness: easier to wear, more seamless.",
      ar: "إربا بورا يملك أشمس فاكهية. فيفث سيزن يُذيبها في انتعاش فوجير ونعومة حليبية: أسهل ارتداءً وأكثر انسجامًا.",
    },
    twistShort: {
      fr: "une fraîcheur fougère et une douceur lactée sous le fruit",
      en: "a fougère freshness and a milky softness beneath the fruit",
      ar: "انتعاش فوجير ونعومة حليبية تحت الفاكهة",
    },
  },
};

/** « Si vous portez… » : la grille de correspondance de Luma, dans l'ordre des six références. */
export type GuideOrigin = {
  origin: string;
  recommend: string;
  alternative: string;
  why: L10n;
};

export const GUIDE_ORIGINS: GuideOrigin[] = [
  {
    origin: "Baccarat Rouge 540",
    recommend: "melting-mango",
    alternative: "bois-alert",
    why: {
      fr: "La même famille safran-ambrée, avec une ouverture juteuse. Bois Alert si vous la voulez plus boisée.",
      en: "The same saffron-amber family, with a juicy opening. Bois Alert if you want it woodier.",
      ar: "نفس عائلة الزعفران والعنبر، مع افتتاحية عصيرة. بوا ألِرت إن أردتموها أكثر خشبية.",
    },
  },
  {
    origin: "Bois Impérial",
    recommend: "bois-alert",
    alternative: "ultra-cuir",
    why: {
      fr: "Le boisé net, avec de la présence. Ultra Cuir pour le soir.",
      en: "The clean woody signature, with presence. Ultra Cuir for the evening.",
      ar: "التوقيع الخشبي النقي، بحضور. أولترا كوير للمساء.",
    },
  },
  {
    origin: "Tuscan Leather",
    recommend: "ultra-cuir",
    alternative: "bois-alert",
    why: {
      fr: "Le cuir assumé, adouci par l'iris. Bois Alert si vous le voulez moins sombre.",
      en: "Leather, fully assumed, softened by orris. Bois Alert if you want it less dark.",
      ar: "جلدٌ صريح يلطّفه السوسن. بوا ألِرت إن أردتموه أقل قتامة.",
    },
  },
  {
    origin: "Althaïr",
    recommend: "minuit-bourbon",
    alternative: "fifth-season",
    why: {
      fr: "La gourmandise tenue par le cuir. Fifth Season pour la version solaire.",
      en: "Indulgence held by leather. Fifth Season for the sunnier version.",
      ar: "شهوة يشدّها الجلد. فيفث سيزن للنسخة الأكثر شمسًا.",
    },
  },
  {
    origin: "Erba Pura",
    recommend: "fifth-season",
    alternative: "melting-mango",
    why: {
      fr: "Le fruité solaire, plus fondu. Melting Mango pour plus d'ambre.",
      en: "The sunny fruit, more seamless. Melting Mango for more amber.",
      ar: "الفاكهية الشمسية، أكثر انسجامًا. ميلتينغ مانغو لمزيد من العنبر.",
    },
  },
  {
    origin: "Oud Maracuja",
    recommend: "new-oud",
    alternative: "ultra-cuir",
    why: {
      fr: "L'oud moderne, fruité en ouverture. Ultra Cuir si vous préférez le cuir.",
      en: "The modern oud, fruity at the opening. Ultra Cuir if you prefer leather.",
      ar: "العود العصري، فاكهي في افتتاحيته. أولترا كوير إن كنتم تفضّلون الجلد.",
    },
  },
];

/** « Le twist, notre manière » : le manifeste, trois paragraphes. */
export const GUIDE_MANIFESTO: L10n[] = [
  {
    fr: "Nous ne copions pas. Nous partons d'une signature que le monde aime déjà, nous la comprenons matière par matière, puis nous la réinterprétons : nos proportions, nos ingrédients, un twist qui n'appartient qu'à la Maison.",
    en: "We do not copy. We start from a signature the world already loves, understand it material by material, then reinterpret it: our proportions, our ingredients, a twist that belongs to the House alone.",
    ar: "نحن لا ننسخ. ننطلق من توقيع يحبّه العالم أصلًا، نفهمه مادّةً بمادّة، ثم نعيد تأويله: نِسَبنا، مكوّناتنا، ولمسة لا تخصّ إلا الدار.",
  },
  {
    fr: "Le twist, c'est ce geste : garder ce qui fait battre le cœur d'un parfum, et lui donner ce qui lui manquait. Une ouverture plus juteuse, un cuir plus lumineux, un oud qui respire.",
    en: "The twist is that gesture: keep what makes a fragrance's heart beat, and give it what it was missing. A juicier opening, a brighter leather, an oud that breathes.",
    ar: "التويست هو هذه الحركة: أن نحفظ ما يجعل قلب العطر ينبض، وأن نمنحه ما كان يفتقده. افتتاحية أكثر عصارة، جلد أكثر إشراقًا، عودٌ يتنفّس.",
  },
  {
    fr: "Six Reflets, six références, six twists. Vous reconnaîtrez l'univers ; le parfum que vous porterez est le nôtre.",
    en: "Six Reflets, six references, six twists. You will recognise the world; the perfume you wear is ours.",
    ar: "ستة انعكاسات، ستة مراجع، ستة تويستات. ستتعرّفون على العالم؛ أما العطر الذي سترتدونه فهو عطرنا.",
  },
];
