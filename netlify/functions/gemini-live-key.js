// netlify/functions/gemini-live-key.js
exports.handler = async () => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({ key: process.env.GEMINI_API_KEY }),
});
