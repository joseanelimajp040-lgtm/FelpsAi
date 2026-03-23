/* ── video-download.js (DEBUG — mostra resposta completa da API) ─────────── */

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
    if (!rapidKey) throw new Error('RAPIDAPI_KEY não configurada.');

    if (/youtube\.com|youtu\.be/.test(url)) {
      const videoId = url.match(/(?:v=|youtu\.be\/)([^&?/\s]+)/)?.[1];
      if (!videoId) throw new Error('ID não encontrado.');

      const res = await fetch(
        `https://youtube-video-and-shorts-downloader.p.rapidapi.com/download.php?id=${videoId}`,
        {
          headers: {
            'Content-Type':    'application/json',
            'X-RapidAPI-Key':  rapidKey,
            'X-RapidAPI-Host': 'youtube-video-and-shorts-downloader.p.rapidapi.com',
          },
          signal: AbortSignal.timeout(25000),
        }
      );

      const data = await res.json();

      /* ── Retorna o JSON COMPLETO da API como erro legível ── */
      /* Assim você vê exatamente quais campos existem        */
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: '⬡ DEBUG — estrutura completa da API:',
          apiResponse: data
        }),
      };
    }

    throw new Error('Só YouTube no modo debug.');

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
