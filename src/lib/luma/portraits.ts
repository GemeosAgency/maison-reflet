/**
 * Les portraits audio des six Reflets (idée de Sandro, 11 septembre 2026) :
 * une définition claire de chaque parfum, dans la voix de Luma, écrite une
 * fois, générée une fois (scripts/luma-voice-portraits.mjs), servie en fichier
 * statique — zéro crédit à l'écoute. Fiche produit et cartes de Luma y renvoient.
 *
 * Structure (registre voulu par Sandro, d'après son exemple pour Minuit
 * Bourbon) : une scène qu'on voit — une soirée d'hiver, un plaid, un verre
 * qu'on tient longtemps ; la pyramide racontée comme un déroulé, avec les
 * matières que Sanity donne ; la filiation (« notre réinterprétation de… »,
 * ce qu'on garde, ce qu'on ajoute) ; le caractère en trois mots, ceux de la
 * matière de marque (REFLET_BRIEFS). Pas de question : c'est un portrait. Les indications entre crochets sont
 * pour la voix (v3) et retirées du texte affiché. Mêmes interdits que Luma.
 *
 * Arabe : voix d'homme (Jeddawi), donc « la voix de la Maison » et non Luma ;
 * arabe standard, courtoisie du Golfe, noms des parfums et des références en
 * caractères latins. Une image adaptée quand il le faut (un kob dafi' plutôt
 * qu'« un verre »). À faire écouter à un natif avant la production.
 */

import type { Locale } from "../../i18n";

export const PORTRAITS: Partial<Record<Locale, Record<string, string>>> = {
  fr: {
    "bois-alert":
      "[warmly] Bois Alert, c'est une chemise blanche impeccable, un matin où tout est net — le parfum qu'on met sans réfléchir et qu'on remarque sur vous toute la journée. [inhales] Le poivre noir et le safran ouvrent avec du tempérament, la bergamote de Calabre les allège ; au cœur, le jasmin sambac irradie sur l'ambre gris et une pointe de caramel ; en fond, le vétiver, le patchouli et le cèdre posent le bois, franc et vibrant. [exhales] Notre réinterprétation de Bois Impérial, enrichie des facettes safran et jasmin de Baccarat Rouge 540. Magnétique, distinct, rayonnant — le feu que les deux rives reconnaissent.",
    "new-oud":
      "[warmly] New Oud, c'est la nuit qui tombe sur une terrasse de Riyad, l'air encore chaud, quelque chose de précieux qu'on porte près de soi. [inhales] Le fruit de la passion et la mandarine ouvrent, vifs, sur le safran ; au cœur, la rose de Taïf et le muguet éclairent l'ambre ; en fond, l'oud s'installe, profond, adouci par un bois de santal crémeux et le musc blanc. [exhales] Notre réinterprétation d'Oud Maracuja, avec un santal poudré et un floral blanc lumineux. Intense, profond, opulent — l'oud qui garde sa richesse et prend un visage moderne.",
    "melting-mango":
      "[upbeat] Melting Mango, c'est une fin d'après-midi d'été, une mangue coupée au couteau, le jus qui coule sur les doigts — et derrière, une chaleur qu'on reconnaît entre mille. [inhales] La mangue et l'orange éclatent en ouverture sur le safran ; au cœur, la praline, le noyau d'abricot et le jasmin absolu installent la gourmandise ; en fond, la mousse de chêne, le patchouli et le vétiver d'Haïti tiennent l'ensemble, profonds et diffusants. [exhales] Notre réinterprétation de Baccarat Rouge 540, avec cette surdose de mangue que l'original n'a pas. Audacieux, moderne, captivant.",
    "ultra-cuir":
      "[warmly] Ultra Cuir, c'est une veste de cuir qu'on garde sur les épaules quand le soir tombe, une lumière basse, quelqu'un qui se rapproche. [inhales] La framboise ouvre, juteuse, avec la bergamote de Calabre et une baie rouge — une lumière posée sur le cuir ; au cœur, l'encens et un trio de safrans donnent la texture, l'iris apporte sa douceur poudrée ; en fond, le cèdre, le cuir et le patchouli s'installent pour la nuit. [exhales] Notre réinterprétation de Tuscan Leather, redessinée avec deux matières nobles, le safran et l'iris. Sombre, texturé, mystérieux.",
    "minuit-bourbon":
      "[warmly] Minuit Bourbon, c'est une soirée d'hiver, un plaid, un verre qu'on tient longtemps entre les mains. [inhales] La cardamome et la cannelle de Ceylan ouvrent la composition avec de la chaleur, la fleur d'oranger et l'amande adoucissent le cœur, puis la fève tonka et la vanille Bourbon s'installent en fond, tenues par un accord cuir qui empêche la gourmandise de sombrer dans le trop sucré. [exhales] Notre réinterprétation d'Althaïr, enrichie de ce cuir qui lui donne du caractère. Chaud, sophistiqué, addictif.",
    "fifth-season":
      "[upbeat] Fifth Season, c'est un matin de printemps qui ressemble déjà à l'été — une fenêtre ouverte, du linge propre, de la lumière partout. [inhales] La mandarine, l'orange et les fruits exotiques ouvrent, vibrants, sur une fraîcheur de fougère ; au cœur, le jasmin sambac et le muguet se posent sur un caramel léger ; en fond, la vanille Bourbon, la fève tonka et le musc blanc arrondissent tout, crémeux et propres. [exhales] Notre réinterprétation d'Erba Pura, adoucie d'une touche lactée. Vibrant, versatile, raffiné — le plus frais de la collection, celui du jour.",
  },
  en: {
    "bois-alert":
      "[warmly] Bois Alert is a crisp white shirt on a morning when everything feels sharp — the scent you put on without thinking, and that people notice on you all day. [inhales] Black pepper and saffron open with character, Calabrian bergamot lifts them; at the heart, sambac jasmine radiates over ambergris and a touch of caramel; in the base, vetiver, patchouli and cedar lay down the wood, bold and vibrant. [exhales] Our reinterpretation of Bois Impérial, enriched with the saffron and jasmine facets of Baccarat Rouge 540. Magnetic, distinctive, radiant — the fire both shores recognise.",
    "new-oud":
      "[warmly] New Oud is night falling over a terrace in Riyadh, the air still warm, something precious worn close to the skin. [inhales] Passion fruit and mandarin open, vivid, over saffron; at the heart, Taif rose and lily of the valley light up the amber; in the base, oud settles in, deep, softened by creamy sandalwood and white musk. [exhales] Our reinterpretation of Oud Maracuja, with a powdery sandalwood and a luminous white floral. Intense, deep, opulent — oud that keeps its richness and takes on a modern face.",
    "melting-mango":
      "[upbeat] Melting Mango is a late summer afternoon, a mango cut with a knife, the juice running down your fingers — and behind it, a warmth you would recognise anywhere. [inhales] Mango and orange burst open over saffron; at the heart, praline, apricot kernel and jasmine absolute settle the gourmand side; in the base, oakmoss, patchouli and Haitian vetiver hold everything, deep and diffusive. [exhales] Our reinterpretation of Baccarat Rouge 540, with an overdose of mango the original never had. Bold, modern, captivating.",
    "ultra-cuir":
      "[warmly] Ultra Cuir is a leather jacket kept on your shoulders as evening falls, a low light, someone drawing closer. [inhales] Raspberry opens, juicy, with Calabrian bergamot and a red berry — a light laid over the leather; at the heart, incense and a trio of saffrons bring the texture, iris its powdery softness; in the base, cedar, leather and patchouli settle in for the night. [exhales] Our reinterpretation of Tuscan Leather, redrawn with two noble materials, saffron and iris. Dark, textured, mysterious.",
    "minuit-bourbon":
      "[warmly] Minuit Bourbon is a winter evening, a blanket, a glass held for a long while between your hands. [inhales] Cardamom and Ceylon cinnamon open the composition with warmth, orange blossom and almond soften the heart, then tonka bean and Bourbon vanilla settle in the base, held by a leather accord that keeps the sweetness from sinking into sugar. [exhales] Our reinterpretation of Althaïr, enriched with the leather that gives it character. Warm, sophisticated, addictive.",
    "fifth-season":
      "[upbeat] Fifth Season is a spring morning that already feels like summer — an open window, clean linen, light everywhere. [inhales] Mandarin, orange and exotic fruits open, vibrant, over a fougère freshness; at the heart, sambac jasmine and lily of the valley rest on a light caramel; in the base, Bourbon vanilla, tonka bean and white musk round everything off, creamy and clean. [exhales] Our reinterpretation of Erba Pura, softened with a milky touch. Vibrant, versatile, refined — the freshest of the collection, the one for daytime.",
  },
  ar: {
    "bois-alert":
      "[warmly] Bois Alert، قميصٌ أبيض بلا تجعيدة، وصباحٌ كلُّ شيءٍ فيه واضح — العطر الذي تضعونه دون تفكير، ويلاحظه الآخرون عليكم طوال اليوم. [inhales] يفتتحه الفلفل الأسود والزعفران بطبعٍ قوي، ويخفّفهما برغموت كالابريا؛ في القلب يشعّ ياسمين سامباك فوق العنبر الرمادي ولمسةٍ من الكراميل؛ وفي القاعدة يرسّخ الفيتيفر والباتشولي وخشب الأرز خشبيةً صريحةً نابضة. [exhales] إعادة تأويلنا لـ Bois Impérial، مُغناةً بأوجه الزعفران والياسمين من Baccarat Rouge 540. جذّاب، مميّز، مشعّ — النارُ التي تعرفها الضفّتان.",
    "new-oud":
      "[warmly] New Oud، ليلٌ يهبط على شرفةٍ في الرياض، والهواء ما زال دافئًا، وشيءٌ ثمين تحملونه قريبًا من القلب. [inhales] تفتتحه فاكهة الباشن واليوسفي بحيويةٍ فوق الزعفران؛ في القلب يُنير ورد الطائف وزنبق الوادي العنبر؛ وفي القاعدة يستقرّ العود عميقًا، يُليّنه خشب صندلٍ كريمي والمسك الأبيض. [exhales] إعادة تأويلنا لـ Oud Maracuja، مع صندلٍ بودري وزهورٍ بيضاء مضيئة. كثيف، عميق، فخم — عودٌ يحفظ غناه ويرتدي وجهًا حديثًا.",
    "melting-mango":
      "[upbeat] Melting Mango، عصرُ يومٍ صيفي، ومانجو تُقطَع بالسكين، وعصيرٌ يسيل على الأصابع — وخلف ذلك دفءٌ تعرفونه بين ألف. [inhales] تنفجر المانجو والبرتقال في الافتتاح فوق الزعفران؛ في القلب يُرسّخ البرالين ونواة المشمش وخلاصة الياسمين الحلاوة؛ وفي القاعدة يحمل طحلب البلوط والباتشولي وفيتيفر هايتي كلَّ ذلك، عميقًا ومنتشرًا. [exhales] إعادة تأويلنا لـ Baccarat Rouge 540، مع جرعةٍ مضاعفة من المانجو لم تكن في الأصل. جريء، حديث، آسر.",
    "ultra-cuir":
      "[warmly] Ultra Cuir، سترةٌ من الجلد تبقى على الكتفين حين يهبط المساء، وضوءٌ خافت، وأحدٌ يقترب. [inhales] يفتتحه توت العليق عصيرًا مع برغموت كالابريا والتوت الأحمر — ضوءٌ يستقرّ على الجلد؛ في القلب يمنح البخور وثلاثةُ أنواعٍ من الزعفران الملمس، ويأتي السوسن بنعومته البودرية؛ وفي القاعدة يستقرّ خشب الأرز والجلد والباتشولي لليل. [exhales] إعادة تأويلنا لـ Tuscan Leather، أُعيد رسمها بمادّتَين نفيستَين: الزعفران والسوسن. داكن، ذو ملمس، غامض.",
    "minuit-bourbon":
      "[warmly] Minuit Bourbon، مساءُ شتاءٍ، وشالٌ على الكتفين، وكوبٌ دافئ يُمسَك طويلاً بين اليدين. [inhales] يفتتح الهيل وقرفة سيلان التركيبة بدفء، ويُليّن زهر البرتقال واللوز القلب، ثم تستقرّ حبة التونكا وفانيليا بوربون في القاعدة، يشدّهما اتّفاقُ جلدٍ يمنع الحلاوة من الغرق في السكر. [exhales] إعادة تأويلنا لـ Althaïr، مُغناةً بهذا الجلد الذي يمنحها شخصيّة. دافئ، راقٍ، آسر.",
    "fifth-season":
      "[upbeat] Fifth Season، صباحُ ربيعٍ يشبه الصيف من الآن — نافذةٌ مفتوحة، وأقمشةٌ نظيفة، وضوءٌ في كلّ مكان. [inhales] يفتتحه اليوسفي والبرتقال والفواكه الاستوائية بحيويةٍ فوق نضارةٍ فوجيرية؛ في القلب يستقرّ ياسمين سامباك وزنبق الوادي على كراميلٍ خفيف؛ وفي القاعدة تُدوّر فانيليا بوربون وحبة التونكا والمسك الأبيض كلَّ شيء، كريميةً ونقيّة. [exhales] إعادة تأويلنا لـ Erba Pura، مُليَّنةً بلمسةٍ حليبية. نابض، متعدّد الأوجه، راقٍ — الأنعش في المجموعة، عطرُ النهار.",
  },
};

/** Le fichier statique du portrait, s'il existe pour cette langue. */
export function portraitAudioPath(locale: Locale, handle: string): string | null {
  return PORTRAITS[locale]?.[handle] ? `/luma/voice/${locale}/parfums/${handle}.mp3` : null;
}

/** Le texte du portrait sans ses indications de voix — pour l'afficher ou le lire à l'écran. */
export function portraitText(locale: Locale, handle: string): string | null {
  const script = PORTRAITS[locale]?.[handle];
  return script ? script.replace(/\[[^\]]{1,40}\]/g, " ").replace(/\s{2,}/g, " ").trim() : null;
}
