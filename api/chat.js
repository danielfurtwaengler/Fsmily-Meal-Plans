// ─── Notion save helper ────────────────────────────────────────────
async function saveToNotion(plan) {
  const weekOf = plan.weekOfDate || new Date().toISOString().split('T')[0];
  const promises = [];
  
  for (const day of plan.days || []) {
    for (const type of ['breakfast', 'lunch', 'dinner']) {
      const meal = day[type];
      if (!meal || !meal.name) continue;
      
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
            'Ingredients': { rich_text: [{ text: { content: (meal.ingredients || []).join('\n').slice(0, 2000) } }] },
            'Instructions': { rich_text: [{ text: { content: (meal.instructions || []).map((s, i) => `${i+1}. ${s}`).join('\n').slice(0, 2000) } }] },
            'Amelia Note': { rich_text: [{ text: { content: meal.amelia_note || '' } }] },
            'Theme': { rich_text: [{ text: { content: plan.theme || '' } }] }
          }
        })
      }));
    }
  }
  
  const results = await Promise.allSettled(promises);
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`Notion save: ${results.length - failed}/${results.length} succeeded`);
  return { saved: results.length - failed, total: results.length };
}

// ─── JSON extractor ────────────────────────────────────────────────
function extractJSON(text) {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }
  // Fallback: find outer braces
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

// ─── Family context (shared across prompts) ────────────────────────
const FAMILY_CONTEXT = [
  'Singapore family:',
  '- Amelia (21mo toddler): soft foods, low salt/sugar, no honey/nuts',
  '- Lily (Filipino mom): loves variety',
  '- Daniel (German dad): NO seafood (occasional fish ok), NO mustard/ketchup/pickles, bread + cold cuts 1-2x/week',
  '- Meliza (Filipino helper): cooks everything',
  '',
  'Weekday meals only (Mon-Fri). Weekends eat out.',
  'Breakfast: whole family. Lunch: Amelia + Meliza (Daniel sometimes). Dinner: whole family.',
  '',
  'VARIETY REQUIREMENTS:',
  '- Rice max 2-3x/week. Include bread, pasta, noodles (Spätzle/ramen/udon), potatoes, couscous, tortillas',
  '- NEVER same protein twice in one day',
  '- Rotate cuisines: Filipino, German, Italian, Japanese, Thai, Chinese, Mexican',
  '- Rotate breakfast: sweet (pancakes, French toast) vs savory (eggs, congee, toast)',
  '- Include bread + cold cuts dinner 1-2x per week for Daniel',
  '',
  'Ingredients available in Singapore: NTUC, Cold Storage, Sheng Siong, wet market.'
].join('\n');

// ─── Main handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, history = [], mode } = req.body;
    
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
    
    // ─── MODE 1: Structured meal plan generation ─────────────────
    // Triggered by explicit request, returns structured JSON
    const isMealPlanRequest = mode === 'plan' || 
      /meal plan|weekly plan|plan for (the |this |next )?week/i.test(message);
    
    const isGroceryRequest = mode === 'grocery' || 
      /grocery|shopping list/i.test(message);
    
    let systemPrompt;
    let maxTokens = 4000;
    
    if (isMealPlanRequest) {
      maxTokens = 8000;
      systemPrompt = [
        FAMILY_CONTEXT,
        '',
        `The user wants a meal plan for the UPCOMING week: ${weekRange} (weekOfDate: ${weekOfDate}).`,
        '',
        'CRITICAL: Respond with ONLY a JSON object. No preamble, no explanation, no markdown headers. Just the JSON in a code block.',
        '',
        'Format:',
        '```json',
        '{',
        '  "theme": "short fun weekly theme",',
        `  "week": "${weekRange}",`,
        `  "weekOfDate": "${weekOfDate}",`,
        '  "days": [',
        '    {',
        '      "day": "Monday",',
        '      "breakfast": {"name":"...","cuisine":"...","cook_time":"...","description":"1 sentence","ingredients":["item 1","item 2"],"instructions":["step 1","step 2"],"amelia_note":"toddler adaptation"},',
        '      "lunch": {...same structure...},',
        '      "dinner": {...same structure...}',
        '    }',
        '    ... Tuesday through Friday ...',
        '  ]',
        '}',
        '```',
        '',
        '15 meals total (5 days × 3 meals). Keep descriptions to 1 sentence. Keep ingredients under 10 items. Keep instructions under 6 steps. Be practical.'
      ].join('\n');
    } else if (isGroceryRequest) {
      maxTokens = 3000;
      systemPrompt = [
        FAMILY_CONTEXT,
        '',
        'The user wants a grocery list. Generate it based on the meal plan they have.',
        '',
        'Respond with ONLY JSON in a code block:',
        '```json',
        '{',
        '  "tip": "1-sentence shopping tip",',
        '  "pantry_check": ["item1", "item2"],',
        '  "sections": [',
        '    {"category": "Meat & Poultry", "emoji": "🥩", "items": [{"item": "...", "quantity": "...", "note": "..."}]}',
        '  ]',
        '}',
        '```'
      ].join('\n');
    } else {
      // Regular chat mode
      systemPrompt = [
        FAMILY_CONTEXT,
        '',
        `Today is ${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
        '',
        'You are a warm, concise family assistant. Help with meal suggestions, recipe questions, and family logistics.',
        'Keep responses short and practical. Use bullet points for lists.',
        'If the user asks for a full meal plan, tell them to tap the "🍽️ Full meal plan" button for best results.'
      ].join('\n');
    }
    
    const messages = [
      ...history.slice(-8),
      { role: 'user', content: message }
    ];

    // ─── Call Claude API ─────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ reply: 'API error: ' + data.error.message });
    }
    
    const text = data.content?.[0]?.text || 'No response received.';
    
    // ─── Extract structured data and save to Notion if meal plan ─
    let structuredData = null;
    let notionResult = null;
    
    if (isMealPlanRequest || isGroceryRequest) {
      structuredData = extractJSON(text);
      
      if (structuredData?.days && isMealPlanRequest) {
        try {
          notionResult = await saveToNotion(structuredData);
        } catch (e) {
          console.error('Notion save failed:', e.message);
        }
      }
    }
    
    // ─── Build a friendly reply for the chat ─────────────────────
    let replyText;
    if (isMealPlanRequest && structuredData) {
      replyText = `✨ Your meal plan for **${structuredData.week || weekRange}** is ready!\n\n_"${structuredData.theme || 'A balanced week'}"_\n\nCheck the **📅 Plan** tab to see the calendar and **📖 Recipes** tab for cooking details.${notionResult ? `\n\n_Saved ${notionResult.saved}/${notionResult.total} meals to Notion._` : ''}`;
    } else if (isGroceryRequest && structuredData) {
      const itemCount = (structuredData.sections || []).reduce((sum, s) => sum + (s.items?.length || 0), 0);
      replyText = `🛒 Your grocery list is ready with **${itemCount} items** across **${(structuredData.sections || []).length} categories**.\n\nCheck the **🛒 Grocery** tab — you can also send it to Apple Reminders or share with Meliza on WhatsApp.`;
    } else {
      replyText = text;
    }
    
    return res.status(200).json({ 
      reply: replyText,
      data: structuredData  // frontend uses this to populate tabs
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ reply: 'Error: ' + err.message });
  }
}
