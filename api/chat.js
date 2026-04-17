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
    
    // Calculate next week's Monday-Friday
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
- Lily (Filipino mom): No restrictions. Loves variety.
- Daniel (German dad): NO seafood at all (occasional fresh fish ok, but never default to it). NO mustard, NO ketchup, NO pickles. Bread + cold cuts 1-2x/week.
- Meliza (Filipino helper): Does the cooking. Fine with anything.

MEAL STRUCTURE:
- Breakfast: Whole family
- Lunch: Amelia + Meliza (Daniel sometimes)
- Dinner: Whole family
- Plan Mon-Fri only (weekends eat out)
- ALWAYS plan for the UPCOMING week (next Monday onwards)

CARBOHYDRATE VARIETY (CRITICAL):
The family eats VARIED carbs across the week — NOT just rice. Mix throughout the week:
- Rice (jasmine, brown, garlic rice) — 2-3x per week max
- Bread (sourdough, baguette, German rye,​​​​​​​​​​​​​​​​


