/* ── video-info.js (v2 — com timeout e fallback de título) ─────────────────
   Recebe { url } → retorna { title, platform, qualities }
   Não depende de chave de API.
   ──────────────────────────────────────────────────────────────────────── */

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    let title    = 'Vídeo';
    let platform = 'Desconhecida';

    /* ── Detecta plataforma ── */
    if (/youtube\.com|youtu\.be/.test(url)) {
      platform = 'YouTube';
      try {
        const r = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (r.ok) {
          const d = await r.json();
          title = d.title || 'Vídeo do YouTube';
        } else {
          title = 'Vídeo do YouTube';
        }
      } catch (_) {
        title = 'Vídeo do YouTube';
      }

    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok';
      try {
        const r = await fetch(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (r.ok) {
          const d = await r.json();
          title = d.title || 'Vídeo do TikTok';
        } else {
          title = 'Vídeo do TikTok';
        }
      } catch (_) {
        title = 'Vídeo do TikTok';
      }

    } else if (/instagram\.com/.test(url)) {
      platform = 'Instagram';
      title     = 'Vídeo do Instagram';

    } else if (/twitter\.com|x\.com/.test(url)) {
      platform = 'X / Twitter';
      title     = 'Vídeo do X';

    } else if (/facebook\.com|fb\.watch/.test(url)) {
      platform = 'Facebook';
      title     = 'Vídeo do Facebook';

    } else {
      platform = 'Web';
      title     = 'Vídeo';
    }

    /* ── Qualidades por plataforma ── */
    const qualities =
      platform === 'YouTube'
        ? ['1080p', '720p', '480p', '360p', 'Apenas áudio (MP3)']
        : ['Melhor qualidade', '720p', '480p', 'Apenas áudio (MP3)'];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ title, platform, qualities }),
    };

  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
