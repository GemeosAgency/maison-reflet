-- =============================================================================
-- La TVA, pour que la marge cesse d'être surévaluée.
--
-- Les prix de Maison Reflet sont TTC (Sandro, 18 septembre 2026) : le chiffre
-- d'affaires enregistré contient donc 5 % de TVA émiratie que la Maison ne
-- garde pas. La marge brute comparait jusqu'ici un chiffre TTC à un coût HT,
-- et se trouvait surévaluée d'environ 5 %.
--
-- Shopify envoie les deux informations à chaque commande : le montant de taxe,
-- et si les prix affichés la contiennent déjà. On garde les deux plutôt que de
-- recalculer avec un taux en dur : les ventes hors GCC sont à taux zéro, et un
-- taux appliqué uniformément serait faux pour elles.
--
-- Les commandes déjà enregistrées gardent une taxe à zéro. C'est volontaire :
-- mieux vaut une marge qu'on sait incomplète sur l'historique qu'une taxe
-- inventée après coup.
-- =============================================================================
alter table shop_orders add column if not exists tax numeric(12, 2) not null default 0;
alter table shop_orders add column if not exists taxes_included boolean not null default true;

comment on column shop_orders.tax is
  'Montant de TVA de la commande (Shopify total_tax). Sert à calculer la marge sur le hors taxes.';
comment on column shop_orders.taxes_included is
  'Vrai si les prix affichés contiennent déjà la taxe (Shopify taxes_included). Aux Émirats, prix TTC.';
