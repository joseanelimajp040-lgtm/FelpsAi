/* ── video-download.js ──────────────────────────────────────────────────────
   Recebe { url, quality } e retorna a URL de download via cobalt.tools
   Suporta: YouTube, TikTok, Instagram, Twitter/X, Facebook e outros
   Sem dependências extras — usa fetch nativo do Node 18+
   ──────────────────────────────────────────────────────────────────────── */

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const { url, quality } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    const isAudio = /mp3|áudio|audio/i.test(quality);

    /* ── Mapeia qualidade amigável → valor aceito pelo cobalt ── */
    const qualityMap = {
      '1080p': '1080', '720p': '720', '480p': '480', '360p': '360',
      'melhor qualidade': 'max',
    };
    const vQuality = qualityMap[quality?.toLowerCase()] || '720';

    /* ── Chama cobalt.tools (API pública, sem chave) ── */
    const cobaltRes = await fetch('https://cobalt.imput.net/', {
      method: 'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/json',
        'User-Agent':   'Mozilla/5.0 (compatible; GenesisBot/1.0)',
      },
      body: JSON.stringify({
        url,
        downloadMode:  isAudio ? 'audio'   : 'auto',
        quality:       isAudio ? undefined  : vQuality,
        audioFormat:   isAudio ? 'mp3'      : 'best',
        filenameStyle: 'basic',
      }),
    });

    if (!cobaltRes.ok) {
      const errBody = await cobaltRes.text();
      throw new Error(`cobalt retornou ${cobaltRes.status}: ${errBody.slice(0, 120)}`);
    }

    const data = await cobaltRes.json();

    /* cobalt pode retornar: tunnel | redirect | stream | picker | error */
    if (data.status === 'error' || data.error) {
      const msg = data.error?.code || data.error || 'Erro desconhecido do cobalt.';
      throw new Error(msg);
    }

    /* picker = múltiplos arquivos (ex: carrossel do Instagram) — pega o primeiro */
    const downloadUrl =
      data.url ||
      (Array.isArray(data.urls) ? data.urls[0] : null) ||
      (Array.isArray(data.picker) ? data.picker[0]?.url : null);

    if (!downloadUrl) throw new Error('Nenhuma URL de download retornada.');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url:    downloadUrl,
        status: data.status,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
