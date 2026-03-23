/* ── video-download.js (v6 — RapidAPI, zero dependências npm) ───────────────
   Recebe { url, quality } → retorna { url } de download direto
   Requer RAPIDAPI_KEY nas env vars do Netlify (gratuito em rapidapi.com)
   ──────────────────────────────────────────────────────────────────────── */

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url, quality } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    const rapidKey = process.env.RAPIDAPI_KEY;
    if (!rapidKey) throw new Error('RAPIDAPI_KEY não configurada nas variáveis de ambiente do Netlify.');

    const isAudio = /mp3|áudio|audio/i.test(quality || '');

    /* ══════════════════════════
       YOUTUBE
       ══════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {
      const videoId = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1];
      if (!videoId) throw new Error('ID do vídeo não encontrado.');

      const res = await fetch(
        `https://yt-api.p.rapidapi.com/dl?id=${videoId}`,
        {
          headers: {
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'yt-api.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(20000),
        }
      );
      const data = await res.json();
      if (!res.ok || data.status === 'FAILED') throw new Error(data.message || 'Erro ao processar vídeo.');

      let chosen;
      if (isAudio) {
        // Pega o melhor formato de áudio
        chosen = (data.formats || [])
          .filter(f => !f.hasVideo && f.hasAudio)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      } else {
        // Tenta casar com a qualidade pedida
        const ql = quality?.replace('p', '') || '720';
        chosen = (data.formats || [])
          .filter(f => f.hasVideo && f.hasAudio && f.qualityLabel?.includes(ql))[0]
          // fallback: qualquer formato com vídeo+áudio
          || (data.formats || []).filter(f => f.hasVideo && f.hasAudio)
            .sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel))[0];
      }

      if (!chosen?.url) throw new Error('Formato não encontrado para esta qualidade.');
      return { statusCode: 200, headers, body: JSON.stringify({ url: chosen.url }) };
    }

    /* ══════════════════════════
       TIKTOK
       ══════════════════════════ */
    if (/tiktok\.com/.test(url)) {
      const res = await fetch(
        `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(url)}&hd=1`,
        {
          headers: {
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(20000),
        }
      );
      const data = await res.json();
      const noWm = /marca|watermark/i.test(quality || '');

      const dlUrl = noWm
        ? (data.data?.play || data.data?.hdplay)
        : (data.data?.wmplay || data.data?.play);

      const audioUrl = data.data?.music;

      if (isAudio && audioUrl) return { statusCode: 200, headers, body: JSON.stringify({ url: audioUrl }) };
      if (!dlUrl) throw new Error('Não foi possível obter o link do TikTok.');
      return { statusCode: 200, headers, body: JSON.stringify({ url: dlUrl }) };
    }

    /* ══════════════════════════
       INSTAGRAM / TWITTER / FACEBOOK
       — usa Social Media Downloader
       ══════════════════════════ */
    const res = await fetch(
      `https://social-media-video-downloader.p.rapidapi.com/smvd/get/all?url=${encodeURIComponent(url)}`,
      {
        headers: {
          'X-RapidAPI-Key':  rapidKey,
          'X-RapidAPI-Host': 'social-media-video-downloader.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(20000),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.links?.length) throw new Error('Não foi possível obter o link para esta plataforma.');

    const links = data.links;
    const chosen = isAudio
      ? links.find(l => /mp3|audio/i.test(l.quality)) || links[0]
      : links.find(l => /mp4|720|1080|best/i.test(l.quality)) || links[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: chosen.link || chosen.url }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
