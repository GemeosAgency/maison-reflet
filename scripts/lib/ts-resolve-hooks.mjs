/**
 * Hook de résolution pour les scripts Node du repo.
 *
 * Le code du site importe sans extension (`from "../markets"`), ce qu'Astro et
 * TypeScript résolvent mais pas Node, qui exige `../markets.ts`. Ce hook ajoute
 * `.ts` aux imports relatifs sans extension quand le fichier existe — et rien
 * d'autre. À enregistrer AVANT d'importer du code du site :
 *
 *   import { register } from "node:module";
 *   register("./lib/ts-resolve-hooks.mjs", import.meta.url);
 *   const { buildKnowledge } = await import("../src/lib/luma/knowledge.ts");
 *
 * (import dynamique obligatoire : les imports statiques d'un module sont résolus
 * avant que son corps — donc le register — ne s'exécute.)
 */

import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, next) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  const extensionless = !/\.[a-z0-9]+$/i.test(specifier);
  if (relative && extensionless && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    try {
      await access(fileURLToPath(candidate));
      return next(candidate.href, context);
    } catch {
      /* pas de .ts à cet endroit : résolution normale */
    }
  }
  return next(specifier, context);
}
