"""La carte de fin : le bloc de marque posé sur son papier, la signature dessous.

    python3 scripts/reels/carte-fin.py <bloc de marque.jpg> <sortie.png> [@handle]

Le bloc de marque est l'image du monogramme + wordmark ; le fond de la carte est
repris de son pixel supérieur gauche pour que le raccord soit invisible.
La police est PP Neue Montreal, convertie depuis public/fonts (voir README).
"""
from PIL import Image, ImageDraw, ImageFont
import os, sys

W, H = 1080, 1920
ENCRE = (60, 48, 40)
RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
POLICE = os.path.join(RACINE, "scripts", "reels", "ppneuemontreal-medium.ttf")


def lettrage(d, texte, police, y, couleur, tracking):
    """Texte centré, lettre à lettre, pour pouvoir écarter les caractères."""
    largeur = sum(d.textlength(c, font=police) + tracking for c in texte) - tracking
    x = (W - largeur) / 2
    for c in texte:
        d.text((x, y), c, font=police, fill=couleur)
        x += d.textlength(c, font=police) + tracking


def main(bloc_src, sortie, handle="@maisonreflet"):
    base = Image.open(bloc_src).convert("RGB")
    fond = base.getpixel((8, 8))
    bloc = base.resize((W, round(W * base.height / base.width)), Image.LANCZOS)

    carte = Image.new("RGB", (W, H), fond)
    carte.paste(bloc, (0, (H - bloc.height) // 2))

    d = ImageDraw.Draw(carte)
    d.line([(W / 2 - 70, 1200), (W / 2 + 70, 1200)], fill=ENCRE, width=2)
    lettrage(d, handle.upper(), ImageFont.truetype(POLICE, 30), 1258, ENCRE, 6.5)

    carte.save(sortie)
    print(sortie, carte.size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "@maisonreflet")
