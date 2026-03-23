/* ── video-info.js (v5 — oEmbed título + qualidades fixas loader.to) ──── */
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    let title    = 'Vídeo';
    let platform = 'Web';
    let qualities = [];

    /* ── YouTube ── */
    if (/youtube\.com|youtu\.be/.test(url)) {
      platform = 'YouTube';

      // oEmbed: gratuito, sem chave, só busca o título
      try {
        const oe = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (oe.ok) {
          const oeData = await oe.json();
          title = oeData.title || 'Vídeo do YouTube';
        } else {
          title = 'Vídeo do YouTube';
        }
      } catch {
        title = 'Vídeo do YouTube';
      }

      // loader.to faz o merge de todas essas qualidades no servidor
      qualities = ['144p', '240p', '360p', '480p', '720p', '1080p', 'Apenas áudio (MP3)'];

    /* ── TikTok ── */
    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok';
      title    = 'Vídeo do TikTok';
      qualities = ["Sem marca d'água", "Com marca d'água", 'Apenas áudio (MP3)'];

    /* ── Instagram ── */
    } else if (/instagram\.com/.test(url)) {
      platform = 'Instagram';
      title    = 'Vídeo do Instagram';
      qualities = ['Melhor qualidade'];

    /* ── Twitter/X ── */
    } else if (/twitter\.com|x\.com/.test(url)) {
      platform = 'X / Twitter';
      title    = 'Vídeo do X';
      qualities = ['Melhor qualidade'];

    /* ── Facebook ── */
    } else if (/facebook\.com|fb\.watch/.test(url)) {
      platform = 'Facebook';
      title    = 'Vídeo do Facebook';
      qualities = ['Melhor qualidade'];

    } else {
      throw new Error('Plataforma não suportada. Use YouTube, TikTok, Instagram, Twitter ou Facebook.');
    }

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
