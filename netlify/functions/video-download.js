/* ── video-download.js — aponta para servidor Railway ── */

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url, quality } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    const SERVER = process.env.VIDEO_SERVER_URL;
    if (!SERVER) throw new Error('VIDEO_SERVER_URL não configurada no Netlify.');

    /* Retorna a URL de download direto para o frontend usar */
    const dlUrl = `${SERVER}/download?url=${encodeURIComponent(url)}&quality=${encodeURIComponent(quality || '720p')}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: dlUrl }),
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
