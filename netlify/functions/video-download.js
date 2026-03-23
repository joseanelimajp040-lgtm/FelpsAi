/* ── video-download.js (v5 — ytdl-core, sem chave de API) ──────────────────
   YouTube: retorna URL de stream direto via @distube/ytdl-core
   Outros:  retorna URL via RapidAPI Social Downloader (chave gratuita)
            Configure RAPIDAPI_KEY nas env vars do Netlify (opcional,
            só necessário para TikTok/Instagram/Facebook/Twitter)
   ──────────────────────────────────────────────────────────────────────── */
const ytdl = require('@distube/ytdl-core');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url, quality } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    const isAudio = /mp3|áudio|audio/i.test(quality || '');

    /* ══════════════════════════════════════
       YOUTUBE — ytdl-core (sem chave)
       ══════════════════════════════════════ */
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getInfo(url);

      let format;
      if (isAudio) {
        format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
      } else {
        const qualityMap = {
          '1080p': '137', '720p': '22', '480p': '135', '360p': '18',
          'melhor qualidade': 'highestvideo',
        };
        const qtKey = (quality || '').toLowerCase();
        const qtValue = qualityMap[qtKey] || '22'; // padrão 720p

        try {
          // Tenta vídeo+áudio na qualidade pedida
          format = ytdl.chooseFormat(info.formats, {
            quality: qtValue,
            filter: 'videoandaudio',
          });
        } catch (_) {
          // Fallback: melhor qualidade disponível com áudio
          format = ytdl.chooseFormat(info.formats, {
            quality: 'highestvideo',
            filter: 'videoandaudio',
          });
        }
      }

      if (!format?.url) throw new Error('Formato não encontrado para esta qualidade.');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ url: format.url }),
      };
    }

    /* ══════════════════════════════════════
       OUTRAS PLATAFORMAS — RapidAPI
       (TikTok, Instagram, Twitter, Facebook)
       ══════════════════════════════════════ */
    const rapidKey = process.env.RAPIDAPI_KEY;
    if (!rapidKey) {
      throw new Error(
        'Para baixar vídeos de TikTok/Instagram/Facebook, adicione RAPIDAPI_KEY ' +
        'nas variáveis de ambiente do Netlify. A chave é gratuita em rapidapi.com ' +
        '(busque por "Social Media Video Downloader").'
      );
    }

    const rapidRes = await fetch(
      `https://social-media-video-downloader.p.rapidapi.com/smvd/get/all?url=${encodeURIComponent(url)}`,
      {
        headers: {
          'X-RapidAPI-Key':  rapidKey,
          'X-RapidAPI-Host': 'social-media-video-downloader.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    const rapidData = await rapidRes.json();
    if (!rapidRes.ok || !rapidData.links?.length) {
      throw new Error('Não foi possível obter o link de download para esta plataforma.');
    }

    // Pega o link de melhor qualidade ou MP3 se pedido
    const links = rapidData.links;
    let chosen = isAudio
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
