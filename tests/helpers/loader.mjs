// Test-only module hooks: CDN URLs and browser-only app modules resolve to local stubs.
const stub = name => new URL(`./${name}`, import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://cdn.jsdelivr.net/npm/pdf-lib')) return { url: stub('stub-pdflib.mjs'), shortCircuit: true };
  if (specifier.startsWith('https://cdn.jsdelivr.net/npm/pdfjs-dist')) return { url: stub('stub-pdfjs.mjs'), shortCircuit: true };
  if (specifier.endsWith('/stripe-paywall.js')) return { url: stub('stub-paywall.mjs'), shortCircuit: true };
  if (specifier.endsWith('/config/firebase.js')) return { url: stub('stub-firebase.mjs'), shortCircuit: true };
  return next(specifier, context);
}
