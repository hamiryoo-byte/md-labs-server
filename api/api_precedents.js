// api/precedents.js - ATLAS Pro 판례 검색 API
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { keywords, categories, court, fault_min, fault_max, limit = 10 } = 
      req.method === 'POST' ? req.body : req.query;

    let query = supabase
      .from('precedents')
      .select('id,case_number,case_name,court,date,fault_ratio,fault_a,fault_b,categories,keywords,summary')
      .not('fault_ratio', 'is', null)
      .order('relevance_score', { ascending: false })
      .limit(Math.min(parseInt(limit) || 10, 50));

    // 키워드 검색
    if (keywords) {
      const words = keywords.split(/[\s,]+/).filter(w => w.length > 1);
      if (words.length > 0) {
        query = query.or(words.map(w => `keywords.ilike.%${w}%`).join(','));
      }
    }

    // 카테고리 필터
    if (categories) {
      query = query.ilike('categories', `%${categories}%`);
    }

    // 법원 필터
    if (court) {
      query = query.ilike('court', `%${court}%`);
    }

    // 과실비율 범위
    if (fault_min) query = query.gte('fault_a', parseInt(fault_min));
    if (fault_max) query = query.lte('fault_a', parseInt(fault_max));

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data.length,
      results: data
    });

  } catch (err) {
    console.error('Precedent search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
