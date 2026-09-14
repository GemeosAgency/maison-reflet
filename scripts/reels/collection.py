"""Conduite du reel « collection » — trois Reflets, une seule maison.

    python3 scripts/reels/collection.py <dossier média> [couleur]

Les images viennent **uniquement** des trois grilles Instagram du Figma (ULTRA CUIR,
MINUIT BOURBON, NEW OUD) : treize d'entre elles sont animées par Higgsfield, les autres
passent en plan fixe sur les temps courts. La carte de fin est composée sur le papier
de la campagne.

Le rythme vient de deux mesures, pas d'une intuition :

  · la référence qu'on s'est donnée coupe à 0,27 s d'intervalle médian — beaucoup plus
    vite que les premières versions, qui ont été refusées pour ça ;
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
    IV   respiration   12,00 → 14,40   2 × 1,20
    V    signature     14,40 → 16,80   0,60 + 1,80
                                      ──────────
                                        16,80 s

Deux règles tenues d'un bout à l'autre : les trois mondes se relaient d'une coupe à
l'autre (bordeaux, vert, rose), et un plan qui revient revient loin de lui-même —
au moins trois secondes d'écart entre deux points d'entrée d'une même source.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moteur import monter, NOIR, COULEUR

PAPIER = "0xe6e3dd"
DEMI = 0.30          # 9 trames à 30 i/s


def conduite(m):
    f = lambda n: os.path.join(m, n)
    return [
        # I. Ouverture — le visage dans l'ombre, une lame de lumière sur la bouche
        (f("uc-visage.mp4"),          "clip",  0.6, 1.60, "avant"),

        # II.A Rafale — huit demi-temps, les trois mondes se relaient
        (f("no-fruits.mp4"),          "clip",  0.8, DEMI, "serre"),
        (f("uc-framboises-cuir.png"), "photo", 0,   DEMI, "serre"),
        (f("mb-livre.png"),           "photo", 0,   DEMI, "avant"),
        (f("uc-capuchon.mp4"),        "clip",  0.6, DEMI, "serre"),
        (f("no-petale.png"),          "photo", 0,   DEMI, "avant"),
        (f("mb-ambre.mp4"),           "clip",  0.6, DEMI, "serre"),
        (f("no-plateau.png"),         "photo", 0,   DEMI, "avant"),
        (f("uc-framboises.mp4"),      "clip",  0.8, DEMI, "serre"),

        # Accent — deux temps pleins sur les mains : la fleur d'oranger, puis le flacon
        (f("mb-fleurs.mp4"),          "clip",  0.6, 0.80, "avant"),
        (f("uc-main.mp4"),            "clip",  0.6, 0.80, "serre"),

        # II.B Rafale
        (f("no-bois-flotte.png"),     "photo", 0,   DEMI, "avant"),
        (f("uc-touches.png"),         "photo", 0,   DEMI, "serre"),
        (f("mb-gousses.png"),         "photo", 0,   DEMI, "avant"),
        (f("no-bois.png"),            "photo", 0,   DEMI, "serre"),
        (f("mb-ecorce.mp4"),          "clip",  0.8, DEMI, "avant"),
        (f("uc-formules.png"),        "photo", 0,   DEMI, "serre"),
        (f("no-rosier.mp4"),          "clip",  0.8, DEMI, "avant"),
        (f("mb-sechoir.png"),         "photo", 0,   DEMI, "serre"),

        # III. Respiration — la cueilleuse, puis le visage qui revient
        (f("no-cueilleuse.mp4"),      "clip",  0.6, 1.00, "avant"),
        (f("uc-visage.mp4"),          "clip",  3.4, 1.00, "arriere"),

        # II.C Rafale — cinq coupes un peu plus larges : le film décélère
        (f("mb-capuchon.png"),        "photo", 0,   0.40, "serre"),
        (f("no-fruits.mp4"),          "clip",  3.6, 0.40, "avant"),
        (f("uc-safran.png"),          "photo", 0,   0.40, "serre"),
        (f("no-alambic.png"),         "photo", 0,   0.40, "avant"),
        (f("uc-main.mp4"),            "clip",  3.4, 0.40, "serre"),

        # IV. Respiration — deux gestes, deux temps chacun
        (f("mb-tapis.mp4"),           "clip",  1.0, 1.20, "arriere"),
        (f("no-petales.mp4"),         "clip",  0.8, 1.20, "avant"),

        # V. Signature — la pipette de l'atelier, puis la carte sur le papier de la campagne
        (f("mb-pipette.png"),         "photo", 0,   0.60, "souffle"),
        (f("carte-fin.png"),          "carte", 0,   1.80, "souffle", PAPIER),
    ]


if __name__ == "__main__":
    media = sys.argv[1]
    couleur = len(sys.argv) > 2 and sys.argv[2].startswith("coul")
    monter(conduite(media), os.path.join(media, "musique.m4a"),
           os.path.join(media, "reel-collection-couleur.mp4" if couleur
                        else "reel-collection.mp4"),
           grade=COULEUR if couleur else NOIR,
           grain=3.0 if couleur else 6.0, dossier=media)
