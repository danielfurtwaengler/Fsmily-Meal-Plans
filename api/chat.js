async function saveToNotion(plan) {
  const weekOf = new Date().toISOString().split('T')[0];
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
  
  await Promise.allSettled(promises);
}

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

SINGAPORE: NTUC, Cold Storage, Sheng Siong, wet market.

WHEN GENERATING A MEAL PLAN:
Output structured JSON in a \`\`\`json code block, followed by a brief friendly summary.

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

ALL 5 days with breakfast + lunch + dinner = 15 meals. Full ingredients and step-by-step instructions for every meal. Mix Filipino, Western, Asian. Vary proteins.

WHEN GENERATING A GROCERY LIST:
\`\`\`json
{
  "tip": "shopping tip",
  "pantry_check": ["items likely in pantry"],
  "sections": [
    { "category": "Meat & Poultry", "emoji": "🥩", "items": [{ "item": "Chicken thighs", "quantity": "1 kg", "note": "For adobo" }] }
  ]
}
\`\`\``,
        messages: messages
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ reply: 'API error: ' + data.error.message });
    
    const text = data.content?.[0]?.text || 'No response received.';
    
    // Try to extract a meal plan and save to Notion
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.days) {
          // Don't await — fire and forget so user gets fast response
          saveToNotion(parsed)
 const results = await Promise.allSettled(promises);
const failed = results.filter(r => r.status === 'rejected');
const succeeded = results.filter(r => r.status === 'fulfilled');
console.log(`Notion save: ${succeeded.length} succeeded, ${failed.length} failed`);

// Check actual response from a successful one
if (succeeded.length > 0) {
  const sample = await succeeded[0].value.json();
  console.log('Notion response sample:', JSON.stringify(sample).slice(0, 500));
}
        }
      } catch {}
    }
    
    return res.status(200).json({ reply: text });

  } catch (err) {
    return res.status(500).json({ reply: 'Error: ' + err.message });
  }
}
