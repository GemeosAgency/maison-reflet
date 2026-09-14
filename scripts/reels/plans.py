"""Fabrique les plans d'un reel avec Higgsfield : une image de départ, un mouvement, cinq secondes.

    python3 scripts/reels/plans.py <dossier de sortie>

Le dossier doit contenir un manifeste `plans.json` :

    [{"nom": "no-fruits", "image": "sources/no-fruits.jpg", "prompt": "…"}, …]

Chaque image est d'abord recadrée en 9:16 — sans ça Kling garde le format de la
source et rend un 4:5. Compte 10 crédits par plan de 5 s en 1080p.
"""
import json, os, re, subprocess, sys

CLI = ["npx", "-y", "-p", "@higgsfield/cli", "higgsfield"]
MODELE = "kling3_0_turbo"


def recadrer(src, dest):
    """9:16 centré, quelle que soit la taille de la source, puis 1080x1920.

    Indispensable : Kling garde le format de l'image de départ. Une source en 4:5
    ressort en 1288x1604 même avec `--aspect_ratio 9:16`.
    """
    o = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", src],
                       capture_output=True, text=True).stdout.split()
    w, h = int(o[-3]), int(o[-1])
    cw = min(w, round(h * 9 / 16))
    ch = min(h, round(cw * 16 / 9))
    subprocess.run(["sips", "-c", str(ch), str(cw), src, "--out", dest],
                   check=True, capture_output=True)
    subprocess.run(["sips", "-z", "1920", "1080", dest], check=True, capture_output=True)
    return dest


def envoyer(chemin):
    r = subprocess.run(CLI + ["upload", "create", chemin, "--json"],
                       capture_output=True, text=True, cwd="/tmp")
    d = json.loads(r.stdout)
    d = d[0] if isinstance(d, list) else d
    return d.get("id") or d["media_id"]


def _url(sortie):
    d = json.loads(sortie)
    return (d[0] if isinstance(d, list) else d)["result_url"]


def rendre(media_id, prompt):
    r = subprocess.run(
        CLI + ["generate", "create", MODELE, "--start-image", media_id, "--prompt", prompt,
               "--aspect_ratio", "9:16", "--resolution", "1080p", "--duration", "5",
               "--wait", "--json"],
        capture_output=True, text=True, cwd="/tmp")
    try:
        return _url(r.stdout)
    except Exception:
        pass
    # `--wait` abandonne parfois alors que le rendu, lui, va au bout côté serveur.
    # On récupère l'identifiant dans le message d'erreur et on redemande, plutôt que
    # de relancer une génération et de repayer dix crédits.
    m = re.search(r"job ([0-9a-f-]{36})", r.stderr + r.stdout)
    if not m:
        raise RuntimeError((r.stderr or r.stdout)[-300:])
    for _ in range(3):
        w = subprocess.run(CLI + ["generate", "wait", m.group(1), "--json"],
                           capture_output=True, text=True, cwd="/tmp")
        try:
            return _url(w.stdout)
        except Exception:
            continue
    raise RuntimeError(f"rendu {m.group(1)} toujours pas prêt")


def main(dossier):
    manifeste = json.load(open(os.path.join(dossier, "plans.json")))
    urls = {}
    for p in manifeste:
        nom = p["nom"]
        dest = os.path.join(dossier, f"{nom}.mp4")
        if os.path.exists(dest):
            print(f"  {nom} : déjà là")
            continue
        src = os.path.join(dossier, p["image"])
        crop = os.path.join(dossier, f"{nom}-9x16.jpg")
        try:
            recadrer(src, crop)
            url = rendre(envoyer(crop), p["prompt"])
        except Exception as e:
            print(f"  {nom} : échec — {e}")
            continue
        subprocess.run(["curl", "-sL", "-o", dest, url], check=True)
        urls[nom] = url
        print(f"  {nom} ✓")
    with open(os.path.join(dossier, "urls.json"), "w") as f:
        json.dump(urls, f, indent=2)
    print(f"\n{len(urls)}/{len(manifeste)} plans")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
