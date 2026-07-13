/**
 * Petit point commun pour parler à klaviyo.js (tracking onsite) depuis le
 * navigateur. klaviyo.js est chargé de façon asynchrone (voir Layout.astro) ;
 * `waitForKlaviyo` patiente un court instant au cas où un script tournerait
 * juste après le chargement de la page, avant d'abandonner silencieusement.
 */

export type KlaviyoGlobal = {
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (properties: Record<string, unknown>) => void;
};

function getKlaviyo(): KlaviyoGlobal | undefined {
  return (window as typeof window & { klaviyo?: KlaviyoGlobal }).klaviyo;
}

export async function waitForKlaviyo(timeoutMs = 3000): Promise<KlaviyoGlobal | null> {
  const existing = getKlaviyo();
  if (existing) return existing;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const klaviyo = getKlaviyo();
    if (klaviyo) return klaviyo;
  }
  return null;
}
