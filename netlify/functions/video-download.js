/* ── video-download.js (v11 — endpoint correto: /video/download/streams) ────
   API: YouTube Video and Shorts Downloader (Farhan Ali)
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
    if (!rapidKey) throw new Error('RAPIDAPI_KEY não configurada no Netlify.');

    const isAudio = /mp3|áudio|audio/i.test(quality || '');

    /* ══════════════════════════════════
       YOUTUBE
       ══════════════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {

      const res = await fetch(
        `https://youtube-video-and-shorts-downloader.p.rapidapi.com/video/download/streams?url=${encodeURIComponent(url)}`,
        {
          headers: {
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'youtube-video-and-shorts-downloader.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(25000),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Erro ${res.status}`);

      /* Junta todos os formatos disponíveis */
      const all = [
        ...(data.formats          || []),
        ...(data.videoFormats     || []),
        ...(data.adaptiveFormats  || []),
        ...(data.streams          || []),
      ];

      console.log('[yt-dl] total formatos:', all.length);
      console.log('[yt-dl] exemplo formato:', JSON.stringify(all[0] || {}));

      /* ── ÁUDIO ── */
      if (isAudio) {
        const audio = all
          .filter(f => f.url && (!f.hasVideo || f.hasVideo === false) && f.hasAudio !== false)
          .sort((a, b) => (b.bitrate || b.audioBitrate || 0) - (a.bitrate || a.audioBitrate || 0))[0]
          // fallback: qualquer formato de áudio
          || all.find(f => f.url && /mp3|audio/i.test(f.mimeType || f.ext || f.type || ''));

        if (audio?.url) return { statusCode: 200, headers, body: JSON.stringify({ url: audio.url }) };
        throw new Error('Formato de áudio não encontrado.');
      }

      /* ── VÍDEO ── */
      const qlNum = (quality || '720p').replace(/[^0-9]/g, '') || '720';

      const withUrl = all.filter(f => f.url);

      // Preferência: formatos que têm vídeo+áudio (muxed)
      const muxed = withUrl.filter(f => f.hasVideo !== false && f.hasAudio !== false);
      // Fallback: qualquer formato com vídeo
      const anyVideo = withUrl.filter(f => f.hasVideo !== false);

      const pool = muxed.length > 0 ? muxed : anyVideo;

      const sorted = pool.sort((a, b) => {
        const qa = parseInt(String(a.qualityLabel || a.quality || a.resolution || 0));
        const qb = parseInt(String(b.qualityLabel || b.quality || b.resolution || 0));
        return qb - qa;
      });

      const exact   = sorted.find(f => String(f.qualityLabel || f.quality || f.resolution || '').includes(qlNum));
      const closest = sorted.find(f => parseInt(String(f.qualityLabel || f.quality || f.resolution || 0)) <= parseInt(qlNum));
      const chosen  = exact || closest || sorted[0];

      if (chosen?.url) return { statusCode: 200, headers, body: JSON.stringify({ url: chosen.url }) };

      throw new Error('Nenhum formato de vídeo encontrado. Resposta: ' + JSON.stringify(data).slice(0, 300));
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
