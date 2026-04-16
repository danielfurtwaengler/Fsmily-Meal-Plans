export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { message } = req.body;
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: `You are a family assistant for a Singapore family. Members: Amelia (21mo toddler, soft foods, low salt/sugar, no honey/nuts), Lily (Filipino mom, loves Filipino food, rice staple), Daniel (German dad, no seafood except occasional fish, no mustard/ketchup/pickles, likes bread and cold cuts 1-2x/week), Meliza (Filipino helper who does the cooking, needs rice). You help with meal planning Mon-Fri lunches and dinners, grocery lists, and family scheduling. Be warm, concise and practical. Format meal plans clearly.`,
      messages: [{ role: 'user', content: message }]
    })
  });
  
  const data = await response.json();
  const text = data.content?.[0]?.text || 'Sorry, something went wrong.';
  res.status(200).json({ reply: text });
}
