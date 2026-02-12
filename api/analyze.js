const { analyzeAccident, generateReport } = require('../lib/claude');
const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, diagramList, mode, analysisData, sessionId } = req.body;

    if (!text || text.length < 5) {
      return res.status(400).json({ error: '텍스트가 너무 짧습니다 (5자 이상)' });
    }
    // 입력 길이 제한
    if (text.length > 10000) {
      return res.status(400).json({ error: '텍스트가 너무 깁니다 (10,000자 이하)' });
    }

    let result, usage;

    if (mode === 'report') {
      // 감정서 분석 텍스트 생성
      const report = await generateReport(analysisData);
      result = { analysis: report.text };
      usage = report.usage;
    } else {
      // 도표 매칭 + 과실비율 분석
      const analysis = await analyzeAccident(text, diagramList || '');
      result = analysis.result;
      usage = analysis.usage;
    }

    // LLM 사용량 기록
    if (usage) {
      await supabase.from('llm_usage').insert({
        model: usage.model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_usd: ((usage.input_tokens * 0.003 + usage.output_tokens * 0.015) / 1000),
        purpose: mode === 'report' ? 'report' : 'match',
        session_id: sessionId || null,
      }).then(() => {}).catch(() => {}); // 실패해도 무시
    }

    return res.status(200).json({
      success: true,
      result,
      tokens: usage ? (usage.input_tokens + usage.output_tokens) : 0,
    });

  } catch (err) {
    console.error('Analyze API error:', err);
    return res.status(500).json({ 
      error: 'AI 분석 중 오류가 발생했습니다',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
