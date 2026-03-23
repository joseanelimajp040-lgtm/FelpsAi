/* ── video-download.js (v3 — multi-instância com fallback) ─────────────────
   Tenta cada instância pública do cobalt em sequência até uma funcionar.
   Sem chave de API necessária.
   ──────────────────────────────────────────────────────────────────────── */

const COBALT_INSTANCES = [
  'https://cobalt.tools/',
  'https://co.wuk.sh/',
  'https://cobalt.imput.net/',
  'https://cobalt.api.losttttt.xyz/',
  'https://api.cobalt.tools/',
];

async function tryCobalt(instance, body) {
  const res = await fetch(instance, {
    method: 'POST',
    headers: {
      'Accept':       'application/json',
      'Content-Type': 'application/json',
      'User-Agent':   'Mozilla/5.0 (compatible; GenesisBot/1.0)',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000), // 12s timeout por instância
  });

  const data = await res.json();

  if (data.status === 'error' || data.error) {
    const msg = data?.error?.code || data?.error?.message || JSON.stringify(data.error);
    throw new Error(msg);
  }

  const downloadUrl =
    data.url ||
    (Array.isArray(data.picker) ? data.picker[0]?.url : null);

  if (!downloadUrl) throw new Error('Sem URL na resposta.');

  return downloadUrl;
}

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

    const isAudio = /mp3|áudio|audio/i.test(quality || '');
    const qualityMap = {
      '1080p': '1080', '720p': '720', '480p': '480', '360p': '360',
      'melhor qualidade': 'max',
    };
    const vQuality = qualityMap[(quality || '').toLowerCase()] || '720';

    const cobaltBody = {
      url,
      downloadMode:  isAudio ? 'audio'  : 'auto',
      quality:       isAudio ? undefined : vQuality,
      audioFormat:   isAudio ? 'mp3'    : 'best',
      filenameStyle: 'basic',
    };

    let lastError = 'Todas as instâncias falharam.';

    for (const instance of COBALT_INSTANCES) {
      try {
        console.log(`[cobalt] tentando: ${instance}`);
        const downloadUrl = await tryCobalt(instance, cobaltBody);
        console.log(`[cobalt] sucesso em: ${instance}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ url: downloadUrl }),
        };
      } catch (err) {
        console.warn(`[cobalt] falhou em ${instance}: ${err.message}`);
        lastError = err.message;
      }
    }

    throw new Error(`Nenhuma instância disponível. Último erro: ${lastError}`);

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
