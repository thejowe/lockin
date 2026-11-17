const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
/** La foto y el pie en una sola llamada: el resultado juzga los dos juntos. */
export async function moderateBoardImage(bytes: Uint8Array, caption: string) {
  if (!OPENAI_API_KEY) throw new Error('sin OPENAI_API_KEY');

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  const input: unknown[] = [
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${btoa(binary)}` } },
  ];
  if (caption) input.unshift({ type: 'text', text: caption });

  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'omni-moderation-latest', input }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`moderación ${response.status}`);

  const result = (await response.json())?.results?.[0];
  if (typeof result?.flagged !== 'boolean' || typeof result?.category_scores !== 'object') {
    throw new Error('respuesta de moderación inesperada');
  }
  return {
    flagged: result.flagged as boolean,
    scores: result.category_scores as Record<string, number>,
  };
}
