"""Conduite du reel « collection » — plusieurs Reflets, une seule maison.

    python3 scripts/reels/collection.py <dossier média> [couleur]

Le dossier média contient les sources nommées telles qu'elles apparaissent ci-dessous :
les plans animés (`plans.py`), deux plans Ultra Cuir, les images d'identité, la carte
de fin (`carte-fin.py`) et `musique.m4a`.

Le rythme vient de deux mesures, pas d'une intuition :

  · la référence qu'on s'est donnée coupe à 0,27 s d'intervalle médian — beaucoup plus
    vite que les deux premières versions, qui ont été refusées pour ça ;
  · la musique bat à 0,600 s (100 BPM). Le demi-temps, 0,30 s, tombe donc pile sur le
    tempo de coupe de la référence.

Les changements de mouvement sont posés sur des appuis réellement mesurés dans le
morceau — 1,60 · 4,00 · 5,60 · 8,00 · 10,00 · 12,00 · 14,40 · 16,80 — et non sur une
grille théorique : le morceau dérive d'un tiers de seconde sur sa durée.

    I    ouverture      0,00 → 1,60    1 × 1,60
    II.A rafale         1,60 → 4,00    8 × 0,30   demi-temps
         accent         4,00 → 5,60    2 × 0,80
    II.B rafale         5,60 → 8,00    8 × 0,30
    III  respiration    8,00 → 10,00   2 × 1,00
    II.C rafale        10,00 → 12,00   5 × 0,40   on décélère
    IV   respiration   12,00 → 14,40   2 × 1,20   les gestes humains
    V    signature     14,40 → 16,80   0,60 + 1,80
                                      ──────────
                                        16,80 s

Un plan qui revient revient loin de lui-même : les points d'entrée d'une même source
sont écartés d'au moins trois secondes, sinon les deux passages se ressemblent trop.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moteur import monter, NOIR, COULEUR

CLAIR, PAPIER = "0xf1efec", "0xe3e3e3"
DEMI, TEMPS = 0.30, 0.60          # 9 et 18 trames à 30 i/s


def conduite(m):
    f = lambda n: os.path.join(m, n)
    return [
        # I. Ouverture — le sceau de cire sur le pétale, la fumée qui passe.
        # (Le monogramme liquide ferait un plus beau logo, mais Kling ne l'anime
        #  presque pas : 0,7 de mouvement moyen contre 8,0 ici. Il sert plus loin,
        #  en ponctuation courte, là où son immobilité devient une qualité.)
        (f("cire.mp4"),          "clip",  0.2, 1.60, "avant"),

        # II.A Rafale — huit demi-temps, clair contre sombre à chaque coupe
        (f("no-fruits.mp4"),     "clip",  0.8, DEMI, "serre"),
        (f("sceau.mp4"),         "clip",  0.6, DEMI, "avant"),
        (f("monogramme.jpg"),    "carte", 0,   DEMI, "fixe",    CLAIR),
        (f("mb-verre.mp4"),      "clip",  0.6, DEMI, "serre"),
        (f("no-roses.mp4"),      "clip",  0.6, DEMI, "avant"),
        (f("tranche.jpg"),       "photo", 0,   DEMI, "serre"),
        (f("ba-flacon.mp4"),     "clip",  0.8, DEMI, "avant"),
        (f("capsules.jpg"),      "photo", 0,   DEMI, "serre"),

        # Accent — deux temps pleins, on repose l'oreille sur la mesure
        (f("mm-flacon.mp4"),     "clip",  0.8, 0.80, "avant"),
        (f("uc-1.mp4"),          "clip",  0.6, 0.80, "serre"),

        # II.B Rafale
        (f("boites.jpg"),        "photo", 0,   DEMI, "avant"),
        (f("emboss.jpg"),        "photo", 0,   DEMI, "serre"),
        (f("fs-flacon.mp4"),     "clip",  0.8, DEMI, "avant"),
        (f("uc-3.mp4"),          "clip",  1.8, DEMI, "serre"),
        (f("chrome.mp4"),        "clip",  3.6, DEMI, "avant"),
        (f("cire.mp4"),          "clip",  3.8, DEMI, "arriere"),
        (f("no-fruits.mp4"),     "clip",  3.6, DEMI, "avant"),
        (f("boite-blanche.jpg"), "photo", 0,   DEMI, "serre"),

        # III. Respiration — deux gestes, une seconde chacun
        (f("mb-mains.mp4"),      "clip",  0.6, 1.00, "avant"),
        (f("no-roses.mp4"),      "clip",  3.4, 1.00, "avant"),

        # II.C Rafale — cinq coupes un peu plus larges : le film décélère
        (f("mb-verre.mp4"),      "clip",  3.8, 0.40, "serre"),
        (f("mm-flacon.mp4"),     "clip",  3.6, 0.40, "avant"),
        (f("sceau.mp4"),         "clip",  3.6, 0.40, "serre"),
        (f("ba-flacon.mp4"),     "clip",  3.6, 0.40, "avant"),
        # (pas la photo du sceau ici : le sceau animé passe deux plans plus tôt
        #  et les deux images se ressemblent trop à 0,4 s d'écart)
        (f("papier.jpg"),        "photo", 0,   0.40, "serre"),

        # IV. Respiration — la main et les fleurs d'oranger, deux temps chacun
        (f("main.mp4"),          "clip",  0.8, 1.20, "avant"),
        (f("mb-mains.mp4"),      "clip",  3.4, 1.20, "arriere"),

        # V. Signature — l'affiche puis la carte, chacune posée sur un appui
        (f("affiche.jpg"),       "carte", 0,   0.60, "souffle", CLAIR),
        (f("carte-fin.png"),     "carte", 0,   1.80, "souffle", PAPIER),
    ]


if __name__ == "__main__":
    media = sys.argv[1]
    couleur = len(sys.argv) > 2 and sys.argv[2].startswith("coul")
    monter(conduite(media), os.path.join(media, "musique.m4a"),
           os.path.join(media, "reel-collection-couleur.mp4" if couleur
                        else "reel-collection.mp4"),
           grade=COULEUR if couleur else NOIR,
           grain=3.0 if couleur else 6.0, dossier=media)
