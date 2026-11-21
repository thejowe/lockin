const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};

export const response = (status, body) => Response.json(body, { status, headers });

export function handleProjectRequest(request, post) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method === 'GET') return response(200, { pong: true });
  if (request.method !== 'POST') return response(405, {});
  return post(request);
}
