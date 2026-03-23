exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const TTS_KEY = process.env.GCP_TTS_KEY;
  const URL = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${TTS_KEY}`;

  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: event.body
  });

  const data = await res.json();
  return {
    statusCode: res.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
};