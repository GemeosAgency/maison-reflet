"""La carte de fin : le papier de la campagne, le nom de la maison, la signature.

    python3 scripts/reels/carte-fin.py <papier.png> <sortie.png> [@handle]

Le papier vient d'une image de la campagne — on en prélève une bande propre, sans
texte, qu'on répète en miroir pour couvrir le 9:16 sans raccord visible. La typo est
PP Neue Montreal, livrée en .ttf à côté (Pillow ne lit pas le .woff2 de public/fonts).
"""
from PIL import Image, ImageDraw, ImageFont, ImageOps
import os, sys

W, H = 1080, 1920
ENCRE = (48, 44, 40)
D = os.path.dirname(os.path.abspath(__file__))
POLICE = os.path.join(D, "ppneuemontreal-medium.ttf")

# bande propre dans la tuile de texte : sous le titre, au-dessus du paragraphe
BANDE = (0, 0.15, 1.0, 0.54)


def papier(src):
    """Une bande de papier répétée en miroir jusqu'à couvrir le cadre."""
    im = Image.open(src).convert("RGB")
    x0, y0, x1, y1 = BANDE
    bande = im.crop((int(x0 * im.width), int(y0 * im.height),
                     int(x1 * im.width), int(y1 * im.height)))
    bande = bande.resize((W, round(W * bande.height / bande.width)), Image.LANCZOS)
    fond = Image.new("RGB", (W, H))
    y, flip = 0, False
    while y < H:
        fond.paste(ImageOps.flip(bande) if flip else bande, (0, y))
        y += bande.height
        flip = not flip
    return fond


def lettrage(d, texte, police, y, couleur, tracking):
    """Texte centré, lettre à lettre, pour pouvoir écarter les caractères."""
    largeur = sum(d.textlength(c, font=police) + tracking for c in texte) - tracking
    x = (W - largeur) / 2
    for c in texte:
        d.text((x, y), c, font=police, fill=couleur)
        x += d.textlength(c, font=police) + tracking


def main(src, sortie, handle="@maisonreflet"):
    carte = papier(src)
    d = ImageDraw.Draw(carte)
    lettrage(d, "MAISON", ImageFont.truetype(POLICE, 52), 872, ENCRE, 13)
    lettrage(d, "REFLET", ImageFont.truetype(POLICE, 52), 940, ENCRE, 13)
    d.line([(W / 2 - 64, 1064), (W / 2 + 64, 1064)], fill=ENCRE, width=2)
    lettrage(d, handle.upper(), ImageFont.truetype(POLICE, 27), 1118, ENCRE, 6)
    carte.save(sortie)
    print(sortie, carte.size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "@maisonreflet")
