"""Conduite d'une annonce « abonnement » — un épisode de la série « inspiré de ».

    python3 scripts/reels/ad-follow.py <dossier média>

Le but n'est pas de vendre, c'est de faire s'abonner. Trois règles de fabrication
en découlent, et elles pilotent le découpage :

  1. l'accroche nomme l'icône, pas le parfum. La reconnaissance fait le travail
     du premier dixième de seconde, le flacon ne le ferait pas ;
  2. le film doit se voir comme un épisode : la carte de fin porte « épisode 1
     sur 6 ». C'est la numérotation qui déclenche l'abonnement, pas la beauté ;
  3. le compte est lisible à la fin, et la promesse est une raison de s'abonner,
     pas un « suivez-nous ».

Le découpage suit la même mesure que le reel collection : 0,600 s de battement,
coupes au demi-temps dans la rafale, appuis mesurés aux changements de section.

    accroche      0,00 → 1,50   2 cartes : l'icône, puis le geste
    matière       1,50 → 5,10   6 × 0,60
    respiration   5,10 → 8,10   2 × 1,50   le geste humain
    objet         8,10 → 11,70  6 × 0,60
    signature    11,70 → 14,40  la carte, tenue
                               ─────────
                                14,40 s

Une carte de fin qui tenait 4,2 s sur 15 mangeait plus du quart du film. Deux
secondes et demie suffisent à lire le compte et la promesse.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moteur import monter, COULEUR

SOMBRE = "0x0c0608"


def conduite(m):
    f = lambda n: os.path.join(m, n)
    return [
        # Accroche — on nomme Tuscan Leather, puis on annonce le geste
        (f("h1.jpg"),             "carte", 0,   0.90, "souffle", SOMBRE),
        (f("h2.jpg"),             "carte", 0,   0.60, "souffle", SOMBRE),

        # La matière — ce qui change tout : la framboise, le safran
        (f("uc-framboises.mp4"),  "clip",  0.6, 0.60, "serre"),
        (f("uc-safran.mp4"),      "clip",  1.0, 0.60, "avant"),
        (f("uc-framboises.mp4"),  "clip",  3.4, 0.60, "arriere"),
        (f("uc-bouchon.mp4"),     "clip",  0.8, 0.60, "serre"),
        (f("uc-safran.mp4"),      "clip",  3.2, 0.60, "avant"),
        (f("uc-main.mp4"),        "clip",  0.6, 0.60, "serre"),

        # Respiration — le geste, deux plans tenus
        (f("uc-safran.mp4"),      "clip",  2.0, 1.50, "avant"),
        (f("uc-framboises.mp4"),  "clip",  1.8, 1.50, "avant"),

        # L'objet — on arrive au flacon, quatre coupes
        (f("uc-bouchon.mp4"),     "clip",  2.4, 0.60, "serre"),
        (f("uc-main.mp4"),        "clip",  2.2, 0.60, "avant"),
        (f("uc-framboises.mp4"),  "clip",  2.8, 0.60, "serre"),
        (f("uc-bouchon.mp4"),     "clip",  3.8, 0.60, "arriere"),
        (f("uc-safran.mp4"),      "clip",  3.9, 0.60, "avant"),
        (f("uc-main.mp4"),        "clip",  3.6, 0.60, "avant"),

        # Signature — le nom, l'épisode, la raison, le compte
        (f("fin.jpg"),            "carte", 0,   2.70, "souffle", SOMBRE),
    ]


if __name__ == "__main__":
    media = sys.argv[1]
    monter(conduite(media), os.path.join(media, "musique.m4a"),
           os.path.join(media, "ad-ultra-cuir.mp4"),
           grade=COULEUR, grain=3.0, dossier=media)
