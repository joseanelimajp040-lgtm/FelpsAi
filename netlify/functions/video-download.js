/* ── video-download.js (v8 — Oceansaver / YT1s Backend) ──────────────────
   Recebe { url, quality } → retorna { url } de download direto
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
       YOUTUBE (Via Oceansaver API Pública - Sem Bloqueios)
       ══════════════════════════ */
    if (/youtube\.com|youtu\.be/.test(url)) {
      
      // Define o formato esperado pela API
      let formatCode = '720'; 
      if (isAudio) {
        formatCode = 'mp3';
      } else {
        const match = quality?.match(/\d+/);
        if (match) formatCode = match[0]; // Captura 1080, 720, etc
      }

      const apiKey = 'dfcb6d76f2f6a9894gjkege8a4ab232222'; // Chave pública universal do Oceansaver
      const initUrl = `https://p.oceansaver.in/ajax/download.php?format=${formatCode}&url=${encodeURIComponent(url)}&api=${apiKey}`;
      
      // Passo 1: Solicita o download/conversão
      const initRes = await fetch(initUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(8000)
      });
      const initData = await initRes.json();
      
      if (!initData || !initData.success || !initData.id) {
        throw new Error('Falha ao processar o vídeo no servidor matriz.');
      }

      const jobId = initData.id;
      let downloadUrl = null;
      let attempts = 0;

      // Passo 2: Polling - Aguarda o áudio e o vídeo serem juntados
      // Fazemos no máximo 4 tentativas (~8 segundos) para evitar o erro de Timeout do Netlify
      while (attempts < 4) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;

        const progRes = await fetch(`https://p.oceansaver.in/ajax/progress.php?id=${jobId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const progData = await progRes.json();

        if (progData && progData.success) {
          if (progData.progress === 1000 && progData.download_url) {
            downloadUrl = progData.download_url;
            break; // Vídeo pronto!
          }
        } else {
          throw new Error('Erro na nuvem durante a junção de áudio e vídeo.');
        }
      }

      if (!downloadUrl) {
        // Se demorar mais de 8 segundos, o arquivo ainda está renderizando no fundo.
        throw new Error('O vídeo é pesado e está sendo convertido no fundo. Aguarde 15 segundos e clique na qualidade novamente!');
      }

      return { statusCode: 200, headers, body: JSON.stringify({ url: downloadUrl }) };
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
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
