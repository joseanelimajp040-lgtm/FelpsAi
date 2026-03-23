/* ── video-download.js (v9 — ytdl-core + Y2Mate HD fallback) ──────────────
   Recebe { url, quality } → retorna { url } de download direto
────────────────────────────────────────────────────────────────────────── */
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
    const isAudio  = /mp3|áudio|audio/i.test(quality || '');

    /* ══════════════════════════════════════════════════════════════════
       YOUTUBE — @distube/ytdl-core (muxed ≤360p) + Y2Mate (HD fallback)
       ══════════════════════════════════════════════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {
      const ytdl = require('@distube/ytdl-core');

      /* ── Extrai o video ID ── */
      const videoId =
        url.match(/[?&]v=([^&#]+)/)?.[1] ||
        url.match(/youtu\.be\/([^?#]+)/)?.[1];

      /* ── Obtém todos os formatos ── */
      const info = await ytdl.getInfo(url, {
        requestOptions: {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        },
      });

      /* ── ÁUDIO (MP3) ── */
      if (isAudio) {
        const af = ytdl
          .filterFormats(info.formats, 'audioonly')
          .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
        if (!af[0]?.url) throw new Error('Formato de áudio não encontrado.');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ url: af[0].url }),
        };
      }

      const targetH = parseInt(quality) || 360;

      /* ── MUXED (áudio+vídeo juntos) — YouTube oferece até ~360p ── */
      const muxed = ytdl
        .filterFormats(info.formats, 'audioandvideo')
        .sort((a, b) => (b.height || 0) - (a.height || 0));

      // Para qualidades ≤ 360p: retorna URL direta (instantâneo, sem timeout)
      if (targetH <= 360) {
        const f =
          muxed.find((m) => (m.height || 0) <= targetH) ||
          muxed[muxed.length - 1];
        if (f?.url)
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: f.url }),
          };
      }

      /* ── HD (480p / 720p / 1080p) — Y2Mate faz o merge no servidor deles ── */
      if (videoId) {
        try {
          // Passo 1: análise
          const a1Res = await fetch(
            'https://www.y2mate.com/mates/en7/analyzeV2/ajax',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                Origin: 'https://www.y2mate.com',
                Referer: 'https://www.y2mate.com/',
              },
              body: `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`,
              signal: AbortSignal.timeout(9000),
            }
          );
          const d1 = await a1Res.json();
          const mp4Links = d1?.links?.mp4 || {};

          // Escolhe a melhor qualidade disponível no Y2Mate
          const preferred = [`${targetH}p`, '720p', '480p', '360p'];
          let qKey = null;
          for (const q of preferred) {
            if (mp4Links[q]?.k) { qKey = mp4Links[q].k; break; }
          }
          // Fallback: qualquer qualidade disponível
          if (!qKey) qKey = Object.values(mp4Links)[0]?.k;
          if (!qKey) throw new Error('Y2Mate: qualidade não disponível.');

          // Passo 2: conversão
          const a2Res = await fetch(
            'https://www.y2mate.com/mates/en7/convertV2/index',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                Origin: 'https://www.y2mate.com',
                Referer: 'https://www.y2mate.com/',
              },
              body: `vid=${videoId}&k=${qKey}`,
              signal: AbortSignal.timeout(12000),
            }
          );
          const d2 = await a2Res.json();
          if (!d2?.dlink) throw new Error('Y2Mate: link de download não gerado.');

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: d2.dlink }),
          };

        } catch (y2Err) {
          // Fallback silencioso: melhor muxed disponível (com áudio garantido)
          if (muxed[0]?.url) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                url: muxed[0].url,
                note: `HD indisponível agora — retornando ${muxed[0].height}p (áudio incluído)`,
              }),
            };
          }
          throw new Error(
            `HD não processado: ${y2Err.message}. Tente 360p para download garantido.`
          );
        }
      }

      throw new Error('Não foi possível processar este vídeo do YouTube.');
    }

    /* ══════════════════════════════════════════════════════════════════
       TIKTOK — mantido igual (tikwm.com)
       ══════════════════════════════════════════════════════════════════ */
    if (/tiktok\.com/.test(url)) {
      const res = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}&hd=1`,
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (data.code !== 0 || !data.data)
        throw new Error(data.msg || 'Erro ao processar vídeo do TikTok.');

      const comWm = /com\s*marca|with.?watermark/i.test(quality || '');
      if (isAudio) {
        if (!data.data.music) throw new Error('Áudio não disponível para este vídeo.');
        return { statusCode: 200, headers, body: JSON.stringify({ url: data.data.music }) };
      }
      const dlUrl = comWm
        ? data.data.wmplay || data.data.play
        : data.data.play || data.data.hdplay;
      if (!dlUrl) throw new Error('Não foi possível obter o link do TikTok.');
      return { statusCode: 200, headers, body: JSON.stringify({ url: dlUrl }) };
    }

    /* ══════════════════════════════════════════════════════════════════
       OUTROS — mantido igual (RapidAPI)
       ══════════════════════════════════════════════════════════════════ */
    if (!rapidKey)
      throw new Error('RAPIDAPI_KEY não configurada para processar esta rede social.');

    const res = await fetch(
      `https://social-media-video-downloader.p.rapidapi.com/smvd/get/all?url=${encodeURIComponent(url)}`,
      {
        headers: {
          'X-RapidAPI-Key': rapidKey,
          'X-RapidAPI-Host': 'social-media-video-downloader.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(20000),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.links?.length)
      throw new Error('Não foi possível obter o link para esta plataforma.');

    const links = data.links;
    const chosen = isAudio
      ? links.find((l) => /mp3|audio/i.test(l.quality)) || links[0]
      : links.find((l) => /mp4|720|1080|best/i.test(l.quality)) || links[0];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: chosen.link || chosen.url }),
    };

  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
