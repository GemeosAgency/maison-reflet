// Copie NAVIGATEUR du Purchase Meta, sur le checkout Shopify (kit checkout headless).
// À coller dans Shopify : Paramètres > Événements clients > Ajouter un pixel personnalisé
//   Nom : « Meta Purchase - maisonreflet.com » ; Autorisation : « Non requise » ;
//   Vente de données : « Ne constitue pas une vente ». Enregistrer, puis Connecter.
// Même event_id que le webhook (src/pages/api/webhooks/shopify-orders.ts) : « mr-checkout-<checkout token> ».
// Meta n'en garde qu'un des deux.
const PIXEL_ID = '2374522776687545';

const lastDigits = (s) => (String(s ?? '').match(/(\d+)(?!.*\d)/) || [])[1];
const text = (s) => (s == null ? '' : String(s)).trim().toLowerCase();

analytics.subscribe('checkout_completed', (event) => {
  const c = event.data && event.data.checkout;
  // La clé partagée avec le webhook est le token du checkout ; le numéro de commande ne part qu'en order_id.
  const orderId = c && c.order && lastDigits(c.order.id);
  if (!c || (!c.token && !orderId)) return;
  const attribute = (key) => ((c.attributes || []).find((a) => a.key === key) || {}).value;
  // Appareils de l'équipe (?internal=1 sur le site) : jamais comptés.
  if (attribute('_internal') === '1') return;

  // Les cookies Meta du site, portés par le panier : le pixel les relit quand le bac à sable autorise les cookies.
  for (const [name, re] of [['_fbp', /^fb\.\d\.\d{10,13}\.\d+(\.[\w-]{2,8})?$/], ['_fbc', /^fb\.\d\.\d{10,13}\.[^\s;,]{1,500}$/]]) {
    const v = attribute(name);
    if (v && re.test(v)) try { document.cookie = `${name}=${v}; max-age=7776000; path=/; SameSite=Lax; Secure`; } catch (e) { /* bac à sable sans cookies */ }
  }

  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');

  // Correspondance avancée : valeurs normalisées, hachées par le pixel lui-même.
  const a = c.billingAddress || c.shippingAddress || {};
  const country = String(a.countryCode || 'AE').toUpperCase();
  const matching = {};
  if (c.email) matching.em = text(c.email);
  let phone = String(c.phone || a.phone || (c.shippingAddress && c.shippingAddress.phone) || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  else if (phone.startsWith('0') && country === 'AE') phone = '971' + phone.slice(1);
  else if (phone.length === 9 && phone.startsWith('5') && country === 'AE') phone = '971' + phone;
  if (phone.length >= 8 && phone.length <= 15) matching.ph = phone;
  if (a.firstName) matching.fn = text(a.firstName);
  if (a.lastName) matching.ln = text(a.lastName);
  if (a.city) matching.ct = text(a.city).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  if (a.provinceCode) matching.st = text(a.provinceCode).replace(/[^a-z0-9]/g, '');
  if (a.zip) matching.zp = text(a.zip).replace(/[^a-z0-9]/g, '');
  matching.country = country.toLowerCase();
  // Le même identifiant externe que le Pixel du site (UUID, lib/meta.ts).
  const xid = attribute('_xid');
  if (xid && /^[a-f0-9-]{32,64}$/i.test(xid)) matching.external_id = xid;

  const contents = (c.lineItems || []).map((l) => ({
    id: lastDigits(l.variant && l.variant.id),
    quantity: l.quantity || 1,
    item_price: Number(l.variant && l.variant.price && l.variant.price.amount) || 0,
  })).filter((x) => x.id && x.item_price > 0);
  fbq('set', 'autoConfig', false, PIXEL_ID);
  fbq('init', PIXEL_ID, matching);
  fbq('track', 'Purchase', {
    value: Number(c.totalPrice && c.totalPrice.amount) || 0,
    currency: (c.totalPrice && c.totalPrice.currencyCode) || c.currencyCode || 'AED',
    content_type: 'product',
    content_ids: contents.map((x) => x.id),
    contents,
    num_items: contents.reduce((n, x) => n + x.quantity, 0),
    order_id: orderId || undefined,
  }, { eventID: c.token && /^[A-Za-z0-9_-]{8,64}$/.test(c.token) ? 'mr-checkout-' + c.token : 'purchase:' + orderId });
});
