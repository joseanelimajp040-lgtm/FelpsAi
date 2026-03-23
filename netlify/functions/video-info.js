/* ── video-info.js (v7 — endpoint correto: /video/details) ─────────────────
   API: YouTube Video and Shorts Downloader (Farhan Ali)
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

    if (/youtube\.com|youtu\.be/.test(url)) {
      platform = 'YouTube';
      if (!rapidKey) throw new Error('RAPIDAPI_KEY não configurada no Netlify.');

      /* ── Pega detalhes do vídeo ── */
      const detailsRes = await fetch(
        `https://youtube-video-and-shorts-downloader.p.rapidapi.com/video/details?url=${encodeURIComponent(url)}`,
        {
          headers: {
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'youtube-video-and-shorts-downloader.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      const details = await detailsRes.json();
      if (!detailsRes.ok) throw new Error(details?.message || `Erro ${detailsRes.status}`);
      title = details.title || details.videoTitle || 'Vídeo do YouTube';

      /* ── Pega os streams disponíveis ── */
      const streamsRes = await fetch(
        `https://youtube-video-and-shorts-downloader.p.rapidapi.com/video/download/streams?url=${encodeURIComponent(url)}`,
        {
          headers: {
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'youtube-video-and-shorts-downloader.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(20000),
        }
      );
      const streamsData = await streamsRes.json();

      /* Extrai qualidades únicas dos formatos retornados */
      const allFormats = [
        ...(streamsData.formats || []),
        ...(streamsData.videoFormats || []),
        ...(streamsData.adaptiveFormats || []),
        ...(streamsData.streams || []),
      ];

      const qs = allFormats
        .filter(f => f.qualityLabel || f.quality || f.resolution)
        .filter(f => f.hasVideo !== false) // inclui todos exceto os marcados sem vídeo
        .map(f => f.qualityLabel || f.quality || f.resolution)
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .sort((a, b) => parseInt(b) - parseInt(a));

      qualities = qs.length > 0
        ? [...qs, 'Apenas áudio (MP3)']
        : ['1080p', '720p', '480p', '360p', 'Apenas áudio (MP3)'];

    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok';
      title    = 'Vídeo do TikTok';
      qualities = ["Sem marca d'água (HD)", 'Apenas áudio (MP3)'];

    } else if (/instagram\.com/.test(url)) {
      platform = 'Instagram';
      title    = 'Vídeo do Instagram';
      qualities = ['Melhor qualidade'];

    } else if (/twitter\.com|x\.com/.test(url)) {
      platform = 'X / Twitter';
      title    = 'Vídeo do X';
      qualities = ['Melhor qualidade'];

    } else if (/facebook\.com|fb\.watch/.test(url)) {
      platform = 'Facebook';
      title    = 'Vídeo do Facebook';
      qualities = ['Melhor qualidade'];

    } else {
      throw new Error('Plataforma não suportada.');
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
