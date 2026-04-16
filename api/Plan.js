import { storedPlan } from './publish.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!storedPlan) return res.status(200).json(null);
  return res.status(200).json(storedPlan);
}
