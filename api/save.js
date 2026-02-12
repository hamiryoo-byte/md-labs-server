const { supabase } = require('../lib/supabase');
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = req.body;

    // 필수 필드 검증
    if (!data.diagram_id || data.fault_a === undefined || data.fault_b === undefined) {
      return res.status(400).json({ error: '필수 분석 데이터가 없습니다' });
    }

    // IP 해시 (통계용 — 원본 IP 저장 안함)
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    const ipHash = crypto.createHash('sha256').update(ip + process.env.SALT || 'mdlabs').digest('hex').slice(0, 16);

    const record = {
      input_text:    (data.input_text || '').slice(0, 10000),
      input_type:    data.input_type || 'text',
      has_pdf:       !!data.has_pdf,
      has_image:     !!data.has_image,
      has_video:     !!data.has_video,
      pdf_text:      (data.pdf_text || '').slice(0, 20000),
      ocr_text:      (data.ocr_text || '').slice(0, 5000),
      video_env:     data.video_env || null,
      diagram_id:    data.diagram_id,
      diagram_title: data.diagram_title || '',
      category:      data.category || '',
      subcategory:   data.subcategory || '',
      confidence:    data.confidence || '하',
      match_score:   data.match_score || 0,
      alt_diagrams:  data.alt_diagrams || [],
      fault_a:       data.fault_a,
      fault_b:       data.fault_b,
      label_a:       data.label_a || 'A',
      label_b:       data.label_b || 'B',
      base_fault_a:  data.base_fault_a,
      base_fault_b:  data.base_fault_b,
      detected_mods: data.detected_mods || [],
      applied_mods:  data.applied_mods || [],
      laws:          data.laws || [],
      analysis_text: (data.analysis_text || '').slice(0, 5000),
      llm_used:      !!data.llm_used,
      llm_response:  data.llm_response || null,
      session_id:    data.session_id || null,
      user_agent:    (req.headers['user-agent'] || '').slice(0, 500),
      ip_hash:       ipHash,
    };

    const { data: inserted, error } = await supabase
      .from('analyses')
      .insert(record)
      .select('id, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      id: inserted.id,
      created_at: inserted.created_at,
    });

  } catch (err) {
    console.error('Save API error:', err);
    return res.status(500).json({ error: '저장 중 오류 발생' });
  }
};
