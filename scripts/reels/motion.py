"""Motion sur la photographie du Figma — apparition, disparition, fondu dynamique.

Aucune image n'est générée. Tout vient des grilles INSTA du Figma, découpées en
tuiles 489×608 : rien ne peut être inventé par un modèle, et une itération coûte
trente secondes de calcul au lieu de dix crédits.

Le mouvement est dans la composition autant que dans les fondus. Six cadres se
relaient — plein écran, carte, petite carte haute, carte basse, duo, bande — ce
qui donne au film un rythme que des vignettes toutes identiques n'ont pas. La
photo n'est en plein écran que sur les temps forts, parce que les tuiles ne font
que 489 px de large et qu'un agrandissement de 3,2× ne tient pas sur un plan long.

    python3 scripts/reels/motion.py <dossier-figma> <musique> <sortie.mp4> [uc|mb|no]
"""
import os, subprocess, sys
from PIL import Image

L, H, FPS = 1080, 1920, 24
COLS = (0, 493, 986, 1479, 1972)
ROWS = (0, 612, 1224)
TL, TH = 489, 608

# (tuile, cadre) — le fil suit la pyramide : flacon, tête, cœur, fond, retour.
CONDUITES = {
    "uc": [(2, "plein"), (5, "carte"), (1, "bande"), (9, "haute"), (4, "plein"),
           (14, "basse"), (13, "duo:11"), (10, "carte"), (12, "plein"), (3, "bande"), (7, "carte")],
    "mb": [(1, "plein"), (2, "carte"), (6, "bande"), (4, "haute"), (8, "plein"),
           (9, "basse"), (3, "duo:12"), (11, "carte"), (5, "plein"), (7, "bande"), (1, "carte")],
    "no": [(1, "plein"), (6, "carte"), (3, "bande"), (7, "haute"), (4, "plein"),
           (12, "basse"), (8, "duo:10"), (11, "carte"), (5, "plein"), (2, "bande"), (1, "carte")],
}


def tuiles(grille, dest):
    im = Image.open(grille).convert("RGB")
    os.makedirs(dest, exist_ok=True)
    out = []
    for i in range(15):
        x, y = COLS[i % 5], ROWS[i // 5]
        c = os.path.join(dest, f"t{i + 1:02d}.png")
        im.crop((x, y, x + TL, y + TH)).save(c)
        out.append(c)
    return out


def dominante(chemins):
    """Le fond : la dominante des tuiles, ramenée à un noir teinté."""
    r = v = b = n = 0
    for c in chemins:
        for px in Image.open(c).convert("RGB").resize((32, 40)).getdata():
            r += px[0]; v += px[1]; b += px[2]; n += 1
    r, v, b = r / n, v / n, b / n
    k = 26 / (max(r, v, b) or 1)
    return "0x%02X%02X%02X" % (int(r * k), int(v * k), int(b * k))


def cadre(nom, d):
    """Rend (filtre, nombre d'images source). `d` est la durée du plan.

    Chaque cadre porte sa propre dérive : c'est elle qui empêche l'image de
    paraître morte entre deux fondus, et elle change de sens d'un plan à l'autre.
    """
    if nom == "plein":                      # temps fort : la photo prend tout, et respire
        return (f"[1:v]scale=-1:{int(H * 1.10)}:flags=lanczos,crop={int(L * 1.10)}:{int(H * 1.10)},"
                f"zoompan=z='1.10-0.10*on/{int(d * FPS)}':d={int(d * FPS)}:s={L}x{H}:fps={FPS},setsar=1[v]"), 1
    if nom == "carte":
        return pose(820, 1025, (L - 820) // 2, 400, -16, d), 1
    if nom == "haute":                      # plus petite, plus haut : on respire
        return pose(620, 775, (L - 620) // 2, 330, 14, d), 1
    if nom == "basse":
        return pose(720, 900, (L - 720) // 2, 690, -14, d), 1
    if nom == "bande":                      # un bandeau large, coupé dans la hauteur
        return (f"[1:v]scale={L}:-1:flags=lanczos,crop={L}:760,setsar=1[c];"
                f"[0:v][c]overlay=x=0:y='580+18*t/{d:.3f}',format=yuv420p[v]"), 1
    if nom.startswith("duo"):               # deux images côte à côte, décalées
        return (f"[1:v]scale=470:588:flags=lanczos,setsar=1[a];"
                f"[2:v]scale=470:588:flags=lanczos,setsar=1[b];"
                f"[0:v][a]overlay=x=42:y='620-14*t/{d:.3f}'[m];"
                f"[m][b]overlay=x=568:y='712+14*t/{d:.3f}',format=yuv420p[v]"), 2
    raise ValueError(nom)


def pose(w, h, x, y, derive, d):
    return (f"[1:v]scale={w}:{h}:flags=lanczos,setsar=1[c];"
            f"[0:v][c]overlay=x={x}:y='{y}+{derive}*t/{d:.3f}',format=yuv420p[v]")


def plan(images, fond, d, sortie):
    nom, n = images[-1], len(images) - 1
    filtre, _ = cadre(nom, d)
    entrees = []
    for im in images[:-1]:
        entrees += ["-loop", "1", "-i", im]
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y",
         "-f", "lavfi", "-i", f"color=c={fond}:s={L}x{H}:d={d:.3f}:r={FPS}", *entrees,
         "-filter_complex", filtre, "-map", "[v]",
         "-t", f"{d:.3f}", "-r", str(FPS), "-c:v", "libx264", "-crf", "16", sortie],
        check=True)


TRANSITIONS = ["fade", "dissolve", "smoothup", "fade", "wipeup",
               "dissolve", "fade", "smoothdown", "dissolve", "fade"]


def battement(musique):
    r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tempo.py"), musique],
                       capture_output=True, text=True)
    for ligne in r.stdout.splitlines():
        if "ajustement" in ligne:
            return float(ligne.split()[1])
    return 0.4


def film(dossier, musique, sortie, clef, travail):
    tt = tuiles(os.path.join(dossier, "grille.png"), travail)
    conduite = CONDUITES[clef]
    fond = dominante([tt[t - 1] for t, _ in conduite])
    b = battement(musique)
    duree = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                  "-of", "csv=p=0", musique], capture_output=True, text=True,
                                 check=True).stdout.strip())
    fondu = round(b / 2, 3)
    n = len(conduite)
    d = round(((duree + (n - 1) * fondu) / n) / b) * b
    print(f"  fond {fond} · battement {b:.3f}s · {n} plans de {d:.2f}s · fondu {fondu}s")

    bouts = []
    for i, (t, nom) in enumerate(conduite):
        ims = [tt[t - 1]]
        if nom.startswith("duo:"):
            ims.append(tt[int(nom.split(":")[1]) - 1])
        out = os.path.join(travail, f"p{i:02d}.mp4")
        plan(ims + [nom.split(":")[0] if nom.startswith("duo") else nom], fond, d, out)
        bouts.append(out)

    entrees, filtres, courant, offset = [], [], "[0:v]", 0.0
    for b_ in bouts:
        entrees += ["-i", b_]
    for i in range(1, len(bouts)):
        offset += d - fondu
        tr = TRANSITIONS[(i - 1) % len(TRANSITIONS)]
        filtres.append(f"{courant}[{i}:v]xfade=transition={tr}:duration={fondu}:offset={offset:.3f}[x{i}]")
        courant = f"[x{i}]"
    chaine = ";".join(filtres) + f";{courant}fade=t=in:st=0:d=0.35,fade=t=out:st={duree - 0.6:.2f}:d=0.6[v]"

    subprocess.run(["ffmpeg", "-v", "error", "-y", *entrees, "-i", musique,
                    "-filter_complex", chaine, "-map", "[v]", "-map", f"{len(bouts)}:a",
                    "-t", f"{duree:.3f}", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", sortie], check=True)
    print(f"  {os.path.basename(sortie)} · {duree:.2f}s")


if __name__ == "__main__":
    dossier, musique, sortie = sys.argv[1], sys.argv[2], sys.argv[3]
    clef = sys.argv[4] if len(sys.argv) > 4 else os.path.basename(dossier.rstrip("/"))
    travail = os.path.join(os.path.dirname(sortie), f"_{clef}")
    os.makedirs(travail, exist_ok=True)
    film(dossier, musique, sortie, clef, travail)
