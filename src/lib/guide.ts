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

export type Moment = "day" | "evening";

export type GuideReflet = {
  /** Trois matières signature, dans l'ordre où on les sent. */
  materials: [L10n, L10n, L10n];
  /** Le moment où le porter, une ligne. */
  moment: L10n;
  /** Le même moment, structuré, pour les filtres du guide. */
  when: Moment[];
  /**
   * La place sur la carte olfactive du guide : x de 0 (frais) à 100 (chaud),
   * y de 0 (jour) à 100 (soir). Un jugement, pas une mesure — posé par moi le
   * 12 septembre 2026 avec l'accord de Sandro (« je te laisse faire le
   * jugement et on pourra les déplacer ensuite ») : à déplacer ici.
   */
  map: { x: number; y: number };
  /** Ce que la référence a de grand, ce que le Reflet y ajoute — une phrase. */
  twistLine: L10n;
  /** Le twist en quelques mots, pour le panneau d'achat : « notre twist : … ». */
  twistShort: L10n;
  /**
   * Les trois temps du parfum, dans l'ordre tête / cœur / fond, écrits pour
   * quelqu'un qui ne peut pas le sentir : la fenêtre pendant laquelle on le
   * porte, puis ce que ça fait. Une liste de matières est simultanée, un parfum
   * est une séquence, et c'est le temps qui manquait. Ils se lisent dans le
   * tiroir de la pyramide, qu'on ouvre depuis la rangée du panneau ou en
   * cliquant une colonne du triptyque : posés sur les photos, ils faisaient
   * cheap (Sandro, 17 septembre 2026). Facultatif : une fiche sans `phases`
   * garde le tiroir tel qu'avant.
   */
  phases?: [Phase, Phase, Phase];
};

export type Phase = {
  /** « les 20 premières minutes ». */
  window: L10n;
  /** Ce qu'on sent et ce que ça fait, sans nomenclature. */
  effect: L10n;
};

export const GUIDE_REFLETS: Record<string, GuideReflet> = {
  "bois-alert": {
    materials: [
      { fr: "Safran", en: "Saffron", ar: "زعفران" },
      { fr: "Jasmin sambac", en: "Sambac jasmine", ar: "ياسمين سامباك" },
      { fr: "Cèdre", en: "Cedarwood", ar: "خشب الأرز" },
    ],
    moment: { fr: "Du matin au soir", en: "From morning to night", ar: "من الصباح إلى المساء" },
    when: ["day", "evening"],
    map: { x: 50, y: 50 },
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
    phases: [
      {
        window: { fr: "les 20 premières minutes", en: "the first 20 minutes", ar: "أول ٢٠ دقيقة" },
        effect: {
          fr: "Poivre noir et bergamote, vif et coupant. On le remarque de loin.",
          en: "Black pepper and bergamot, bright and cutting. People notice it from across a room.",
          ar: "فلفل أسود وبرغموت، حادّ ولامع. يُلاحَظ من بعيد.",
        },
      },
      {
        window: { fr: "de 20 minutes à 3 heures", en: "from 20 minutes to 3 hours", ar: "من ٢٠ دقيقة إلى ٣ ساعات" },
        effect: {
          fr: "Le jasmin et un caramel discret adoucissent le poivre. Le parfum devient rond sans perdre son mordant.",
          en: "Jasmine and a discreet caramel soften the pepper. The perfume turns round without losing its bite.",
          ar: "الياسمين وكراميل خفيف يليّنان الفلفل. يستدير العطر دون أن يفقد حدّته.",
        },
      },
      {
        window: { fr: "du matin au soir", en: "from morning to night", ar: "من الصباح إلى المساء" },
        effect: {
          fr: "Vétiver, patchouli et cèdre. Une base sèche et nette, qui tient du matin au soir.",
          en: "Vetiver, patchouli and cedar. A dry, clean base that holds from morning to night.",
          ar: "نجيل الهند والباتشولي والأرز. قاعدة جافة ونظيفة تصمد من الصباح إلى المساء.",
        },
      },
    ],
  },
  "new-oud": {
    materials: [
      { fr: "Fruit de la passion", en: "Passion fruit", ar: "فاكهة الباشن" },
      { fr: "Rose de Taïf", en: "Taif rose", ar: "ورد الطائف" },
      { fr: "Oud", en: "Oud", ar: "عود" },
    ],
    moment: { fr: "Le soir, les grandes occasions", en: "Evenings and grand occasions", ar: "المساء والمناسبات الكبيرة" },
    when: ["evening"],
    map: { x: 58, y: 88 }, // un peu à gauche : le trait vers Melting Mango passe à côté de Bois Alert, pas dessus
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
    phases: [
      {
        window: { fr: "les 20 premières minutes", en: "the first 20 minutes", ar: "أول ٢٠ دقيقة" },
        effect: {
          fr: "Le fruit de la passion éclate, acide et juteux. Un départ solaire, très loin de l'oud qu'on attend.",
          en: "Passion fruit bursts open, sharp and juicy. A sunlit start, far from the oud you expect.",
          ar: "تنفجر فاكهة الباشن، حامضة وغنيّة. بداية مشمسة، بعيدة عن العود الذي تتوقعه.",
        },
      },
      {
        window: { fr: "de 20 minutes à 3 heures", en: "from 20 minutes to 3 hours", ar: "من ٢٠ دقيقة إلى ٣ ساعات" },
        effect: {
          fr: "La rose de Taïf prend la place. Le parfum devient floral et ample, l'ambre le réchauffe par-dessous.",
          en: "Taif rose takes over. The perfume turns floral and wide, with amber warming it from underneath.",
          ar: "يتقدّم ورد الطائف. يصبح العطر زهريًا واسعًا، ويدفّئه العنبر من تحته.",
        },
      },
      {
        window: { fr: "le reste de la soirée", en: "the rest of the evening", ar: "بقية المساء" },
        effect: {
          fr: "Bois de santal et oud, doux et fumés. C'est là qu'il devient un oud, et il le reste longtemps.",
          en: "Sandalwood and oud, soft and smoky. This is where it becomes an oud, and it stays one for a long time.",
          ar: "خشب الصندل والعود، ناعمان ومدخّنان. هنا يصير عودًا، ويبقى كذلك طويلًا.",
        },
      },
    ],
  },
  "melting-mango": {
    materials: [
      { fr: "Mangue", en: "Mango", ar: "مانجو" },
      { fr: "Safran", en: "Saffron", ar: "زعفران" },
      { fr: "Mousse de chêne", en: "Oakmoss", ar: "طحلب البلوط" },
    ],
    moment: { fr: "Le jour, les fins d'après-midi", en: "Daytime, late afternoons", ar: "النهار وأواخر العصر" },
    when: ["day"],
    map: { x: 36, y: 28 },
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
    phases: [
      {
        window: { fr: "les 20 premières minutes", en: "the first 20 minutes", ar: "أول ٢٠ دقيقة" },
        effect: {
          fr: "Mangue et orange, franches et sucrées. L'effet est immédiat, c'est ce qui fait tourner les têtes.",
          en: "Mango and orange, plain and sweet. The effect is immediate, and it is what turns heads.",
          ar: "مانجو وبرتقال، صريحان وحلوان. الأثر فوري، وهو ما يلفت الأنظار.",
        },
      },
      {
        window: { fr: "de 20 minutes à 3 heures", en: "from 20 minutes to 3 hours", ar: "من ٢٠ دقيقة إلى ٣ ساعات" },
        effect: {
          fr: "La praline et le noyau d'abricot installent un gourmand plus dense, presque d'amande.",
          en: "Praline and apricot kernel settle into a denser gourmand, almost almond-like.",
          ar: "البرالين ونواة المشمش يرسّخان حلاوة أكثف، تكاد تكون لوزية.",
        },
      },
      {
        window: { fr: "le reste de la journée", en: "the rest of the day", ar: "بقية اليوم" },
        effect: {
          fr: "Mousse de chêne et patchouli. Le sucre retombe, il reste une traîne boisée.",
          en: "Oakmoss and patchouli. The sugar settles, and a woody trail is what remains.",
          ar: "طحلب البلوط والباتشولي. تهدأ الحلاوة، ويبقى أثر خشبي.",
        },
      },
    ],
  },
  "ultra-cuir": {
    materials: [
      { fr: "Framboise", en: "Raspberry", ar: "توت العليق" },
      { fr: "Safran", en: "Saffron", ar: "زعفران" },
      { fr: "Cuir", en: "Leather", ar: "جلد" },
    ],
    moment: { fr: "Le soir", en: "Evenings", ar: "المساء" },
    when: ["evening"],
    map: { x: 82, y: 66 },
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
    phases: [
      {
        window: { fr: "les 20 premières minutes", en: "the first 20 minutes", ar: "أول ٢٠ دقيقة" },
        effect: {
          fr: "Framboise écrasée, vive et acidulée. C'est ce que les gens sentent quand vous entrez.",
          en: "Crushed raspberry, sharp and tart. This is what people smell when you walk in.",
          ar: "توت عليق مهروس، حادّ ومنعش. هذا ما يشمّه الناس حين تدخل.",
        },
      },
      {
        window: { fr: "de 20 minutes à 3 heures", en: "from 20 minutes to 3 hours", ar: "من ٢٠ دقيقة إلى ٣ ساعات" },
        effect: {
          fr: "Le safran s'installe, chaud et un peu cuiré. Le parfum cesse d'être fruité, il devient dense.",
          en: "Saffron settles in, warm and faintly leathery. The perfume stops being fruity and turns dense.",
          ar: "يستقرّ الزعفران، دافئًا وبلمسة جلدية. يتوقف العطر عن كونه فاكهيًا ويصبح كثيفًا.",
        },
      },
      {
        window: { fr: "le reste de la journée", en: "the rest of the day", ar: "بقية اليوم" },
        effect: {
          fr: "Cèdre et cuir, une traîne sèche. C'est ce qui reste sur vos vêtements le lendemain.",
          en: "Cedar and leather, a dry trail. This is what is left on your clothes the next morning.",
          ar: "أرز وجلد، أثر جافّ. هذا ما يبقى على ثيابك في اليوم التالي.",
        },
      },
    ],
  },
  "minuit-bourbon": {
    materials: [
      { fr: "Cardamome", en: "Cardamom", ar: "هيل" },
      { fr: "Fève tonka", en: "Tonka bean", ar: "حبوب التونكا" },
      { fr: "Cuir", en: "Leather", ar: "جلد" },
    ],
    moment: { fr: "Le soir, les nuits fraîches", en: "Evenings and cooler nights", ar: "المساء والليالي الباردة" },
    when: ["evening"],
    map: { x: 90, y: 90 },
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
    phases: [
      {
        window: { fr: "les 20 premières minutes", en: "the first 20 minutes", ar: "أول ٢٠ دقيقة" },
        effect: {
          fr: "Cardamome et cannelle, une entrée sèche et épicée. Rien de sucré encore : ça pique un peu, et c'est voulu.",
          en: "Cardamom and cinnamon, a dry and spicy opening. Nothing sweet yet: it bites a little, and that is deliberate.",
          ar: "هيل وقرفة، بداية جافة وحارّة. لا حلاوة بعد: فيها لسعة خفيفة، وهذا مقصود.",
        },
      },
      {
        window: { fr: "de 20 minutes à 3 heures", en: "from 20 minutes to 3 hours", ar: "من ٢٠ دقيقة إلى ٣ ساعات" },
        effect: {
          fr: "La fleur d'oranger et l'amande arrondissent tout. Le parfum s'adoucit sans devenir sage.",
          en: "Orange blossom and almond round everything off. The perfume softens without turning tame.",
          ar: "زهر البرتقال واللوز يديران الحواف. يلين العطر دون أن يصبح وديعًا.",
        },
      },
      {
        window: { fr: "le reste de la soirée", en: "the rest of the evening", ar: "بقية المساء" },
        effect: {
          fr: "Vanille Bourbon et fève tonka sur un cuir discret. C'est cette partie qu'on vous complimentera.",
          en: "Bourbon vanilla and tonka bean over a quiet leather. This is the part people will compliment.",
          ar: "فانيليا بوربون وحبوب التونكا فوق جلد هادئ. هذا الجزء هو ما سيُثني عليه الناس.",
        },
      },
    ],
  },
  "fifth-season": {
    materials: [
      { fr: "Mandarine", en: "Mandarin", ar: "ماندرين" },
      { fr: "Jasmin sambac", en: "Sambac jasmine", ar: "ياسمين سامباك" },
      { fr: "Vanille Bourbon", en: "Bourbon vanilla", ar: "فانيليا بوربون" },
    ],
    moment: { fr: "Le jour, l'été", en: "Daytime and summer", ar: "النهار والصيف" },
    when: ["day"],
    map: { x: 14, y: 18 },
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
    phases: [
      {
        window: { fr: "les 20 premières minutes", en: "the first 20 minutes", ar: "أول ٢٠ دقيقة" },
        effect: {
          fr: "Mandarine et fruits exotiques, pleins et lumineux. Une entrée franchement solaire.",
          en: "Mandarin and tropical fruit, full and luminous. An openly sunlit start.",
          ar: "يوسفي وفواكه استوائية، ممتلئة ومشرقة. بداية مشمسة بلا تردّد.",
        },
      },
      {
        window: { fr: "de 20 minutes à 3 heures", en: "from 20 minutes to 3 hours", ar: "من ٢٠ دقيقة إلى ٣ ساعات" },
        effect: {
          fr: "Le jasmin et un caramel léger épaississent le fruit. Le parfum se fait crémeux.",
          en: "Jasmine and a light caramel thicken the fruit. The perfume turns creamy.",
          ar: "الياسمين وكراميل خفيف يزيدان الفاكهة كثافة. يصبح العطر كريميًا.",
        },
      },
      {
        window: { fr: "le reste de la journée", en: "the rest of the day", ar: "بقية اليوم" },
        effect: {
          fr: "Vanille Bourbon et musc blanc. Une peau propre et douce, c'est ce qui reste sur vos vêtements.",
          en: "Bourbon vanilla and white musk. Clean, soft skin, and that is what stays on your clothes.",
          ar: "فانيليا بوربون ومسك أبيض. بشرة نظيفة وناعمة، وهذا ما يبقى على ثيابك.",
        },
      },
    ],
  },
};

/** « Si vous portez… » : la grille de correspondance de Luma, dans l'ordre des six références. */


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
