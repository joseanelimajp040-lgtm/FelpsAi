/* ── video-info.js ────────────────────────────────────────────────────────
   Recebe { url } → retorna { title, platform, qualities }
   Usa Y2Mate para YouTube (gratuito, com áudio embutido até 1080p).
──────────────────────────────────────────────────────────────────────── */
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    const rapidKey = process.env.RAPIDAPI_KEY;
    let title = 'Vídeo';
    let platform = 'Web';
    let qualities = [];

    /* ── YouTube (Via Y2Mate - Gratuito, Sem Cobalt, Áudio e Vídeo Juntos) ── */
    if (/youtube\.com|youtu\.be/.test(url)) {
      platform = 'YouTube';

      const formData = new URLSearchParams();
      formData.append('k_query', url);
      formData.append('k_page', 'home');
      formData.append('hl', 'pt');
      formData.append('q_auto', '1');

      const res = await fetch('https://www.y2mate.com/mates/analyzeV2/ajax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(15000)
      });

      const data = await res.json();
      if (data.status !== 'ok') throw new Error('Erro ao buscar vídeo no servidor.');

      title = data.title || 'Vídeo do YouTube';

      // Extrai as qualidades disponíveis em MP4 (1080p, 720p, etc)
      const mp4Links = data.links?.mp4 || {};
      const qs = Object.values(mp4Links)
        .map(f => f.q)
        .filter(q => q && q !== 'auto')
        .sort((a, b) => parseInt(b) - parseInt(a)); // Ordena da maior para menor

      // Remove qualidades duplicadas
      const uniqueQs = [...new Set(qs)];

      qualities = uniqueQs.length > 0 
        ? [...uniqueQs, 'Apenas áudio (MP3)'] 
        : ['1080p', '720p', '480p', '360p', '144p', 'Apenas áudio (MP3)'];

    /* ── TikTok ── */
    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok';
      title = 'Vídeo do TikTok';
      qualities = ['Sem marca d\'água', 'Com marca d\'água', 'Apenas áudio (MP3)'];

    /* ── Instagram ── */
    } else if (/instagram\.com/.test(url)) {
      platform = 'Instagram';
      title = 'Vídeo do Instagram';
      qualities = ['Melhor qualidade'];

    /* ── Twitter/X ── */
    } else if (/twitter\.com|x\.com/.test(url)) {
      platform = 'X / Twitter';
      title = 'Vídeo do X';
      qualities = ['Melhor qualidade'];

    /* ── Facebook ── */
    } else if (/facebook\.com|fb\.watch/.test(url)) {
      platform = 'Facebook';
      title = 'Vídeo do Facebook';
      qualities = ['Melhor qualidade'];

    } else {
      throw new Error('Plataforma não suportada. Use YouTube, TikTok, Instagram, Twitter ou Facebook.');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ title, platform, qualities }),
    };

  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
