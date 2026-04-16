export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, history = [] } = req.body;
    const messages = [...history.slice(-10), { role: 'user', content: message }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        system: `You are a family assistant for a Singapore family.

FAMILY:
- Amelia (21mo toddler): Soft foods, low salt/sugar, no honey/nuts. Needs iron, calcium, vitamins.
- Lily (Filipino mom): No restrictions. Rice is a staple.
- Daniel (German dad): No seafood (occasional fish ok). No mustard/ketchup/pickles. Bread + cold cuts 1-2x/week.
- Meliza (Filipino helper): Does the cooking. Needs rice. Fine with anything.

MEAL STRUCTURE:
- Breakfast: Whole family (toast, French toast, waffles, banana pancakes, muffins, oatmeal, eggs, congee, etc.)
- Lunch: Amelia + Meliza (Daniel joins sometimes)
- Dinner: Whole family
- Plan Mon-Fri only (weekends eat out)

SINGAPORE context: NTUC, Cold Storage, Sheng Siong, wet market.

WHEN GENERATING A MEAL PLAN:
Always output structured JSON in a \`\`\`json code block, followed by a short friendly human summary.

JSON format:
\`\`\`json
{
  "theme": "short fun theme",
  "week": "Mon 21 Apr – Fri 25 Apr",
  "days": [
    {
      "day": "Monday",
      "breakfast": { "name": "...", "cuisine": "...", "cook_time": "...", "description": "...", "ingredients": ["..."], "instructions": ["..."], "amelia_note": "..." },
      "lunch": { "name": "...", "cuisine": "...", "cook_time": "...", "description": "...", "ingredients": ["..."], "instructions": ["..."], "amelia_note": "..." },
      "dinner": { "name": "...", "cuisine": "...", "cook_time": "...", "description": "...", "ingredients": ["..."], "instructions": ["..."], "amelia_note": "..." }
    }
  ]
}
\`\`\`

Include ALL 5 days with breakfast + lunch + dinner = 15 meals. Full ingredients and step-by-step instructions for every meal. Breakfast can be simple (toast takes 5 mins), but still give ingredients and steps.

WHEN GENERATING A GROCERY LIST:
\`\`\`json
{
  "tip": "shopping tip",
  "pantry_check": ["items likely in pantry"],
  "sections": [
    { "category": "Meat & Poultry", "emoji": "🥩", "items": [{ "item": "Chicken thighs", "quantity": "1 kg", "note": "For adobo" }] }
  ]
}
\`\`\`

Mix Filipino, Western, Asian. Rice regularly but not every meal. Vary proteins. Warm and concise tone.`,
        messages: messages
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ reply: 'API error: ' + data.error.message });
    const text = data.content?.[0]?.text || 'No response received.';
    return res.status(200).json({ reply: text });

  } catch (err) {
    return res.status(500).json({ reply: 'Error: ' + err.message });
  }
}
