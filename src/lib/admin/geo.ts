/**
 * Où poser un pays sur le globe : un centroïde approximatif par code ISO-2.
 * Les 28 pays livrés d'abord, puis les origines de trafic probables. Un pays
 * absent n'est pas dessiné, il reste dans la liste à côté du globe.
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AE: [23.4, 53.8], SA: [23.9, 45.1], QA: [25.3, 51.2], KW: [29.3, 47.5], BH: [26.0, 50.5], OM: [21.5, 55.9],
  JO: [31.2, 36.5], LB: [33.9, 35.9], EG: [26.8, 30.8], MA: [31.8, -7.1], TN: [33.9, 9.5], DZ: [28.0, 1.7],
  FR: [46.6, 2.3], BE: [50.6, 4.5], CH: [46.8, 8.2], LU: [49.8, 6.1], MC: [43.7, 7.4], DE: [51.2, 10.4],
  NL: [52.1, 5.3], GB: [54.2, -2.7], IE: [53.4, -8.2], ES: [40.4, -3.7], PT: [39.4, -8.2], IT: [42.5, 12.6],
  AT: [47.5, 14.6], SE: [62.2, 17.6], DK: [56.3, 9.5], NO: [64.5, 11.0], FI: [64.9, 26.0], PL: [52.1, 19.4],
  CZ: [49.8, 15.5], GR: [39.1, 21.8], TR: [39.0, 35.2], US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.5],
  BR: [-14.2, -51.9], AR: [-38.4, -63.6], AU: [-25.3, 133.8], NZ: [-40.9, 174.9], JP: [36.2, 138.3], KR: [36.5, 127.9],
  CN: [35.9, 104.2], HK: [22.3, 114.2], SG: [1.35, 103.8], MY: [4.2, 101.9], TH: [15.9, 100.9], ID: [-2.5, 118.0],
  IN: [20.6, 78.9], PK: [30.4, 69.3], ZA: [-30.6, 22.9], NG: [9.1, 8.7], KE: [-0.02, 37.9], IL: [31.0, 34.9],
  RU: [61.5, 105.3], UA: [48.4, 31.2], RO: [45.9, 24.9], HU: [47.2, 19.5],
};
export const COUNTRY_NAMES: Record<string, string> = {
  AE: "Émirats arabes unis", SA: "Arabie saoudite", QA: "Qatar", KW: "Koweït", BH: "Bahreïn", OM: "Oman", JO: "Jordanie", LB: "Liban",
  EG: "Égypte", MA: "Maroc", TN: "Tunisie", DZ: "Algérie", FR: "France", BE: "Belgique", CH: "Suisse", LU: "Luxembourg", MC: "Monaco",
  DE: "Allemagne", NL: "Pays-Bas", GB: "Royaume-Uni", IE: "Irlande", ES: "Espagne", PT: "Portugal", IT: "Italie", AT: "Autriche",
  SE: "Suède", DK: "Danemark", NO: "Norvège", FI: "Finlande", PL: "Pologne", CZ: "Tchéquie", GR: "Grèce", TR: "Turquie", US: "États-Unis",
  CA: "Canada", MX: "Mexique", BR: "Brésil", AR: "Argentine", AU: "Australie", NZ: "Nouvelle-Zélande", JP: "Japon", KR: "Corée du Sud",
  CN: "Chine", HK: "Hong Kong", SG: "Singapour", MY: "Malaisie", TH: "Thaïlande", ID: "Indonésie", IN: "Inde", PK: "Pakistan",
  ZA: "Afrique du Sud", NG: "Nigeria", KE: "Kenya", IL: "Israël", RU: "Russie", UA: "Ukraine", RO: "Roumanie", HU: "Hongrie",
};
export const countryName = (code: string | null | undefined) => (code ? COUNTRY_NAMES[code] ?? code : "Inconnu");
