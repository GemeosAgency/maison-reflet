"""Fabrique les plans d'un reel avec Higgsfield : une image de départ, un mouvement, cinq secondes.

    python3 scripts/reels/plans.py <dossier de sortie>

Le dossier doit contenir un manifeste `plans.json` :

    [{"nom": "no-fruits", "image": "sources/no-fruits.jpg", "prompt": "…"}, …]

Chaque image est d'abord recadrée en 9:16 — sans ça Kling garde le format de la
source et rend un 4:5. Compte 10 crédits par plan de 5 s en 1080p.
"""
import json, os, subprocess, sys

CLI = ["npx", "-y", "-p", "@higgsfield/cli", "higgsfield"]
MODELE = "kling3_0_turbo"


def recadrer(src, dest):
    """9:16 centré, puis mise à l'échelle en 1080x1920."""
    subprocess.run(["sips", "-c", "1500", "843", src, "--out", dest],
                   check=True, capture_output=True)
    subprocess.run(["sips", "-z", "1920", "1080", dest], check=True, capture_output=True)
    return dest


def envoyer(chemin):
    r = subprocess.run(CLI + ["upload", "create", chemin, "--json"],
                       capture_output=True, text=True, cwd="/tmp")
    d = json.loads(r.stdout)
    d = d[0] if isinstance(d, list) else d
    return d.get("id") or d["media_id"]


def rendre(media_id, prompt):
    r = subprocess.run(
        CLI + ["generate", "create", MODELE, "--start-image", media_id, "--prompt", prompt,
               "--aspect_ratio", "9:16", "--resolution", "1080p", "--duration", "5",
               "--wait", "--json"],
        capture_output=True, text=True, cwd="/tmp")
    d = json.loads(r.stdout)
    return (d[0] if isinstance(d, list) else d)["result_url"]


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
