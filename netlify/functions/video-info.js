/* ── video-info.js — aponta para servidor Railway ── */

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    const SERVER = process.env.VIDEO_SERVER_URL;
    if (!SERVER) throw new Error('VIDEO_SERVER_URL não configurada no Netlify.');

    const res  = await fetch(`${SERVER}/info?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(35000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) };
  }
};
