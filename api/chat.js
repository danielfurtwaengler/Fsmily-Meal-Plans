export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
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
        max_tokens: 4000,
        system: `You are a family assistant for a Singapore family.

FAMILY MEMBERS:
- Amelia (born 29 July 2024, ~21 months old): Toddler — soft foods, low salt, low sugar, no honey, no whole nuts. Needs iron, calcium, vitamins.
- Lily (mom, Filipino): No restrictions. Loves Filipino food, enjoys variety. Rice is a staple.
- Daniel (dad, German): No seafood (fish only occasionally). No mustard, no ketchup, no pickles. Enjoys bread and cold cuts 1–2x per week.
- Meliza (helper, Filipino): Does the cooking. Needs rice. Fine with anything.

MEAL STRUCTURE:
- Weekday LUNCH: Amelia + Meliza only (Daniel joins if working from home)
- Weekday DINNER: Whole family
- Weekends: No plan needed
- Always plan Mon–Fri lunches + dinners only (10 meals total)

LOCATION: Singapore — NTUC, Cold Storage, Sheng Siong, wet market. Filipino staples readily available.

WHEN GENERATING A MEAL PLAN:
Always use this exact format for each day:

## Monday
**🌤 Lunch: [Dish Name]** _(cuisine · cook time)_
Brief description.

*Ingredients:*
- item 1
- item 2

*Instructions:*
1. Step one
2. Step two

> 👶 Amelia: how to adapt for toddler

**🌙 Dinner: [Dish Name]** _(cuisine · cook time)_
(same format as lunch)

---

Always include full ingredients and step-by-step instructions for every meal — Meliza will use these to cook. Keep instructions clear and practical.

WHEN GENERATING A GROCERY LIST:
Organize by category (🥩 Meat, 🥦 Vegetables, 🥚 Eggs & Tofu, 🧀 Dairy, 🛒 Pantry, 🌿 Herbs) with quantities.

TONE: Warm, practical, concise. Mix Filipino, Western, and Asian cuisines. Rice regularly but not every meal. Vary proteins.`,
        messages: messages
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
