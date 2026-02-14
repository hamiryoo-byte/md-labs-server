// api/precedents.js - ATLAS Pro 판례 검색 API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { keywords, categories, court, fault_min, fault_max, limit = 10 } =
      req.method === 'POST' ? req.body : req.query;

    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kuzcttbpvksftqfvtxme.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

    if (!SUPABASE_KEY) return res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_KEY not configured' });

    // Build query
    let url = `${SUPABASE_URL}/rest/v1/precedents?select=id,case_number,case_name,court,date,fault_ratio,fault_a,fault_b,categories,keywords,summary&fault_ratio=not.is.null&order=relevance_score.desc&limit=${Math.min(parseInt(limit) || 10, 50)}`;

    if (keywords) {
      const words = keywords.split(/[\s,]+/).filter(w => w.length > 1);
      if (words.length > 0) {
        url += `&or=(${words.map(w => `keywords.ilike.%${w}%`).join(',')})`;
      }
    }

    if (categories) {
      url += `&categories=ilike.%${categories}%`;
    }

    if (court) {
      url += `&court=ilike.%${court}%`;
    }

    if (fault_min) url += `&fault_a=gte.${parseInt(fault_min)}`;
    if (fault_max) url += `&fault_a=lte.${parseInt(fault_max)}`;

    const r = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });

    if (!r.ok) {
      const err = await r.text();
      throw new Error(err);
    }

    const data = await r.json();

    res.status(200).json({
      success: true,
      count: data.length,
      results: data
    });

  } catch (err) {
    console.error('Precedent search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
