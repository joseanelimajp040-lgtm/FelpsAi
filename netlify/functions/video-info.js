/* ── video-info.js (v3 — ytdl-core para YouTube, oEmbed para o resto) ── */
const ytdl = require('@distube/ytdl-core');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) throw new Error('URL não informada.');

    let title    = 'Vídeo';
    let platform = 'Web';
    let qualities = ['Melhor qualidade', 'Apenas áudio (MP3)'];

    /* ── YouTube: usa ytdl-core para pegar info real ── */
    if (ytdl.validateURL(url)) {
      platform = 'YouTube';
      const info = await ytdl.getBasicInfo(url);
      title = info.videoDetails.title || 'Vídeo do YouTube';

      // Pega as qualidades disponíveis no vídeo
      const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
      const qs = [...new Set(
        formats
          .map(f => f.qualityLabel)
          .filter(Boolean)
      )].sort((a, b) => parseInt(b) - parseInt(a));

      qualities = qs.length > 0
        ? [...qs, 'Apenas áudio (MP3)']
        : ['720p', '480p', '360p', 'Apenas áudio (MP3)'];

    } else if (/tiktok\.com/.test(url)) {
      platform = 'TikTok';
      title    = 'Vídeo do TikTok';
      qualities = ['Melhor qualidade', 'Apenas áudio (MP3)'];

    } else if (/instagram\.com/.test(url)) {
      platform = 'Instagram';
      title    = 'Vídeo do Instagram';
      qualities = ['Melhor qualidade'];

    } else if (/twitter\.com|x\.com/.test(url)) {
      platform = 'X / Twitter';
      title    = 'Vídeo do X';
      qualities = ['Melhor qualidade'];

    } else if (/facebook\.com|fb\.watch/.test(url)) {
      platform = 'Facebook';
      title    = 'Vídeo do Facebook';
      qualities = ['Melhor qualidade'];
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
