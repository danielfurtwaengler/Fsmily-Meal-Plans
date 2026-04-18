async function saveToNotion(plan) {
  const weekOf = plan.weekOfDate || new Date().toISOString().split('T')[0];
  const promises = [];
  
  for (const day of plan.days || []) {
    for (const type of ['breakfast', 'lunch', 'dinner']) {
      const meal = day[type];
      if (!meal) continue;
      
      promises.push(fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent: { database_id: process.env.NOTION_DB_ID },
          properties: {
            'Meal Name': { title: [{ text: { content: meal.name || '' } }] },
            'Week Of': { date: { start: weekOf } },
            'Week Range': { rich_text: [{ text: { content: plan.week || '' } }] },
            'Day': { select: { name: day.day } },
            'Meal Type': { select: { name: type.charAt(0).toUpperCase() + type.slice(1) } },
            'Cuisine': { select: { name: meal.cuisine || 'Other' } },
            'Cook Time': { rich_text: [{ text: { content: meal.cook_time || '' } }] },
            'Description': { rich_text: [{ text: { content: meal.description || '' } }] },
            'Ingredients': { rich_text: [{ text: { content: (meal.ingredients || []).join('\n') } }] },
            'Instructions': { rich_text: [{ text: { content: (meal.instructions || []).map((s, i) => `${i+1}. ${s}`).join('\n') } }] },
            'Amelia Note': { rich_text: [{ text: { content: meal.amelia_note || '' } }] },
            'Theme': { rich_text: [{ text: { content: plan.theme || '' } }] }
          }
        })
      }));
    }
  }
  
  const results = await Promise.allSettled(promises);
  const failed = results.filter(r => r.status === 'rejected');
  console.log(`Notion: ${results.length - failed.length}/${results.length} saved`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, history = [] } = req.body;
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);
    
    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const weekRange = `Mon ${fmt(nextMonday)} – Fri ${fmt(nextFriday)}`;
    const weekOfDate = nextMonday.toISOString().split('T')[0];
    
    const dateContext = `Today is ${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Plan for the UPCOMING week: ${weekRange} (weekOfDate: ${weekOfDate}).`;
    
    const messages = [
      ...history.slice(-10),
      { role: 'user', content: dateContext + '\n\n' + message }
    ];

    const systemPrompt = [
      'You are a family assistant for a Singapore family.',
      '',
      'FAMILY:',
      '- Amelia (21mo toddler): Soft foods, low salt/sugar, no honey/nuts.',
      '- Lily (Filipino mom): No restrictions. Loves variety.',
      '- Daniel (German dad): NO seafood (occasional fresh fish ok). NO mustard, NO ketchup, NO pickles. Bread + cold cuts 1-2x/week.',
      '- Meliza (Filipino helper): Does the cooking. Fine with anything.',
      '',
      'MEAL STRUCTURE:',
      '- Breakfast: Whole family',
      '- Lunch: Amelia + Meliza (Daniel sometimes)',
      '- Dinner: Whole family',
      '- Mon-Fri only. ALWAYS plan for the UPCOMING week.',
      '',
      'CARB VARIETY (CRITICAL): Rice only 2-3x per week max. Mix with bread, pasta, noodles (Spätzle, ramen, udon), potatoes, couscous, tortillas. A good week has 4-5 different carb types.',
      '',
      'VARIETY RULES (CRITICAL):',
      '- NEVER same protein twice in one day (no beef lunch + beef dinner)',
      '- Vary proteins: chicken, pork, beef, eggs, tofu, lentils, occasional fish',
      '- Vary cuisines: Filipino, German, Italian, Japanese, Thai, Chinese, Mexican',
      '- Vary cooking methods and breakfast styles (sweet vs savory)',
      '',
      'CRITICAL OUTPUT RULES:',
      '1. For meal plans: Write a brief 2-3 sentence friendly intro, THEN ALWAYS include a ```json code block with complete structured data. The JSON is REQUIRED — the app breaks without it.',
      '2. For grocery lists: Brief intro, THEN ALWAYS include a ```json code block with the grocery data.',
      '3. NEVER skip the JSON. NEVER use markdown tables or bullet lists as a replacement for the JSON. The text response is just a summary — the JSON is the real data.',
      '',
      'MEAL PLAN JSON FORMAT:',
      '```json',
      '{"theme":"...","week":"Mon 20 Apr – Fri 24 Apr","weekOfDate":"2026-04-20","days":[{"day":"Monday","breakfast":{"name":"","cuisine":"","cook_time":"","description":"","ingredients":[],"instructions":[],"amelia_note":""},"lunch":{...},"dinner":{...}},...5 days total]}',
      '```',
      '',
      'GROCERY JSON FORMAT:',
      '```json',
      '{"tip":"...","pantry_check":["..."],"sections":[{"category":"Meat & Poultry","emoji":"🥩","items":[{"item":"...","quantity":"...","note":"..."}]}]}',
      '```',
      '',
      'ALL 5 days, breakfast + lunch + dinner = 15 meals. Full ingredients and step-by-step instructions for every meal.'
    ].join('\n');

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
        system: systemPrompt,
        messages: messages
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ reply: 'API error: ' + data.error.message });
    
    const text = data.content?.[0]?.text || 'No response received.';
    
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.days) {
          try {
            await saveToNotion(parsed);
            console.log('NOTION SUCCESS');
          } catch (e) {
            console.error('NOTION FAILED:', e.message);
          }
        }
      } catch (e) {
        console.error('JSON parse failed:', e.message);
      }
    }
    
    return res.status(200).json({ reply: text });

  } catch (err) {
    return res.status(500).json({ reply: 'Error: ' + err.message });
  }
}
