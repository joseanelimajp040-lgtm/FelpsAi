/* ── video-download.js (v10 — Y2Mate primário + Invidious fallback, sem ytdl-core) ──
   Recebe { url, quality } → retorna { url } de download direto
   Nenhuma dependência npm nova necessária — apenas fetch nativo
────────────────────────────────────────────────────────────────────────────────────── */
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

    /* ══════════════════════════════════════════════════════════════════════
       YOUTUBE — Y2Mate (primário, merge servidor deles) + Invidious (fallback)
       Sem ytdl-core, sem npm, sem bot detection.
       ══════════════════════════════════════════════════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {

      /* Extrai o video ID */
      const videoId =
        url.match(/[?&]v=([^&#]+)/)?.[1] ||
        url.match(/youtu\.be\/([^?#]+)/)?.[1];

      if (!videoId) throw new Error('ID do vídeo não encontrado na URL.');

      const targetH = parseInt(quality) || 360;

      /* ── CAMINHO 1: Y2Mate (funciona para todas as qualidades com áudio embutido) ── */
      try {
        /* Passo 1 — Análise: descobre as chaves de cada qualidade */
        const analyzeRes = await fetch(
          'https://www.y2mate.com/mates/en7/analyzeV2/ajax',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Origin:  'https://www.y2mate.com',
              Referer: 'https://www.y2mate.com/',
            },
            body: `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`,
            signal: AbortSignal.timeout(12000),
          }
        );

        if (!analyzeRes.ok) throw new Error(`Y2Mate analyze: HTTP ${analyzeRes.status}`);
        const d1 = await analyzeRes.json();

        let qKey = null;

        if (isAudio) {
          /* Áudio: pega 128kbps ou o primeiro disponível */
          const mp3 = d1?.links?.mp3 || {};
          qKey =
            mp3['mp3128']?.k ||
            mp3['mp3192']?.k ||
            Object.values(mp3).find((v) => v?.k)?.k;
        } else {
          /* Vídeo: tenta qualidade solicitada, depois desce até encontrar uma disponível */
          const mp4 = d1?.links?.mp4 || {};
          const fallbackOrder = [
            `${targetH}p`,
            '1080p', '720p', '480p', '360p', '240p', '144p',
          ];
          for (const q of fallbackOrder) {
            if (mp4[q]?.k) { qKey = mp4[q].k; break; }
          }
          /* Último recurso: qualquer chave disponível */
          if (!qKey) qKey = Object.values(mp4).find((v) => v?.k)?.k;
        }

        if (!qKey) throw new Error('Y2Mate: nenhuma qualidade disponível para este vídeo.');

        /* Passo 2 — Conversão: gera o link final de download */
        const convertRes = await fetch(
          'https://www.y2mate.com/mates/en7/convertV2/index',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Origin:  'https://www.y2mate.com',
              Referer: 'https://www.y2mate.com/',
            },
            body: `vid=${videoId}&k=${qKey}`,
            signal: AbortSignal.timeout(15000),
          }
        );

        if (!convertRes.ok) throw new Error(`Y2Mate convert: HTTP ${convertRes.status}`);
        const d2 = await convertRes.json();

        if (d2?.dlink) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: d2.dlink }),
          };
        }
        throw new Error('Y2Mate: link de download não retornado.');

      } catch (y2Err) {
        /* Y2Mate falhou → tenta Invidious (retorna streams muxed até 720p) */
        console.log('[YouTube] Y2Mate falhou:', y2Err.message, '— tentando Invidious...');
      }

      /* ── CAMINHO 2: Invidious (fallback — muxed até 720p, sem ffmpeg, sem bot detection) ── */
      const INVIDIOUS = [
        'https://invidious.privacyredirect.com',
        'https://invidious.nerdvpn.de',
        'https://inv.nadeko.net',
        'https://yt.cdaut.de',
        'https://invidious.fdn.fr',
      ];

      for (const instance of INVIDIOUS) {
        try {
          const ivRes = await fetch(
            `${instance}/api/v1/videos/${videoId}`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              },
              signal: AbortSignal.timeout(8000),
            }
          );
          if (!ivRes.ok) continue;
          const iv = await ivRes.json();

          if (isAudio) {
            /* Melhor stream de áudio disponível */
            const af = (iv.adaptiveFormats || [])
              .filter((f) => f.type?.startsWith('audio'))
              .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            if (af[0]?.url) {
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ url: af[0].url }),
              };
            }
            continue;
          }

          /* formatStreams = muxed (áudio+vídeo juntos), normalmente até 720p */
          const muxed = (iv.formatStreams || []).sort(
            (a, b) => (b.height || 0) - (a.height || 0)
          );

          /* Tenta encontrar a qualidade solicitada ou inferior */
          const match =
            muxed.find((f) => (f.height || 0) <= targetH) ||
            muxed[muxed.length - 1];

          if (match?.url) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                url: match.url,
                note:
                  (match.height || 0) < targetH
                    ? `${targetH}p indisponível — retornando ${match.height || '?'}p (áudio incluído)`
                    : undefined,
              }),
            };
          }
        } catch {
          /* Instância offline — tenta a próxima */
          continue;
        }
      }

      throw new Error(
        'Não foi possível processar este vídeo agora. Tente novamente em alguns segundos.'
      );
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
