/* ── video-download.js (v10 — YouTube Video and Shorts Downloader / Farhan Ali)
   Base URL: https://youtube-video-and-shorts-downloader.p.rapidapi.com
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

    /* ══════════════════════════════════════════════════════
       YOUTUBE
       ══════════════════════════════════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {

      const res = await fetch(
        `https://youtube-video-and-shorts-downloader.p.rapidapi.com/video?url=${encodeURIComponent(url)}`,
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

      /* Log para debug — aparece nos logs do Netlify */
      console.log('[yt-dl] resposta keys:', Object.keys(data));

      const formats = data.formats || data.videos || data.downloadLinks || data.links || [];

      /* ── ÁUDIO ── */
      if (isAudio) {
        const audioUrl =
          data.audioUrl || data.audio || data.mp3 ||
          formats.find(f => /mp3|audio/i.test(f.ext || f.type || f.format || ''))?.url;

        if (audioUrl) return { statusCode: 200, headers, body: JSON.stringify({ url: audioUrl }) };
        throw new Error('Formato de áudio não encontrado.');
      }

      /* ── VÍDEO: tenta casar a qualidade ── */
      const qlNum = (quality || '720p').replace(/[^0-9]/g, '') || '720';

      if (formats.length > 0) {
        const sorted = formats
          .filter(f => f.url)
          .sort((a, b) => {
            const qa = parseInt(String(a.quality || a.qualityLabel || a.resolution || 0));
            const qb = parseInt(String(b.quality || b.qualityLabel || b.resolution || 0));
            return qb - qa;
          });

        const exact   = sorted.find(f => String(f.quality || f.qualityLabel || f.resolution || '').includes(qlNum));
        const closest = sorted.find(f => parseInt(String(f.quality || f.qualityLabel || f.resolution || 0)) <= parseInt(qlNum));
        const chosen  = exact || closest || sorted[0];

        if (chosen?.url) return { statusCode: 200, headers, body: JSON.stringify({ url: chosen.url }) };
      }

      /* Fallback: tenta endpoint /video/download direto com qualidade */
      const dlRes = await fetch(
        `https://youtube-video-and-shorts-downloader.p.rapidapi.com/video/download?url=${encodeURIComponent(url)}&quality=${qlNum}p`,
        {
          headers: {
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'youtube-video-and-shorts-downloader.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(25000),
        }
      );
      const dlData = await dlRes.json();
      console.log('[yt-dl] /video/download keys:', Object.keys(dlData));

      const dlUrl =
        dlData.url || dlData.downloadUrl || dlData.download_url ||
        dlData.link || dlData.videoUrl ||
        Object.values(dlData).find(v => typeof v === 'string' && v.startsWith('http'));

      if (dlUrl) return { statusCode: 200, headers, body: JSON.stringify({ url: dlUrl }) };

      throw new Error('Não foi possível obter o link. Resposta: ' + JSON.stringify(dlData).slice(0, 200));
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
