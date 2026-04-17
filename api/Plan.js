export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Get current week's Monday
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const weekOf = monday.toISOString().split('T')[0];
    
    // Query Notion for this week's meals
    const response = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        filter: {
          property: 'Week Of',
          date: { equals: weekOf }
        },
        page_size: 50
      })
    });
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      // Try fetching most recent meals if nothing for this week
      const recent = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID}/query`, {
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
      const recentData = await recent.json();
      data.results = recentData.results || [];
    }
    
    // Group by day
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const daysMap = {};
    let theme = '';
    let weekRange = '';
    
    for (const page of data.results) {
      const props = page.properties;
      const dayName = props['Day']?.select?.name;
      const mealType = props['Meal Type']?.select?.name?.toLowerCase();
      if (!dayName || !mealType) continue;
      
      if (!theme) theme = props['Theme']?.rich_text?.[0]?.plain_text || '';
      if (!weekRange) weekRange = props['Week Range']?.rich_text?.[0]?.plain_text || '';
      
      if (!daysMap[dayName]) daysMap[dayName] = { day: dayName };
      
      const ingredients = props['Ingredients']?.rich_text?.[0]?.plain_text || '';
      const instructions = props['Instructions']?.rich_text?.[0]?.plain_text || '';
      
      daysMap[dayName][mealType] = {
        name: props['Meal Name']?.title?.[0]?.plain_text || '',
        cuisine: props['Cuisine']?.select?.name || '',
        cook_time: props['Cook Time']?.rich_text?.[0]?.plain_text || '',
        description: props['Description']?.rich_text?.[0]?.plain_text || '',
        ingredients: ingredients ? ingredients.split('\n').filter(Boolean) : [],
        instructions: instructions ? instructions.split('\n').map(s => s.replace(/^\d+\.\s*/, '')).filter(Boolean) : [],
        amelia_note: props['Amelia Note']?.rich_text?.[0]?.plain_text || ''
      };
    }
    
    const days = dayOrder.filter(d => daysMap[d]).map(d => daysMap[d]);
    
    return res.status(200).json({
      theme,
      week: weekRange,
      days
    });
    
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
