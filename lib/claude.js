const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

/**
 * Claude API로 사고 텍스트 → 도표 매칭 + 과실비율 분석
 * 현재 클라이언트 패턴매칭과 병행 (Claude 결과를 보조/검증 용도)
 */
async function analyzeAccident(text, diagramList) {
  const systemPrompt = `당신은 한국 교통사고 과실비율 전문 분석가입니다.
손해보험협회 「자동차사고 과실비율 인정기준(2023년 6월)」을 기준으로 분석합니다.

아래 도표 목록에서 가장 적합한 도표를 선택하고, 과실비율을 산정하세요.

## 도표 목록
${diagramList}

## 응답 형식 (반드시 JSON으로만 응답)
{
  "diagram_id": "도표번호",
  "diagram_title": "도표 제목",
  "category": "차대차|차대사람|차대자전거",
  "confidence": "상|중|하",
  "reasoning": "이 도표를 선택한 이유 (2-3문장)",
  "fault_a": 숫자,
  "fault_b": 숫자,
  "label_a": "A측 명칭",
  "label_b": "B측 명칭",
  "detected_modifiers": ["감지된 수정요소들"],
  "modifier_reasoning": "수정요소 적용 근거",
  "legal_basis": ["관련 법규 조문"],
  "analysis": "종합 분석 의견 (3-5문장)"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: `다음 교통사고를 분석해주세요:\n\n${text}` }],
  });

  const content = response.content[0]?.text || '';
  
  // JSON 파싱 (```json 래퍼 제거)
  const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    parsed = { error: 'JSON 파싱 실패', raw: content };
  }

  return {
    result: parsed,
    usage: {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
      model: 'claude-sonnet-4-20250514',
    }
  };
}

/**
 * Claude API로 AI 감정서 분석 텍스트 생성
 */
async function generateReport(analysisData) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `당신은 교통사고 손해사정 전문가입니다. 감정서에 포함될 분석 의견을 작성하세요.
전문적이고 객관적인 어조를 사용하며, 법적 근거를 명시하세요.
한국어로 작성하세요.`,
    messages: [{
      role: 'user',
      content: `다음 분석 결과를 바탕으로 감정서 종합 의견을 작성해주세요:

사고 유형: ${analysisData.category} — ${analysisData.diagram_title}
적용 도표: ${analysisData.diagram_id}
기본 과실비율: ${analysisData.label_a} ${analysisData.base_fault_a}% : ${analysisData.label_b} ${analysisData.base_fault_b}%
수정요소: ${(analysisData.modifiers || []).join(', ') || '없음'}
최종 과실비율: ${analysisData.label_a} ${analysisData.fault_a}% : ${analysisData.label_b} ${analysisData.fault_b}%
사고 상황: ${analysisData.input_text}

아래 항목을 포함하여 작성:
1. 사고 유형 판단 근거
2. 과실비율 산정 논리
3. 수정요소 적용 근거
4. 법적 근거 설명
5. 유의사항`
    }],
  });

  return {
    text: response.content[0]?.text || '',
    usage: {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
      model: 'claude-sonnet-4-20250514',
    }
  };
}

module.exports = { analyzeAccident, generateReport };
