const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: 판례 검색
  if (req.method === 'GET') {
    try {
      const { q, category, diagram_id, limit } = req.query;
      let query = supabase.from('precedents').select('*').order('created_at', { ascending: false });

      if (q) query = query.or(`keywords.cs.{${q}},case_number.ilike.%${q}%,summary.ilike.%${q}%`);
      if (category) query = query.eq('category', category);
      if (diagram_id) query = query.eq('diagram_id', diagram_id);
      query = query.limit(parseInt(limit) || 20);

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({ precedents: data || [], count: (data || []).length });
    } catch (err) {
      console.error('Precedents GET error:', err);
      return res.status(500).json({ error: '판례 검색 실패' });
    }
  }

  // POST: 판례 저장
  if (req.method === 'POST') {
    try {
      const d = req.body;
      if (!d.summary && !d.case_number) {
        return res.status(400).json({ error: '판례 요약 또는 사건번호 필요' });
      }

      const record = {
        case_number:   (d.case_number || '').slice(0, 100),
        court:         (d.court || '').slice(0, 100),
        date:          d.date || null,
        category:      d.category || '차대차',
        subcategory:   d.subcategory || '',
        diagram_id:    d.diagram_id || null,
        fault_a:       d.fault_a ?? null,
        fault_b:       d.fault_b ?? null,
        keywords:      d.keywords || [],
        legal_basis:   d.legal_basis || [],
        key_facts:     d.key_facts || [],
        summary:       (d.summary || '').slice(0, 5000),
        source:        d.source || 'user',
        confidence:    d.confidence || 50,
        verified:      !!d.verified,
      };

      const { data, error } = await supabase
        .from('precedents')
        .insert(record)
        .select('id, created_at')
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, id: data.id, created_at: data.created_at });
    } catch (err) {
      console.error('Precedents POST error:', err);
      return res.status(500).json({ error: '판례 저장 실패' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
