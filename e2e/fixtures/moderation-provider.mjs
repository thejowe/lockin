/**
 * Entry point copied ONLY into the disposable local Edge runtime by run.mjs.
 * Auth, moderation verdict, publication, and cleanup run the shipped function.
 * Only the external classifier is replaced. It accepts our solid-color fixture,
 * including Android Gallery's JPEG re-encoding after cropping it.
 */
import jpeg from 'npm:jpeg-js@0.4.4';

const backend = new URL(Deno.env.get('SUPABASE_URL'));
if (backend.protocol !== 'http:' || backend.port !== '8000') {
  throw new Error('The test provider requires a local Supabase gateway');
}

const actualFetch = globalThis.fetch;
globalThis.fetch = async (resource, options) => {
  if (String(resource) !== 'https://api.openai.com/v1/moderations') {
    return actualFetch(resource, options);
  }
  const { input } = JSON.parse(options.body);
  const image = input[0].image_url.url.split(',')[1];
  const bytes = Uint8Array.from(atob(image), (ch) => ch.charCodeAt(0));
  const { data } = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 2 });
  const reference = [64, 128, 192];
  const flagged = !data.every(
    (channel, index) => index % 4 === 3 || Math.abs(channel - reference[index % 4]) <= 4
  );
  return Response.json({
    results: [
      { flagged, category_scores: { sexual: 0, 'sexual/minors': 0, 'violence/graphic': 0 } },
    ],
  });
};

Deno.env.set('OPENAI_API_KEY', 'local-e2e-provider');
await import('./server.ts');
