# Reels

Chaîne de fabrication des reels Instagram de la Maison : on part d'images fixes,
Higgsfield les met en mouvement, ffmpeg les monte sur la musique.

## D'où viennent les images

**Uniquement des trois grilles Instagram du Figma** — ULTRA CUIR, MINUIT BOURBON,
NEW OUD. C'est la seule photographie de campagne validée ; les packshots Shopify et
la planche d'identité du bureau ne servent pas.

Pour les récupérer :

1. `get_metadata` sur la section pour trouver le cadre `INSTA` (2461 × 1832) ;
2. `download_assets` sur ce cadre — son `export` est un PNG à l'échelle 1 ;
3. découper la grille en quinze tuiles de 489 × 608, colonnes à 0 · 493 · 986 · 1479 · 1972,
   lignes à 0 · 612 · 1224 ;
4. les `rawImages` de la même réponse sont les **originaux** (jusqu'à 4096 px) : s'en
   servir pour tout plan tenu, la tuile à 489 px ne tient pas une montée d'échelle de 3×.

`download_assets` s'arrête à vingt images sources par nœud : on n'obtient donc
qu'une partie des originaux. Les plans animés règlent le problème d'eux-mêmes, Kling
rend en 1080p quelle que soit la définition d'entrée.

## La grammaire

Elle vient de la référence qu'on s'est donnée (Archiveno.8) :

- **noir et blanc franc** — c'est ce qui fait tenir ensemble trois Reflets photographiés
  dans trois mondes de couleur différents : bordeaux, vert olive, rose. En couleur,
  une coupe toutes les trois dixièmes entre ces mondes fait du bruit ;
- **coupes sèches sur la mesure**, jamais de fondu enchaîné ;
- **alternance fond clair / fond sombre** d'un plan à l'autre ;
- **un motif qui revient** — ici le visage dans l'ombre, en ouverture puis en respiration ;
- **carte de fin** sobre : le bloc de marque, un filet, le compte.

Le montage suit la musique : `tempo.py` sort le battement, on coupe au demi-temps
pour les rafales et au temps plein pour les respirations. Sur le morceau du reel
collection — 0,600 s de battement, 100 BPM — le demi-temps fait 0,30 s, ce qui tombe
pile sur l'intervalle de coupe médian mesuré sur la référence (0,27 s).

Les changements de mouvement se posent sur des appuis **mesurés** dans le morceau,
pas sur une grille théorique : un morceau généré dérive facilement d'un tiers de
seconde sur quinze secondes.

## Les quatre étapes

```bash
# 1. les plans animés (10 crédits Higgsfield par plan de 5 s)
python3 scripts/reels/plans.py <dossier>          # lit <dossier>/plans.json

# 2. le battement de la musique
python3 scripts/reels/tempo.py musique.m4a

# 3. la carte de fin
python3 scripts/reels/carte-fin.py bloc-marque.jpg carte-fin.png @maisonreflet

# 4. le montage
python3 <conduite>.py             # noir et blanc
python3 <conduite>.py couleur     # la même conduite, en couleur
```

Une conduite est une liste de plans `(source, genre, point d'entrée, durée, mouvement)`
passée à `moteur.monter()`. Voir l'en-tête de `moteur.py`.

## Pièges

- **Higgsfield garde le format de l'image de départ.** Une source en 4:5 ressort en
  1288×1604 même avec `--aspect_ratio 9:16` : `plans.py` recadre avant d'envoyer.
- La CLI s'invoque `npx -y -p @higgsfield/cli higgsfield …` ; sans le `-p`, npx ne
  trouve pas l'exécutable.
- `higgsfield workspace set <id>` avant la première génération, sinon « No workspace selected ».
- La police est livrée en `.ttf` ici parce que Pillow ne lit pas le `.woff2` de
  `public/fonts`. Conversion : `TTFont(src).flavor = None` puis `.save()` (fontTools).
- `timeout` et ImageMagick n'existent pas sur le Mac ; on passe par `sips`.
- **`--wait` abandonne avant le serveur.** Un rendu peut se terminer côté Higgsfield
  alors que la CLI a déjà rendu la main sur « timed out waiting for job ». `plans.py`
  récupère l'identifiant dans le message et redemande le résultat : relancer une
  génération coûterait dix crédits pour rien.
- **L'autocorrélation se trompe de métrique.** Sur le morceau du reel collection elle
  a rendu 0,800 s là où le vrai battement est 0,600 s. `tempo.py` donne maintenant les
  deux estimations : celle qui fait foi est l'ajustement sur les écarts entre appuis.
