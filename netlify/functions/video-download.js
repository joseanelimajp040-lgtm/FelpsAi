/* ── video-download.js ────────────────────────────────────────────────────────
   Recebe { url, quality } → retorna { url } de download direto
   Usa Y2Mate para o YouTube (Garante áudio+vídeo até 1080p).
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
       YOUTUBE (Via Y2Mate)
       ══════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {
      
      // 1. Analisa a URL para pegar os Tokens de Conversão (vid e k)
      const formData = new URLSearchParams();
      formData.append('k_query', url);
      formData.append('k_page', 'home');
      formData.append('hl', 'pt');
      formData.append('q_auto', '1');

      const resInfo = await fetch('https://www.y2mate.com/mates/analyzeV2/ajax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000)
      });
      const dataInfo = await resInfo.json();
      if (dataInfo.status !== 'ok') throw new Error('Erro ao processar vídeo no servidor.');

      const vid = dataInfo.vid;
      let kToken = null;

      // 2. Procura a qualidade solicitada para pegar o token correto
      if (isAudio) {
        const mp3Links = Object.values(dataInfo.links?.mp3 || {});
        if (mp3Links.length > 0) kToken = mp3Links[0].k; // Pega o melhor MP3
      } else {
        const mp4Links = Object.values(dataInfo.links?.mp4 || {});
        // Tenta achar a qualidade exata (ex: "1080p")
        let match = mp4Links.find(f => f.q === quality);
        
        // Fallback: se não achar exato, busca parcial (ex: "1080")
        if (!match) {
          const ql = quality?.replace('p', '') || '720';
          match = mp4Links.find(f => f.q.includes(ql));
        }
        
        // Último Fallback: Pega a melhor qualidade disponível
        if (!match && mp4Links.length > 0) match = mp4Links[0];
        
        if (match) kToken = match.k;
      }

      if (!kToken) throw new Error('Formato ou qualidade selecionada indisponível no momento.');

      // 3. Converte o token no Link Final de Download
      const convertData = new URLSearchParams();
      convertData.append('vid', vid);
      convertData.append('k', kToken);

      const resConvert = await fetch('https://www.y2mate.com/mates/convertV2/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: convertData.toString(),
        signal: AbortSignal.timeout(15000)
      });
      const dataConvert = await resConvert.json();

      if (dataConvert.status !== 'ok' || !dataConvert.dlink) {
        throw new Error('Falha ao gerar o arquivo de download final.');
      }

      return { statusCode: 200, headers, body: JSON.stringify({ url: dataConvert.dlink }) };
    }

    /* ══════════════════════════
       TIKTOK (Mantido Original)
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
       OUTROS (Mantido Original)
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
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
