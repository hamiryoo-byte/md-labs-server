const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const type = req.query.type || 'overview';

    if (type === 'overview') {
      // 전체 통계
      const { count: totalAnalyses } = await supabase
        .from('analyses').select('*', { count: 'exact', head: true });
      
      const { count: totalFeedback } = await supabase
        .from('feedback').select('*', { count: 'exact', head: true });

      const { data: topDiagrams } = await supabase
        .from('analyses')
        .select('diagram_id, category')
        .order('created_at', { ascending: false })
        .limit(100);

      // 도표별 빈도 집계
      const freq = {};
      (topDiagrams || []).forEach(r => {
        freq[r.diagram_id] = (freq[r.diagram_id] || 0) + 1;
      });
      const topUsed = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({ id, count }));

      return res.status(200).json({
        total_analyses: totalAnalyses || 0,
        total_feedback: totalFeedback || 0,
        top_diagrams: topUsed,
      });
    }

    if (type === 'diagram') {
      // 도표별 정확도 통계
      const { data } = await supabase
        .from('diagram_stats')
        .select('*')
        .order('total_matches', { ascending: false })
        .limit(50);

      return res.status(200).json({ diagram_stats: data || [] });
    }

    if (type === 'recent') {
      // 최근 분석 목록
      const { data } = await supabase
        .from('analyses')
        .select('id, created_at, diagram_id, diagram_title, category, fault_a, fault_b, label_a, label_b, confidence, match_score')
        .order('created_at', { ascending: false })
        .limit(20);

      return res.status(200).json({ recent: data || [] });
    }

    return res.status(400).json({ error: 'Unknown type. Use: overview, diagram, recent' });

  } catch (err) {
    console.error('Stats API error:', err);
    return res.status(500).json({ error: '통계 조회 실패' });
  }
};
