// netlify/functions/transcribe.js
// Usa a API Gemini para transcrever áudio (sem precisar de chave Whisper/OpenAI)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Chave Gemini não configurada' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const { audioBase64, mimeType, fileName } = body;
  if (!audioBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'audioBase64 obrigatório' }) };
  }

  // Gemini aceita estes tipos de áudio via inline_data
  const SUPPORTED = [
    'audio/mp3','audio/mpeg','audio/mp4','audio/wav',
    'audio/ogg','audio/aac','audio/webm','audio/flac'
  ];
  const safeMime = SUPPORTED.includes(mimeType) ? mimeType : 'audio/mp4';

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        {
          inline_data: {
            mime_type: safeMime,
            data: audioBase64
          }
        },
        {
          text: 'Transcreva exatamente o que está sendo dito neste áudio. Retorne apenas o texto transcrito, sem comentários, sem formatação extra, sem explicações. Se houver múltiplos idiomas, transcreva no idioma original.'
        }
      ]
    }],
    generationConfig: { maxOutputTokens: 4096 }
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || `Erro Gemini ${res.status}`;
      return { statusCode: 502, body: JSON.stringify({ error: msg }) };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Transcrição vazia ou inaudível' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
