/* ── video-info.js (v5 — oEmbed + Cobalt Settings) ────────────────────────
   Recebe { url } → retorna { title, platform, qualities }
   Usa oEmbed oficial do YouTube para não sofrer bloqueio de IP.
──────────────────────────────────────────────────────────────────────── */
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    const rapidKey = process.env.RAPIDAPI_KEY;
    let title = 'Vídeo';
    let platform = 'Web';
    let qualities = [];

    /* ── YouTube (Usando API oEmbed oficial para o título) ── */
    if (/youtube\.com|youtu\.be/.test(url)) {
      platform = 'YouTube';
      
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          title = oembedData.title || 'Vídeo do YouTube';
        } else {
          title = 'Vídeo do YouTube';
        }
      } catch (err) {
        title = 'Vídeo do YouTube';
      }
      
      // O Cobalt converte e faz fallback automático, então podemos fixar as resoluções
      qualities = ['1080p', '720p', '480p', '360p', '144p', 'Apenas áudio (MP3)'];

    /* ── TikTok ── */
    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok';
      title = 'Vídeo do TikTok';
      qualities = ['Sem marca d\'água', 'Com marca d\'água', 'Apenas áudio (MP3)'];

    /* ── Instagram ── */
    } else if (/instagram\.com/.test(url)) {
      platform = 'Instagram';
      title = 'Vídeo do Instagram';
      qualities = ['Melhor qualidade'];

    /* ── Twitter/X ── */
    } else if (/twitter\.com|x\.com/.test(url)) {
      platform = 'X / Twitter';
      title = 'Vídeo do X';
      qualities = ['Melhor qualidade'];

    /* ── Facebook ── */
    } else if (/facebook\.com|fb\.watch/.test(url)) {
      platform = 'Facebook';
      title = 'Vídeo do Facebook';
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
