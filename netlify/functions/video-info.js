/* ── video-info.js ──────────────────────────────────────────────────────────
   Recebe { url } e retorna { title, platform, qualities }
   Sem dependências extras — usa fetch nativo do Node 18+
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

    /* ── Detecta plataforma e pega título via oEmbed (sem chave) ── */
    if (/youtube\.com|youtu\.be/.test(url)) {
      platform = 'YouTube';
      try {
        const r = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );
        if (r.ok) ({ title } = await r.json());
      } catch (_) {}

    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok';
      try {
        const r = await fetch(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
        );
        if (r.ok) ({ title } = await r.json());
      } catch (_) {}

    } else if (/instagram\.com/.test(url)) {
      platform = 'Instagram';
      title     = 'Vídeo do Instagram';

    } else if (/twitter\.com|x\.com/.test(url)) {
      platform = 'X / Twitter';
      title     = 'Vídeo do X';

    } else if (/facebook\.com|fb\.watch/.test(url)) {
      platform = 'Facebook';
      title     = 'Vídeo do Facebook';
    }

    /* ── Opções de qualidade por plataforma ── */
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
