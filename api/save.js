const { supabase } = require('../lib/supabase');
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ═══ PATCH: Claude AI 분석 결과 업데이트 ═══
  if (req.method === 'PATCH') {
    try {
      const { session_id, llm_data } = req.body;
      if (!session_id || !llm_data) {
        return res.status(400).json({ error: 'session_id, llm_data 필수' });
      }

      // 해당 세션의 최신 분석 레코드 찾아서 업데이트
      const { data: latest, error: findErr } = await supabase
        .from('analyses')
        .select('id')
        .eq('session_id', session_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (findErr || !latest) {
        console.error('PATCH: 세션 조회 실패:', findErr?.message, 'session_id:', session_id);
        return res.status(404).json({ error: '해당 세션의 분석 데이터 없음' });
      }

      const updateRecord = {
        llm_used: true,
        llm_response: llm_data.llm_response || null,
      };

      const { error: updateErr } = await supabase
        .from('analyses')
        .update(updateRecord)
        .eq('id', latest.id);

      if (updateErr) {
        console.error('PATCH: analyses 업데이트 실패:', updateErr.message);
        throw updateErr;
      }

      // ═══ llm_analyses 테이블에 별도 저장 (학습 데이터) ═══
      const llmRecord = {
        analysis_id:     latest.id,
        session_id:      session_id,
        llm_diagram_id:  llm_data.llm_diagram_id || null,
        llm_fault_a:     llm_data.llm_fault_a ?? null,
        llm_fault_b:     llm_data.llm_fault_b ?? null,
        llm_confidence:  llm_data.llm_confidence || null,
        llm_reasoning:   (llm_data.llm_reasoning || '').slice(0, 5000),
        llm_analysis:    (llm_data.llm_analysis || '').slice(0, 5000),
        llm_modifiers:   llm_data.llm_modifiers || [],
        llm_tokens:      llm_data.llm_tokens || 0,
        matches_engine:  String(llm_data.llm_diagram_id || '') === String(llm_data.engine_diagram_id || ''),
      };

      // ★ 핵심 수정: 에러 로깅 추가 (기존: .catch(() => {}))
      const { data: llmInserted, error: llmErr } = await supabase
        .from('llm_analyses')
        .insert(llmRecord)
        .select('id')
        .single();

      if (llmErr) {
        console.error('PATCH: llm_analyses INSERT 실패:', llmErr.message, llmErr.details, llmErr.hint);
        console.error('PATCH: llmRecord:', JSON.stringify(llmRecord));
        // 학습 데이터 저장 실패해도 응답은 성공으로 (분석 자체는 저장됨)
      } else {
        console.log('PATCH: llm_analyses 저장 성공, id:', llmInserted?.id, 'matches_engine:', llmRecord.matches_engine);
      }

      return res.status(200).json({
        success: true,
        id: latest.id,
        llm_saved: !llmErr,
        llm_error: llmErr?.message || null,
        message: 'Claude AI 분석 결과 저장 완료'
      });

    } catch (err) {
      console.error('PATCH Save API error:', err);
      return res.status(500).json({ error: 'LLM 결과 저장 오류' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = req.body;

    // 필수 필드 검증
    if (!data.diagram_id || data.fault_a === undefined || data.fault_b === undefined) {
      return res.status(400).json({ error: '필수 분석 데이터가 없습니다' });
    }

    // IP 해시 (통계용 — 원본 IP 저장 안함)
    const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    const ipHash = crypto.createHash('sha256').update(ip + (process.env.SALT || 'mdlabs')).digest('hex').slice(0, 16);

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
