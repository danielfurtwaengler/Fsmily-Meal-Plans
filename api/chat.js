export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message } = req.body;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
       model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: `You are a family assistant for a Singapore family. Members: Amelia (21mo toddler, soft foods, low salt/sugar, no honey/nuts), Lily (Filipino mom, loves Filipino food, rice staple), Daniel (German dad, no seafood except occasional fish, no mustard/ketchup/pickles, likes bread and cold cuts 1-2x/week), Meliza (Filipino helper who does the cooking, needs rice). Help with meal planning Mon-Fri, grocery lists, and family scheduling. Be warm, concise and practical.`,
        messages: [{ role: 'user', content: message }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(500).json({ reply: 'API error: ' + data.error.message });
    }
    
    const text = data.content?.[0]?.text || 'No response received.';
    return res.status(200).json({ reply: text });
    
  } catch (err) {
    return res.status(500).json({ reply: 'Error: ' + err.message });
  }
}
