/* ── video-download.js (v12 — endpoint correto: /download.php?id=) ──────── */

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
    if (!rapidKey) throw new Error('RAPIDAPI_KEY não configurada no Netlify.');

    const isAudio = /mp3|áudio|audio/i.test(quality || '');

    /* ══════════════════════════════════
       YOUTUBE
       ══════════════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {
      const videoId = url.match(/(?:v=|youtu\.be\/)([^&?/\s]+)/)?.[1];
      if (!videoId) throw new Error('ID do vídeo não encontrado na URL.');

      const res = await fetch(
        `https://youtube-video-and-shorts-downloader.p.rapidapi.com/download.php?id=${videoId}`,
        {
          headers: {
            'Content-Type':    'application/json',
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'youtube-video-and-shorts-downloader.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(25000),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Erro ${res.status}`);

      /* Loga a estrutura completa para debug nos logs do Netlify */
      console.log('[yt-dl] keys:', Object.keys(data));
      console.log('[yt-dl] amostra:', JSON.stringify(data).slice(0, 500));

      /* Junta todos os arrays de formatos possíveis */
      const all = [
        ...(data.formats         || []),
        ...(data.videoFormats    || []),
        ...(data.adaptiveFormats || []),
        ...(data.streams         || []),
        ...(data.links           || []),
      ];

      /* ── ÁUDIO ── */
      if (isAudio) {
        const audio =
          all.find(f => f.url && /mp3|audio/i.test(f.mimeType || f.ext || f.type || '')) ||
          all.filter(f => f.url && !f.hasVideo).sort((a,b) => (b.bitrate||0)-(a.bitrate||0))[0] ||
          (data.audio ? { url: data.audio } : null) ||
          (data.mp3   ? { url: data.mp3   } : null);

        if (audio?.url) return { statusCode: 200, headers, body: JSON.stringify({ url: audio.url }) };
        throw new Error('Formato de áudio não encontrado.');
      }

      /* ── VÍDEO ── */
      const qlNum = (quality || '720p').replace(/[^0-9]/g, '') || '720';

      if (all.length > 0) {
        const withUrl = all.filter(f => f.url);
        const sorted  = withUrl.sort((a, b) => {
          const qa = parseInt(String(a.qualityLabel || a.quality || a.resolution || 0));
          const qb = parseInt(String(b.qualityLabel || b.quality || b.resolution || 0));
          return qb - qa;
        });

        const exact   = sorted.find(f => String(f.qualityLabel || f.quality || f.resolution || '').includes(qlNum));
        const closest = sorted.find(f => parseInt(String(f.qualityLabel || f.quality || f.resolution || 0)) <= parseInt(qlNum));
        const chosen  = exact || closest || sorted[0];

        if (chosen?.url) return { statusCode: 200, headers, body: JSON.stringify({ url: chosen.url }) };
      }

      /* Fallback: campos diretos no objeto raiz */
      const direct =
        data[`mp4_${qlNum}p`] || data[`${qlNum}p`] ||
        data.mp4_1080p || data.mp4_720p || data.mp4_480p || data.mp4_360p ||
        data.videoUrl  || data.downloadUrl || data.download_url;

      if (direct) return { statusCode: 200, headers, body: JSON.stringify({ url: direct }) };

      throw new Error('Link não encontrado. Estrutura recebida: ' + JSON.stringify(data).slice(0, 300));
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
