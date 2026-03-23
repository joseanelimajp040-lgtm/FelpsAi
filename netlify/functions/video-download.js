/* ── video-download.js (v9 — YT Video Downloader Fast, muxed v+a) ───────────
   YouTube: usa "YouTube Video Downloader Fast" que entrega MP4 já mesclado
   TikTok / outros: RapidAPI Social Downloader
   Requer RAPIDAPI_KEY nas env vars do Netlify
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

    /* ══════════════════════════════════════════════════════
       YOUTUBE — YouTube Video Downloader Fast
       Retorna MP4 com vídeo+áudio já mesclados (360p/720p/1080p)
       ══════════════════════════════════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {

      const res = await fetch(
        'https://youtube-video-downloader-fast.p.rapidapi.com/download.php',
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/x-www-form-urlencoded',
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'youtube-video-downloader-fast.p.rapidapi.com',
          },
          body: new URLSearchParams({ url }).toString(),
          signal: AbortSignal.timeout(25000),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);

      /* A resposta tem campos tipo: mp4_360p, mp4_720p, mp4_1080p, mp3 */
      if (isAudio) {
        const mp3 = data.mp3 || data.audio || data.mp3_128;
        if (mp3) return { statusCode: 200, headers, body: JSON.stringify({ url: mp3 }) };
        throw new Error('Formato de áudio não encontrado.');
      }

      /* Mapeia qualidade → chave da resposta */
      const qlNum = (quality || '720p').replace(/[^0-9]/g, '') || '720';
      const preferenceOrder = [qlNum, '720', '1080', '480', '360'];

      for (const q of preferenceOrder) {
        const candidate = data[`mp4_${q}p`] || data[`${q}p`] || data[`video_${q}p`];
        if (candidate) return { statusCode: 200, headers, body: JSON.stringify({ url: candidate }) };
      }

      /* Último fallback: qualquer URL que pareça mp4 na resposta */
      const anyMp4 = Object.values(data).find(v => typeof v === 'string' && v.startsWith('http'));
      if (anyMp4) return { statusCode: 200, headers, body: JSON.stringify({ url: anyMp4 }) };

      throw new Error('Nenhum link de download encontrado na resposta. Tente outra qualidade.');
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
      const dlUrl = data.data?.hdplay || data.data?.play;
      if (isAudio && data.data?.music) return { statusCode: 200, headers, body: JSON.stringify({ url: data.data.music }) };
      if (!dlUrl) throw new Error('Não foi possível obter o link do TikTok.');
      return { statusCode: 200, headers, body: JSON.stringify({ url: dlUrl }) };
    }

    /* ══════════════════════════
       INSTAGRAM / TWITTER / FACEBOOK
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

    const links  = data.links;
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
