/* ── video-download.js (v7 — Instâncias Comunitárias do Cobalt) ─────────
   Recebe { url, quality } → retorna { url } de download direto
   Faz requisição via POST API v10 para servidores com uptime alto.
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
    const isAudio = /mp3|áudio|audio/i.test(quality || '');

    /* ══════════════════════════
       YOUTUBE (Via Cobalt Community API v10)
       ══════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {
      
      // Lista de servidores públicos gratuitos do Cobalt (Sistema de Fallback)
      const cobaltInstances = [
        'https://cobalt.api.timelessnesses.me',
        'https://api.cobalt.my.id',
        'https://co.tskau.team',
        'https://cobalt.synzr.space'
      ];

      const ql = quality ? quality.replace('p', '') : '1080';
      
      const payload = isAudio ? {
        url: url,
        isAudioOnly: true,
        audioFormat: "mp3"
      } : {
        url: url,
        videoQuality: ql
      };

      let dlUrl = null;
      let lastErrorMsg = 'Todos os servidores falharam.';

      // Tenta baixar em cada servidor da lista até um dar certo
      for (const api of cobaltInstances) {
        try {
          const res = await fetch(api, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
          });

          const data = await res.json();

          // A API v10 do Cobalt retorna um desses status quando dá certo
          if (data.status === 'redirect' || data.status === 'stream' || data.status === 'tunnel') {
            dlUrl = data.url;
            break; // Deu certo, encerra o loop de tentativas
          } else if (data.status === 'error') {
             lastErrorMsg = data.text || 'Erro retornado pela API do Cobalt.';
          }
        } catch (err) {
          lastErrorMsg = err.message;
          continue; // Falhou por timeout ou rede, tenta o próximo servidor da array
        }
      }

      if (!dlUrl) {
        throw new Error(`Servidores de vídeo indisponíveis no momento. Detalhe: ${lastErrorMsg}`);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ url: dlUrl }) };
    }

    /* ══════════════════════════
       TIKTOK (Mantido no tikwm.com)
       ══════════════════════════ */
    if (/tiktok\.com/.test(url)) {
      const res = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}&hd=1`,
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();

      if (data.code !== 0 || !data.data) throw new Error(data.msg || 'Erro ao processar vídeo do TikTok.');

      const comWm = /com\s*marca|with.?watermark/i.test(quality || '');

      if (isAudio) {
        if (!data.data.music) throw new Error('Áudio não disponível para este vídeo.');
        return { statusCode: 200, headers, body: JSON.stringify({ url: data.data.music }) };
      }

      const dlUrl = comWm ? (data.data.wmplay || data.data.play) : (data.data.play || data.data.hdplay);
      if (!dlUrl) throw new Error('Não foi possível obter o link do TikTok.');
      return { statusCode: 200, headers, body: JSON.stringify({ url: dlUrl }) };
    }

    /* ══════════════════════════
       OUTROS (Mantido via RapidAPI original)
       ══════════════════════════ */
    if (!rapidKey) throw new Error('RAPIDAPI_KEY não configurada para processar esta rede social.');
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
      statusCode: 400, // <--- Mantém o 400 para o frontend do main.js capturar corretamente
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
