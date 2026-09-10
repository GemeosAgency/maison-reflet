# Grille tarifaire par marché

Décidée le 10 septembre 2026. **Pas encore appliquée** : Shopify refuse toute
devise autre que l'AED tant que la passerelle de paiement ne gère pas le
multi-devises (voir « Ce qui bloque » en fin de document).

## La grille

| Article | AED | SAR | EUR | GBP | CHF | USD |
|---|---|---|---|---|---|---|
| Parfum 75 ml | **320** | **340** | **100** | **85** | **100** | **100** |
| Échantillon 2 ml | 15 | 15 | 5 | 5 | 5 | 5 |
| Coffret découverte | 160 | 170 | 50 | 45 | 50 | 50 |
| Coffret 6 parfums | 2200 | 2350 | 700 | 590 | 700 | 700 |

Livraison offerte à partir de : **400 AED · 450 SAR · 125 € · 110 £ · 125 CHF · 125 $**
(soit 1,25 fois le prix local du 75 ml, le rapport des 400 AED d'origine).

Frais de port : 25 AED domestique · 70 AED Golfe · 18 € · 15 £ · 18 CHF · 20 $.

Ces deux dernières lignes sont **déjà dans le code**, dans
`FREE_SHIPPING_THRESHOLDS` et `SHIPPING_RATES` de `src/lib/markets.ts`. Seuls
les prix produits restent à poser côté Shopify.

## Pourquoi ces montants

Les prix ne sont **pas des conversions** du prix émirati, et c'est délibéré. Aux
taux du 10 septembre, 320 AED valent 74,90 € : un 75 ml de niche à 75 € en
Europe se range aux côtés des marques qui assument le mot « dupe », alors que
la niche accessible commence vers 95-120 €. Le prix est un signal, et c'est le
seul endroit du parcours qu'aucun récit de marque ne rattrape.

L'écart avec le Golfe n'est pas une marge déguisée : il couvre la **TVA**,
incluse d'office dans le prix affiché en Europe et au Royaume-Uni, le port
international et les droits. Ramenés au net de TVA, les six prix se tiennent :

| Marché | Affiché | TVA | Net | Net en AED | vs Émirats |
|---|---|---|---|---|---|
| Émirats | 320 AED | 5 % | 304,76 | 305 | — |
| Arabie saoudite | 340 SAR | 15 % | 295,65 | 290 | −5 % |
| Europe | 100 EUR | 20 % | 83,33 | 356 | +17 % |
| Royaume-Uni | 85 GBP | 20 % | 70,83 | 352 | +16 % |
| Suisse | 100 CHF | 8,1 % | 92,51 | 420 | +38 % |
| Amériques + Asie-Pacifique | 100 USD | — | 100 | 367 | +21 % |

Le Golfe reste ~25 % sous l'Europe : c'est le marché domestique, sans port ni
droits, et l'Arabie saoudite garde 5 % d'avantage supplémentaire comme marché
prioritaire de la marque. Ailleurs, 100 € / 100 CHF / 100 $ forment un prix
mondial unique et mémorisable, et les 85 £ (99 € d'équivalent affiché) s'y
alignent exactement.

Chaque autre article garde son rapport au 75 ml — échantillon 1/21, coffret
découverte 1/2, coffret 6 parfums 6,875× — pour que l'architecture de prix
survive au changement de marché.

## Structure de marchés à atteindre

Shopify ne fixe un prix que **par marché**, et un marché n'a qu'une devise. Une
devise par marché est donc le prix à payer pour des prix ronds partout, au lieu
de conversions automatiques à 74,90 €.

| Marché | Handle | Pays | Devise | Liste de prix |
|---|---|---|---|---|
| Émirats | `ae` | AE | AED | aucune (devise de la boutique) |
| Golfe | `gcc` | KW QA BH OM | AED | aucune |
| Arabie saoudite | `saudi` | SA | SAR | à créer |
| Europe | `europe` | AT BE CZ DE DK ES FI FR IE IT NL NO PL PT SE | EUR | à créer |
| Royaume-Uni | `uk` | GB | GBP | à créer |
| Suisse | `switzerland` | CH | CHF | à créer |
| Amériques | `americas` | US CA | USD | à créer, partagée |
| Asie-Pacifique | `apac` | AU HK JP KR MY NZ SG | USD | la même |

Le reste du Golfe reste en AED : le dinar koweïtien, le riyal qatari, le dinar
bahreïni et le rial omanais sont tous arrimés au dollar comme le dirham, et
l'AED se lit dans tout le Golfe — deux listes de prix économisées sans perte de
lisibilité. Un Suédois paie en euros et un Japonais en dollars, pratique
courante en niche ; le JPY s'ouvrira si le Japon décolle.

**Cinq listes de prix suffisent** (SAR, EUR, GBP, CHF, USD), celle en dollars
étant rattachée aux deux catalogues Amériques et Asie-Pacifique.

## Ce qu'il reste à faire, dans l'ordre

### 1. Activer Shopify Payments

Réglages › Paiements. C'est le seul verrou. Sans lui, `marketCreate` avec
`currencySettings` et `priceListCreate` avec une devise échouent tous deux :

```
The shop's payment gateway does not support enabling more than one currency.
The price list currency is not supported by the shop's payment gateway. (CURRENCY_NOT_SUPPORTED)
```

Aucune app de « currency switcher » ne s'y substitue : elles convertissent
cosmétiquement dans un thème Liquid, ne touchent pas la devise du paiement, et
n'existent pas pour l'API Storefront dont dépend ce site.

### 2. Régler la question de la TVA à l'encaissement

**Le « 100 € TTC » n'est vrai que si la TVA est réellement collectée.** Expédié
depuis Dubaï sans enregistrement fiscal, le colis part en DDU : le client
européen paie TVA, droits et frais de dossier du transporteur **à la
livraison**, en plus des 100 €. Les 100 € deviennent ~130 € effectifs, et les
colis refusés suivent.

À 100 € et 85 £, chaque commande d'un flacon passe **sous le seuil de 150 €**
des régimes simplifiés — c'est exactement la fenêtre de l'**IOSS** pour l'Union
européenne et de la TVA à l'import pour le Royaume-Uni : TVA collectée au
paiement, pas de droits de douane, rien à payer à la porte. Le coffret 6
parfums à 700 € est au-dessus du seuil et supportera des droits ; il faut soit
l'assumer dans la page, soit passer par un accord DDP avec le transporteur.

### 3. Découper les marchés

Trois marchés à créer et deux à amputer :

```graphql
# Sortir SA du Golfe
mutation { marketUpdate(id: "gid://shopify/Market/42543251533", input: {
  conditions: { regionsCondition: { regions: [
    { countryCode: KW }, { countryCode: QA }, { countryCode: BH }, { countryCode: OM }
  ] } } }) { market { handle } userErrors { message } } }

# Sortir GB et CH de l'Europe
mutation { marketUpdate(id: "gid://shopify/Market/42543284301", input: {
  conditions: { regionsCondition: { regions: [
    { countryCode: AT }, { countryCode: BE }, { countryCode: CZ }, { countryCode: DE },
    { countryCode: DK }, { countryCode: ES }, { countryCode: FI }, { countryCode: FR },
    { countryCode: IE }, { countryCode: IT }, { countryCode: NL }, { countryCode: NO },
    { countryCode: PL }, { countryCode: PT }, { countryCode: SE }
  ] } } }) { market { handle } userErrors { message } } }
```

Puis `marketCreate` pour `saudi` (SA), `uk` (GB) et `switzerland` (CH), sur le
modèle des marchés existants, **avec** cette fois :

```graphql
currencySettings: { baseCurrency: SAR, localCurrencies: false }
```

et pour l'Europe, le Royaume-Uni et la Suisse :

```graphql
priceInclusions: { taxPricingStrategy: INCLUDES_TAXES_IN_PRICE }
```

Les Amériques et l'Asie-Pacifique gardent `ADD_TAXES_AT_CHECKOUT` : aux
États-Unis la sales tax s'ajoute au paiement, elle n'entre pas dans le prix
affiché — d'où les 100 $ nets du tableau.

⚠️ `marketUpdate` avec `regionsCondition` **remplace** la liste des pays. Il
faut repasser tous ceux qu'on garde, comme ci-dessus. Même piège que
`deliveryProfileUpdate` : `zonesToUpdate[].countries` écrase aussi la liste.

### 4. Créer les listes de prix et poser les prix fixes

Pour chaque devise, `priceListCreate` (avec `parent.adjustment` à 0 %, les prix
fixes prenant le dessus), puis `priceListFixedPricesAdd` avec les 14 variantes :
six parfums en 75 ml et en 2 ml, le coffret découverte, le coffret 6 parfums.

Les prix fixes sont indispensables : sans eux Shopify convertit et sort des
74,90 €, ce que toute cette grille existe pour éviter.

### 5. Rien à changer dans le code du site

`src/lib/markets.ts` est **déjà** sur cette structure : `COUNTRIES[].currency`
suit le marché et non la monnaie nationale, et les seuils comme les frais de
port sont ceux du tableau. Le site lit la devise réellement pratiquée par
Shopify (`localization.country.currency`, voir `activeCurrency` dans
`src/lib/country.ts`) : le jour où les listes de prix existent, il basculera
tout seul, au prochain déploiement.

## Deux anomalies de prix, non tranchées

- **Le coffret 6 parfums coûte plus cher que six flacons séparés** : 2200 AED
  contre 6 × 320 = 1920. Un client qui compte prend les unités, alors que le
  rôle du coffret est de faire paraître le flacon unitaire raisonnable. Si les
  2200 s'expliquent par l'écrin, il faut le dire sur la page ; sinon 1750
  (≈ 9 % sous les six unités) rétablirait la logique.
- **Le coffret découverte est à 160 AED** pour six échantillons qui valent
  90 AED à l'unité. Plus défendable — packaging, cadeau — mais l'écart est
  visible de qui regarde les deux pages.
