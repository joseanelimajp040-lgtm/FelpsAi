/* ── video-info.js (v4 — RapidAPI yt-api, sem dependências npm) ─────────────
   Recebe { url } → retorna { title, platform, qualities }
   Usa apenas fetch nativo do Node 18+ (zero dependências)
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

    let title    = 'Vídeo';
    let platform = 'Web';
    let qualities = [];

    /* ── YouTube ── */
    if (/youtube\.com|youtu\.be/.test(url)) {
      platform = 'YouTube';

      if (!rapidKey) throw new Error('RAPIDAPI_KEY não configurada nas variáveis de ambiente do Netlify.');

      const videoId = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1];
      if (!videoId) throw new Error('ID do vídeo não encontrado na URL.');

      const res = await fetch(
        `https://yt-api.p.rapidapi.com/dl?id=${videoId}`,
        {
          headers: {
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'yt-api.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      const data = await res.json();
      if (!res.ok || data.status === 'FAILED') throw new Error(data.message || 'Erro ao buscar vídeo.');

      title = data.title || 'Vídeo do YouTube';

      // Qualidades disponíveis
      const qs = (data.formats || [])
        .filter(f => f.qualityLabel && f.hasVideo && f.hasAudio)
        .map(f => f.qualityLabel)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => parseInt(b) - parseInt(a));

      qualities = qs.length > 0
        ? [...qs, 'Apenas áudio (MP3)']
        : ['1080p', '720p', '480p', '360p', 'Apenas áudio (MP3)'];

    /* ── TikTok ── */
    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok';
      title    = 'Vídeo do TikTok';
      qualities = ['Sem marca d\'água', 'Com marca d\'água', 'Apenas áudio (MP3)'];

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
