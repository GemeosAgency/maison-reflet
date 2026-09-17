"""Les cartes typographiques de l'annonce Ultra Cuir : l'accroche et la signature."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1080, 1920
D = os.path.dirname(os.path.abspath(__file__))
POLICE = "/Users/sandrodasilva/Desktop/maison-reflet/scripts/reels/ppneuemontreal-medium.ttf"
LIVRE = "/Users/sandrodasilva/Desktop/maison-reflet/scripts/reels/ppneuemontreal-medium.ttf"
PAPIER = (247, 245, 242)


def lettrage(d, texte, police, y, couleur, tracking, largeur=W):
    l = sum(d.textlength(c, font=police) + tracking for c in texte) - tracking
    x = (largeur - l) / 2
    for c in texte:
        d.text((x, y), c, font=police, fill=couleur)
        x += d.textlength(c, font=police) + tracking


def fond_sombre(src, flou=14, voile=0.62):
    """Une image de la campagne, floutée et assombrie : le texte reste le sujet."""
    im = Image.open(src).convert("RGB")
    r = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
    im = im.filter(ImageFilter.GaussianBlur(flou))
    voile_im = Image.new("RGB", (W, H), (12, 6, 8))
    return Image.blend(im, voile_im, voile)


def accroche(src, ligne1, ligne2, sortie):
    im = fond_sombre(src)
    d = ImageDraw.Draw(im)
    lettrage(d, ligne1, ImageFont.truetype(POLICE, 98), 800, PAPIER, 5)
    if ligne2:
        lettrage(d, ligne2, ImageFont.truetype(POLICE, 98), 930, PAPIER, 5)
    im.save(sortie)
    print(sortie)


def signature(nom, episode, promesse, handle, sortie):
    im = Image.new("RGB", (W, H), (12, 6, 8))
    d = ImageDraw.Draw(im)
    lettrage(d, nom, ImageFont.truetype(POLICE, 72), 820, PAPIER, 10)
    d.line([(W / 2 - 80, 940), (W / 2 + 80, 940)], fill=(120, 108, 100), width=2)
    lettrage(d, episode, ImageFont.truetype(LIVRE, 38), 1000, (214, 204, 196), 6)
    lettrage(d, promesse, ImageFont.truetype(LIVRE, 34), 1080, (186, 176, 168), 1)
    lettrage(d, handle, ImageFont.truetype(POLICE, 42), 1220, PAPIER, 7)
    im.save(sortie)
    print(sortie)


if __name__ == "__main__":
    src = os.path.join(D, "src", "uc2.jpg")  # framboises sur le cuir
    accroche(src, "TUSCAN", "LEATHER", os.path.join(D, "media", "h1.jpg"))
    accroche(src, "RÉINTERPRÉTÉ", "", os.path.join(D, "media", "h2.jpg"))
    signature("ULTRA CUIR", "ÉPISODE 1 SUR 6",
              "Les six Reflets se dévoilent ici", "@MAISONREFLET",
              os.path.join(D, "media", "fin.jpg"))
