import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { session_id, accident_type, knia_diagram, predicted_fault_a, predicted_fault_b, actual_fault_a, actual_fault_b, user_comment, modifiers_applied } = req.body;

    const is_correct = actual_fault_a !== undefined
      ? Math.abs(predicted_fault_a - actual_fault_a) <= 10
      : null;

    // 피드백 저장
    await sb.from('analysis_feedback').insert({
      session_id, accident_type, knia_diagram,
      predicted_fault_a, predicted_fault_b,
      actual_fault_a, actual_fault_b,
      is_correct, user_comment,
      modifiers_applied: modifiers_applied || []
    });

    // diagram_accuracy 업데이트
    if (knia_diagram && is_correct !== null) {
      const { data: existing } = await sb
        .from('diagram_accuracy')
        .select('*')
        .eq('knia_diagram', knia_diagram)
        .single();

      if (existing) {
        const total = existing.total_count + 1;
        const correct = existing.correct_count + (is_correct ? 1 : 0);
        await sb.from('diagram_accuracy').update({
          total_count: total,
          correct_count: correct,
          accuracy_rate: Math.round((correct / total) * 100 * 100) / 100,
          updated_at: new Date().toISOString()
        }).eq('knia_diagram', knia_diagram);
      } else {
        await sb.from('diagram_accuracy').insert({
          knia_diagram,
          total_count: 1,
          correct_count: is_correct ? 1 : 0,
          accuracy_rate: is_correct ? 100 : 0
        });
      }
    }

    return res.status(200).json({ success: true, is_correct });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
