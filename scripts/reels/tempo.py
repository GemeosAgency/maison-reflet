"""Battement et appuis d'un morceau, en Python pur — pas de dépendance audio.

    python3 scripts/reels/tempo.py musique.m4a

Enveloppe d'énergie à 20 ms, flux positif, puis deux estimations du battement :

  · par autocorrélation du flux — robuste au bruit, mais elle se trompe de métrique
    (elle a rendu 0,800 s sur un morceau à 0,600) ;
  · par ajustement sur les écarts entre appuis — chaque écart doit tomber sur un
    multiple entier du battement. C'est celle qui fait foi ; l'autre sert de garde-fou.

Quand les deux divergent, prendre l'ajustement et vérifier que les appuis mesurés
retombent bien sur la grille.
"""
import subprocess, sys, math

SR = 8000
FRAME = 160  # 20 ms


def enveloppe(chemin):
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", chemin, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True, check=True).stdout
    n = len(pcm) // 2
    env = []
    for i in range(0, n - FRAME, FRAME):
        s = 0
        for j in range(i, i + FRAME):
            v = int.from_bytes(pcm[2 * j:2 * j + 2], "little", signed=True)
            s += v * v
        env.append(math.sqrt(s / FRAME))
    return env


def par_autocorrelation(flux):
    best = []
    for lag in range(int(0.3 * SR / FRAME), int(1.2 * SR / FRAME)):
        c = sum(a * b for a, b in zip(flux, flux[lag:]))
        best.append((c, lag))
    best.sort(reverse=True)
    return best[0][1] * FRAME / SR


def par_ecarts(appuis):
    """Le battement dont les multiples entiers collent le mieux aux écarts mesurés."""
    if len(appuis) < 4:
        return None
    ecarts = [appuis[i] - appuis[i - 1] for i in range(1, len(appuis))]
    res = []
    b = 0.40
    while b <= 1.20:
        e = 0.0
        for g in ecarts:
            k = min(max(1, round(g / b)), 4)
            e += (g - k * b) ** 2
        res.append((e, b))
        b += 0.005
    return min(res)[1]


def main(chemin):
    env = enveloppe(chemin)
    duree = len(env) * FRAME / SR
    flux = [max(0.0, env[i] - env[i - 1]) for i in range(1, len(env))]
    moy = sum(flux) / len(flux)

    grossier = par_autocorrelation(flux)
    appuis = []
    for i in range(1, len(flux) - 1):
        if flux[i] > 2 * moy and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1]:
            t = i * FRAME / SR
            if not appuis or t - appuis[-1] > grossier * 0.6:
                appuis.append(round(t, 2))
    fin = par_ecarts(appuis) or grossier

    print(f"{chemin}  durée {duree:.1f} s")
    print(f"  autocorrélation  {grossier:.3f} s ≈ {60 / grossier:5.1f} BPM  (garde-fou)")
    print(f"  ajustement       {fin:.3f} s ≈ {60 / fin:5.1f} BPM  ← celle qui fait foi")
    print(f"  demi-temps {fin / 2:.3f} s · triolet {fin / 3:.3f} s")
    print(f"  {len(appuis)} appuis : {' '.join(f'{p:.2f}' for p in appuis[:24])}")
    return fin, appuis


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
        print()
