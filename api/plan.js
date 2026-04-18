export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_DB_ID) {
      return res.status(500).json({ error: 'Missing Notion env vars' });
    }
    
    // Fetch most recent 15 meals (sorted by Week Of descending)
    const response = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        sorts: [{ property: 'Week Of', direction: 'descending' }],
        page_size: 15
      })
    });
    
    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Notion query failed: ' + err.slice(0, 200) });
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return res.status(200).json({ days: [], theme: '', week: '' });
    }
    
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const daysMap = {};
    let theme = '';
    let weekRange = '';
    
    for (const page of data.results) {
      try {
        const props = page.properties || {};
        const dayName = props['Day']?.select?.name;
        const mealType = props['Meal Type']?.select?.name?.toLowerCase();
        if (!dayName || !mealType) continue;
        
        if (!theme && props['Theme']?.rich_text?.[0]) {
          theme = props['Theme'].rich_text[0].plain_text || '';
        }
        if (!weekRange && props['Week Range']?.rich_text?.[0]) {
          weekRange = props['Week Range'].rich_text[0].plain_text || '';
        }
        
        if (!daysMap[dayName]) daysMap[dayName] = { day: dayName };
        
        const ingredientsText = props['Ingredients']?.rich_text?.[0]?.plain_text || '';
        const instructionsText = props['Instructions']?.rich_text?.[0]?.plain_text || '';
        
        daysMap[dayName][mealType] = {
          name: props['Meal Name']?.title?.[0]?.plain_text || '',
          cuisine: props['Cuisine']?.select?.name || '',
          cook_time: props['Cook Time']?.rich_text?.[0]?.plain_text || '',
          description: props['Description']?.rich_text?.[0]?.plain_text || '',
          ingredients: ingredientsText ? ingredientsText.split('\n').filter(Boolean) : [],
          instructions: instructionsText ? instructionsText.split('\n').map(s => s.replace(/^\d+\.\s*/, '')).filter(Boolean) : [],
          amelia_note: props['Amelia Note']?.rich_text?.[0]?.plain_text || ''
        };
      } catch (e) {
        console.error('Skip page:', e.message);
      }
    }
    
    const days = dayOrder.filter(d => daysMap[d]).map(d => daysMap[d]);
    
    return res.status(200).json({ theme, week: weekRange, days });
    
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
