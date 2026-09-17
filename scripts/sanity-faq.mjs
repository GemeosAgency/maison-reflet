/**
 * Enrichit la bibliothèque de FAQ dans Sanity et la rattache aux fiches.
 *
 * Trois choses :
 *  - réécrit « Proposez-vous des retours ? », qui ouvrait sur l'interdiction
 *    (« un parfum ouvert ne peut pas être repris ») au lieu de la garantie ;
 *  - crée les questions qui manquaient, dont celles que la mécanique de l'avoir
 *    et de l'échantillon rendent indispensables ;
 *  - rattache la liste, dans l'ordre, aux six parfums ET aux deux coffrets, qui
 *    n'avaient aucune FAQ.
 *
 * Les brouillons sont patchés en même temps que les documents publiés, sinon une
 * publication ultérieure réintroduirait l'ancien contenu.
 *
 *   node scripts/sanity-faq.mjs --dry     (n'écrit rien, montre le plan)
 *   node scripts/sanity-faq.mjs
 */
import { createClient } from "@sanity/client";
import crypto from "node:crypto";

const DRY = process.argv.includes("--dry");
const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET ?? "production",
  apiVersion: process.env.SANITY_API_VERSION ?? "2025-01-01",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

const cle = () => crypto.randomBytes(6).toString("hex");
/** Un ou plusieurs paragraphes en Portable Text. */
const bloc = (...paragraphes) =>
  paragraphes.map((texte) => ({
    _key: cle(),
    _type: "block",
    style: "normal",
    markDefs: [],
    children: [{ _key: cle(), _type: "span", marks: [], text: texte }],
  }));

const faq = (id, q, r) => ({
  _id: id,
  _type: "faq",
  question: { _type: "localeString", fr: q.fr, en: q.en, ar: q.ar },
  reponse: { _type: "localeBlock", fr: bloc(...r.fr), en: bloc(...r.en), ar: bloc(...r.ar) },
});

// ---------------------------------------------------------------------------
// Les fiches
// ---------------------------------------------------------------------------
const FICHES = [
  faq("faq-retours",
    { fr: "Proposez-vous des retours ?", en: "Do you offer returns?", ar: "هل تقبلون الإرجاع؟" },
    {
      fr: ["Oui. Un flacon non ouvert nous revient à nos frais dans les 14 jours : écrivez-nous à contact@maisonreflet.com dès réception et nous organisons le retour avec vous.",
           "Un parfum déjà ouvert ne peut pas être repris, pour des raisons d'hygiène. C'est exactement pour cela qu'un échantillon 2 ml est offert avec chaque flacon : vous pouvez choisir celui du parfum que vous commandez et le porter avant d'ouvrir votre flacon."],
      en: ["Yes. An unopened bottle comes back to us at our expense within 14 days: write to contact@maisonreflet.com as soon as you receive it and we will arrange the return with you.",
           "A perfume that has been opened cannot be taken back, for hygiene reasons. That is exactly why a free 2 ml sample comes with every bottle: you can pick the one you are ordering and wear it before you open your bottle."],
      ar: ["نعم. الزجاجة غير المفتوحة تعود إلينا على نفقتنا خلال ١٤ يومًا: راسلونا على contact@maisonreflet.com فور الاستلام وسنرتّب الإرجاع معكم.",
           "العطر المفتوح لا يمكن استرجاعه لأسباب صحية. ولهذا بالضبط تأتي عيّنة ٢ مل مجانًا مع كل زجاجة: يمكنكم اختيار عيّنة العطر نفسه الذي تطلبونه وتجربتها قبل فتح الزجاجة."],
    }),

  faq("faq-avoir-coffret",
    { fr: "Comment fonctionne l'avoir du coffret découverte ?", en: "How does the discovery set credit work?", ar: "كيف يعمل رصيد علبة الاكتشاف؟" },
    {
      fr: ["En achetant le coffret découverte, vous recevez par e-mail un avoir de 160 AED, soit exactement son prix, à valoir sur un flacon de 75 ml.",
           "Il est valable 90 jours, sur le Reflet de votre choix, et il vous est réservé : personne d'autre ne peut l'utiliser. Le prix du flacon ne change pas, c'est la découverte qui devient gratuite. Un avoir par compte."],
      en: ["Buying the discovery set earns you a 160 AED credit by email, exactly its price, to spend on a 75 ml bottle.",
           "It is valid for 90 days, on the Reflet of your choice, and it is reserved for you: nobody else can use it. The price of the bottle does not change, it is the discovery that becomes free. One credit per account."],
      ar: ["بشراء علبة الاكتشاف تصلكم بالبريد قيمة ١٦٠ درهمًا، أي سعرها بالضبط، لاستخدامها عند شراء زجاجة ٧٥ مل.",
           "صالحة ٩٠ يومًا على العطر الذي تختارونه، ومحجوزة لكم وحدكم: لا يستطيع غيركم استخدامها. سعر الزجاجة لا يتغيّر، الاكتشاف هو ما يصبح مجانيًا. رصيد واحد لكل حساب."],
    }),

  faq("faq-echantillon-offert",
    { fr: "Comment obtenir mon échantillon offert ?", en: "How do I get my free sample?", ar: "كيف أحصل على عيّنتي المجانية؟" },
    {
      fr: ["Un échantillon 2 ml est offert avec chaque flacon de 75 ml. Vous le choisissez au panier, juste avant de payer, parmi les six Reflets.",
           "Vous pouvez prendre celui d'un autre parfum pour découvrir la collection, ou celui du parfum que vous commandez pour le porter sur votre peau avant d'ouvrir votre flacon."],
      en: ["A free 2 ml sample comes with every 75 ml bottle. You choose it in the cart, just before paying, from the six Reflets.",
           "You can take a different perfume to discover the collection, or the very one you are ordering, to wear it on your own skin before you open your bottle."],
      ar: ["تأتي عيّنة ٢ مل مجانًا مع كل زجاجة ٧٥ مل. تختارونها في السلة قبل الدفع مباشرة، من بين العطور الستة.",
           "يمكنكم اختيار عطر آخر لاكتشاف المجموعة، أو العطر نفسه الذي تطلبونه لتجربته على بشرتكم قبل فتح الزجاجة."],
    }),

  faq("faq-livraison",
    { fr: "Où livrez-vous, et en combien de temps ?", en: "Where do you ship, and how long does it take?", ar: "إلى أين تشحنون، وكم يستغرق التوصيل؟" },
    {
      fr: ["À Dubaï, toute commande passée avant 14 h part le jour même. Dans le reste des Émirats, comptez un à deux jours ouvrés.",
           "La livraison coûte 25 AED aux Émirats et devient gratuite dès 400 AED. Nous livrons également dans vingt-huit pays ; le délai et le tarif s'affichent au panier selon votre destination."],
      en: ["In Dubai, any order placed before 2 PM leaves the same day. Elsewhere in the UAE, allow one to two business days.",
           "Delivery costs 25 AED within the UAE and becomes free from 400 AED. We also ship to twenty-eight countries; the time and the rate appear in your cart according to your destination."],
      ar: ["في دبي، كل طلب قبل الساعة الثانية ظهرًا يُشحن في اليوم نفسه. في بقية الإمارات، يستغرق الأمر يومًا إلى يومَي عمل.",
           "التوصيل بـ ٢٥ درهمًا داخل الإمارات، ومجاني من ٤٠٠ درهم. نشحن أيضًا إلى ثماني وعشرين دولة؛ تظهر المدة والتكلفة في السلة حسب وجهتكم."],
    }),

  faq("faq-mixtes",
    { fr: "Vos parfums sont-ils mixtes ?", en: "Are your fragrances unisex?", ar: "هل عطوركم للجنسين؟" },
    {
      fr: ["Oui, les six. Nous ne composons pas pour un genre mais pour un caractère : le cuir et le safran d'Ultra Cuir, la vanille et la fève tonka de Minuit Bourbon, la rose et l'oud de New Oud se portent par qui les aime.",
           "Le seul repère utile est le moment : trois de nos Reflets s'épanouissent le soir, deux accompagnent la journée, et Bois Alert tient du matin au soir."],
      en: ["Yes, all six. We compose for a character rather than for a gender: the leather and saffron of Ultra Cuir, the vanilla and tonka of Minuit Bourbon, the rose and oud of New Oud belong to whoever loves them.",
           "The only useful marker is the moment: three of our Reflets come alive in the evening, two carry the day, and Bois Alert holds from morning to night."],
      ar: ["نعم، الستة جميعًا. نؤلّف من أجل الطابع لا من أجل الجنس: جلد أولترا كوير وزعفرانه، وفانيليا مينوي بوربون وتونكاه، وورد نيو عود وعوده، لمن يحبّها.",
           "المؤشّر الوحيد المفيد هو الوقت: ثلاثة من عطورنا تتفتّح مساءً، واثنان يرافقان النهار، وبوا أليرت يصمد من الصباح إلى المساء."],
    }),

  faq("faq-layering",
    { fr: "Peut-on porter deux Reflets ensemble ?", en: "Can two Reflets be worn together?", ar: "هل يمكن وضع عطرين معًا؟" },
    {
      fr: ["Oui, et c'est une pratique courante au Golfe. Chaque fiche propose le Reflet qui se marie le mieux avec celui que vous regardez, et explique dans quel ordre les porter.",
           "La règle est simple : le plus dense d'abord, sur la peau, le plus vif ensuite, une pulvérisation sur le tissu. Vous obtenez une signature que personne d'autre ne porte."],
      en: ["Yes, and it is common practice in the Gulf. Every page suggests the Reflet that pairs best with the one you are looking at, and explains in which order to wear them.",
           "The rule is simple: the denser one first, on the skin, then the brighter one, a single spray on fabric. You end up with a signature nobody else wears."],
      ar: ["نعم، وهي ممارسة شائعة في الخليج. كل صفحة تقترح العطر الذي ينسجم أفضل مع العطر الذي تتصفّحونه، وتشرح ترتيب وضعهما.",
           "القاعدة بسيطة: الأكثف أولًا على البشرة، ثم الأكثر حيوية، بخّة واحدة على القماش. تحصلون على توقيع لا يضعه أحد غيركم."],
    }),

  faq("faq-conservation",
    { fr: "Comment conserver mon parfum ?", en: "How should I store my perfume?", ar: "كيف أحفظ عطري؟" },
    {
      fr: ["À l'abri de la lumière et de la chaleur, bouchon fermé. C'est la seule vraie précaution, et elle compte davantage ici qu'ailleurs : la chaleur du Golfe accélère l'oxydation des matières les plus fines.",
           "Évitez donc la salle de bain et le rebord de fenêtre. Un tiroir ou l'écrin d'origine suffisent, et le parfum garde son équilibre plusieurs années."],
      en: ["Away from light and heat, with the cap on. That is the only real precaution, and it matters more here than elsewhere: the heat of the Gulf speeds up the oxidation of the finest materials.",
           "So avoid the bathroom and the windowsill. A drawer or the original box is enough, and the perfume keeps its balance for several years."],
      ar: ["بعيدًا عن الضوء والحرارة، مع إغلاق الغطاء. هذا هو الاحتياط الوحيد الحقيقي، وهو أهمّ هنا منه في غير مكان: حرارة الخليج تسرّع أكسدة أرقّ المواد.",
           "تجنّبوا إذًا الحمّام وحافة النافذة. يكفي درج أو العلبة الأصلية، ويحتفظ العطر بتوازنه سنوات."],
    }),
];

// L'ordre d'affichage, du doute le plus fréquent au détail pratique.
const ORDRE_PARFUM = [
  "faq-copies-exactes", "faq-test-twist-remplace", "faq-trouver-mon-parfum", "faq-essayer",
  "faq-echantillon-offert", "faq-avoir-coffret", "faq-tenue", "faq-mixtes",
  "faq-tous-les-jours", "faq-layering", "faq-conservation", "faq-livraison",
  "faq-retours", "faq-fabrication",
];
const ORDRE_COFFRET = [
  "faq-avoir-coffret", "faq-essayer", "faq-echantillon-offert", "faq-trouver-mon-parfum",
  "faq-copies-exactes", "faq-test-twist-remplace", "faq-livraison", "faq-retours", "faq-fabrication",
];

async function main() {
  // Le document « twist » existe sous un identifiant aléatoire : on le retrouve.
  const idTwist = await client.fetch(
    `*[_type == "faq" && question.fr match "*twist*" && defined(reponse.en)][0]._id`
  );
  if (!idTwist) throw new Error("FAQ « twist » introuvable.");
  const ordre = (l) => l.map((id) => (id === "faq-test-twist-remplace" ? idTwist : id));

  const ref = (id) => ({ _key: cle(), _type: "reference", _ref: id });
  const cibles = await client.fetch(
    `*[_type in ["parfum","coffret"] && defined(shopifyHandle)]{_id, _type, shopifyHandle}`
  );

  console.log(`${FICHES.length} fiches FAQ à écrire, ${cibles.length} documents à rattacher.`);
  if (DRY) {
    for (const f of FICHES) console.log("  fiche", f._id, "·", f.question.fr);
    for (const c of cibles) console.log("  rattache", c._type, c.shopifyHandle);
    return;
  }

  let tx = client.transaction();
  for (const f of FICHES) tx = tx.createOrReplace(f);
  await tx.commit();
  console.log("Fiches écrites.");

  for (const c of cibles) {
    const liste = ordre(c._type === "coffret" ? ORDRE_COFFRET : ORDRE_PARFUM).map(ref);
    for (const id of [c._id, `drafts.${c._id}`]) {
      try {
        await client.patch(id).set({ faqs: liste }).commit();
      } catch (e) {
        // Le brouillon n'existe pas toujours : ce n'est pas une erreur.
        if (!/not found|does not exist/i.test(String(e))) throw e;
      }
    }
    console.log(`  ${c._type} ${c.shopifyHandle} : ${liste.length} questions`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
