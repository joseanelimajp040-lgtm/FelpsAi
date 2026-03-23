/* ── video-info.js (v6 — ytdl-core + labels precisos) ── */
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    let title = 'Vídeo', platform = 'Web', qualities = [];

    /* ── YouTube ── */
    if (/youtube\.com|youtu\.be/.test(url)) {
      platform = 'YouTube';
      try {
        const oembed = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );
        if (oembed.ok) {
          const d = await oembed.json();
          title = d.title || 'Vídeo do YouTube';
        }
      } catch { title = 'Vídeo do YouTube'; }

      // 360p e abaixo = muxed nativo (áudio+vídeo juntos, instantâneo)
      // 480p/720p/1080p = tenta Y2Mate (pré-merge); fallback para 360p se falhar
      qualities = [
        '1080p', '720p', '480p',
        '360p ✓', '240p ✓', '144p ✓',
        'Apenas áudio (MP3)'
      ];

    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok'; title = 'Vídeo do TikTok';
      qualities = ["Sem marca d'água", "Com marca d'água", 'Apenas áudio (MP3)'];

    } else if (/instagram\.com/.test(url)) {
      platform = 'Instagram'; title = 'Vídeo do Instagram';
      qualities = ['Melhor qualidade'];

    } else if (/twitter\.com|x\.com/.test(url)) {
      platform = 'X / Twitter'; title = 'Vídeo do X';
      qualities = ['Melhor qualidade'];

    } else if (/facebook\.com|fb\.watch/.test(url)) {
      platform = 'Facebook'; title = 'Vídeo do Facebook';
      qualities = ['Melhor qualidade'];

    } else {
      throw new Error('Plataforma não suportada.');
    }

    return { statusCode: 200, headers, body: JSON.stringify({ title, platform, qualities }) };

  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: err.message }) };
  }
};
