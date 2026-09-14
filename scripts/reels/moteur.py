"""Moteur de montage des reels : une conduite de plans → un fichier 1080x1920 calé sur la musique.

Chaque plan est un tuple :
    (source, genre, point d'entrée, durée, mouvement, [fond de carte])

genre   "clip"  une vidéo, recadrée plein cadre
        "photo" une image, recadrée plein cadre
        "carte" une image posée entière sur son fond (rien n'est rogné)

mouvement  "avant" / "arriere"  poussée de 10 %
           "serre"              poussée de 16 %, pour les plans très courts
           "souffle"            presque immobile
           "fixe"               figé
"""
import subprocess, os

W, H, FPS = 1080, 1920, 30

# Le noir et blanc de la Maison : contraste ferme, noirs levés, blancs qui ne brûlent pas.
NOIR = ("format=gbrp,hue=s=0,eq=contrast=1.14:brightness=0.006,"
        "curves=all='0/0.03 0.25/0.215 0.5/0.545 0.75/0.85 1/0.99'")
# La même conduite en couleur, à peine appuyée.
COULEUR = ("format=gbrp,eq=contrast=1.07:saturation=1.10:brightness=0.004,"
           "curves=all='0/0.02 0.5/0.52 1/0.99'")


def mouvement(move, frames):
    """Cadrage image par image ; `on` est le numéro de trame en sortie."""
    n = max(frames - 1, 1)
    if move == "fixe":
        return None
    if move == "avant":
        z = f"1.00+{0.10 / n:.6f}*on"
    elif move == "arriere":
        z = f"1.10-{0.10 / n:.6f}*on"
    elif move == "serre":
        z = f"1.00+{0.16 / n:.6f}*on"
    else:
        z = f"1.03+{0.02 / n:.6f}*on"
    return (f"zoompan=z='{z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":s={W}x{H}:fps={FPS}")


def rendre(plan, dest, grade):
    src, genre, debut, duree, move = plan[:5]
    fond = plan[5] if len(plan) > 5 else "0xf1efec"
    frames = int(round(duree * FPS))

    if genre == "clip":
        entree = ["-ss", f"{debut}", "-t", f"{duree}", "-i", src]
        pre = (f"fps={FPS},scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,"
               f"crop={W * 2}:{H * 2}")
    elif genre == "carte":
        entree = ["-loop", "1", "-t", f"{duree}", "-i", src]
        pre = (f"fps={FPS},scale={W * 2}:{H * 2}:force_original_aspect_ratio=decrease,"
               f"pad={W * 2}:{H * 2}:(ow-iw)/2:(oh-ih)/2:color={fond}")
    else:
        # Les tuiles du Figma ne font que 489 px de large : on rattrape la montée
        # d'échelle par un léger piqué, sinon le plan fixe est mou à côté des clips.
        entree = ["-loop", "1", "-t", f"{duree}", "-i", src]
        pre = (f"fps={FPS},scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase:flags=lanczos,"
               f"crop={W * 2}:{H * 2},unsharp=5:5:0.7:5:5:0.0")

    z = mouvement(move, frames)
    chaine = pre + "," + grade + "," + (z if z else f"scale={W}:{H}") + ",setsar=1,format=yuv420p"

    subprocess.run(["ffmpeg", "-v", "error", "-y"] + entree +
                   ["-vf", chaine, "-frames:v", str(frames), "-an",
                    "-c:v", "libx264", "-crf", "17", "-preset", "medium", dest], check=True)
    return dest


def monter(plans, musique, sortie, grade=NOIR, grain=6.0, fondu=0.6, dossier="."):
    parts, t = [], 0.0
    for i, plan in enumerate(plans, 1):
        if not os.path.exists(plan[0]):
            print(f"  ⚠ absent, ignoré : {plan[0]}")
            continue
        p = os.path.join(dossier, f"x{i:02d}.mp4")
        rendre(plan, p, grade)
        parts.append(p)
        t += plan[3]
        print(f"  {i:02d} {os.path.basename(plan[0]):<18} {plan[4]:<8} → {t:5.2f} s")

    liste = os.path.join(dossier, "liste.txt")
    with open(liste, "w") as f:
        for p in parts:
            f.write(f"file '{os.path.abspath(p)}'\n")
    brut = os.path.join(dossier, "brut.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", liste, "-c", "copy", brut], check=True)

    # Pas de fondu au noir : la carte de fin doit rester nette, seul le son s'efface.
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", brut, "-i", musique,
                    "-vf", f"noise=alls={grain}:allf=t+u",
                    "-af", f"afade=t=out:st={t - fondu:.2f}:d={fondu}", "-t", f"{t}",
                    "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", sortie], check=True)
    d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", sortie], capture_output=True, text=True).stdout.strip()
    print(f"\n{len(parts)} plans · {float(d):.2f} s · {sortie}")
