const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { analysis_id, is_correct, correct_diagram, correct_fault_a, correct_fault_b, comment, expert_level } = req.body;

    if (!analysis_id) {
      return res.status(400).json({ error: 'analysis_id 필수' });
    }

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        analysis_id,
        is_correct:      is_correct !== undefined ? !!is_correct : null,
        correct_diagram: correct_diagram || null,
        correct_fault_a: correct_fault_a || null,
        correct_fault_b: correct_fault_b || null,
        comment:         (comment || '').slice(0, 2000),
        expert_level:    expert_level || 'user',
      })
      .select('id')
      .single();

    if (error) throw error;

    // 통계 업데이트는 DB 트리거가 자동 처리

    return res.status(201).json({ success: true, id: data.id });

  } catch (err) {
    console.error('Feedback API error:', err);
    return res.status(500).json({ error: '피드백 저장 실패' });
  }
};
