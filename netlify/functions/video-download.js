/* ── video-download.js (v8 — loader.to para YouTube, tikwm para TikTok) ──
   loader.to: gratuito, sem chave, faz merge vídeo+áudio no servidor
   IMPORTANTE: adicione ao netlify.toml → [functions] timeout = 26
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
    const isAudio  = /mp3|áudio|audio/i.test(quality || '');

    /* ══════════════════════════════════════════════════════════════
       YOUTUBE — loader.to
       Gratuito, sem chave, merge vídeo+áudio feito pelo servidor deles
       ═══════════════════════════════════════════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {

      // Mapeia "1080p" → "1080", "720p" → "720" etc.
      const qualityNum   = quality?.match(/\d+/)?.[0] || '720';
      const format       = isAudio ? 'mp3' : 'mp4';
      const qualityParam = isAudio ? '128' : qualityNum;

      // ── Passo 1: solicita o processamento ──────────────────────
      const startRes = await fetch(
        `https://loader.to/ajax/download.php` +
        `?format=${format}&quality=${qualityParam}&url=${encodeURIComponent(url)}`,
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!startRes.ok) throw new Error(`loader.to retornou HTTP ${startRes.status}.`);

      const startData = await startRes.json();
      if (!startData.success || !startData.id)
        throw new Error('Não foi possível iniciar o processamento do vídeo.');

      const jobId = startData.id;

      // ── Passo 2: polling até a URL de download ficar pronta ────
      // 9 tentativas × 2 s = 18 s máx (dentro dos 26 s do timeout)
      for (let attempt = 0; attempt < 9; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const progressRes = await fetch(
          `https://loader.to/ajax/progress.php?id=${jobId}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (!progressRes.ok) continue; // ignora falha transitória

        const progressData = await progressRes.json();

        // download_url vem preenchida quando o processamento termina
        if (progressData.download_url && progressData.download_url !== '') {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ url: progressData.download_url }),
          };
        }

        // Se a API reportou falha explícita, para imediatamente
        if (progressData.success === false || progressData.success === 0) {
          throw new Error('loader.to não conseguiu processar este vídeo.');
        }
      }

      // Chegou aqui → timeout do polling
      throw new Error(
        'O servidor demorou demais para processar. ' +
        'Tente uma qualidade menor (ex: 480p ou 360p).'
      );
    }

    /* ══════════════════════════════════════════════════════════════
       TIKTOK — tikwm.com (gratuito, sem chave)
       ═══════════════════════════════════════════════════════════════ */
    if (/tiktok\.com/.test(url)) {
      const res = await fetch('https://www.tikwm.com/api/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `url=${encodeURIComponent(url)}&hd=1`,
        signal:  AbortSignal.timeout(20000),
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
        ? (data.data.wmplay || data.data.play)
        : (data.data.play   || data.data.hdplay);

      if (!dlUrl) throw new Error('Não foi possível obter o link do TikTok.');
      return { statusCode: 200, headers, body: JSON.stringify({ url: dlUrl }) };
    }

    /* ══════════════════════════════════════════════════════════════
       INSTAGRAM / TWITTER / FACEBOOK — Social Media Downloader (RapidAPI)
       ═══════════════════════════════════════════════════════════════ */
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
    if (!res.ok || !data.links?.length)
      throw new Error('Não foi possível obter o link para esta plataforma.');

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
