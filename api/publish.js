let storedPlan = null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'POST') {
    try {
      const { plan } = req.body;
      storedPlan = plan;
      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Failed to save' });
    }
  }
  
  return res.status(405).end();
}

export { storedPlan };
