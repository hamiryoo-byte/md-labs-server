-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MD Labs — Supabase Database Schema v1.0                    ║
-- ║  과실비율 분석 이력 · 학습 축적 · 피드백 루프               ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ══════ 1. 분석 이력 테이블 ══════
CREATE TABLE IF NOT EXISTS analyses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  
  -- 입력
  input_text    TEXT NOT NULL,
  input_type    TEXT DEFAULT 'text',          -- text, pdf, ocr, video, mixed
  has_pdf       BOOLEAN DEFAULT false,
  has_image     BOOLEAN DEFAULT false,
  has_video     BOOLEAN DEFAULT false,
  pdf_text      TEXT,
  ocr_text      TEXT,
  video_env     JSONB,                        -- {timeOfDay, avgBr, hasRed, hasGreen, ...}
  
  -- 매칭 결과
  diagram_id    TEXT NOT NULL,                -- 도표 번호 (101, 보4, 거2 등)
  diagram_title TEXT,
  category      TEXT,                         -- 차대차, 차대사람, 차대자전거
  subcategory   TEXT,
  confidence    TEXT,                         -- 상, 중, 하
  match_score   INTEGER,
  alt_diagrams  JSONB,                        -- [{id, t, score}, ...]
  
  -- 과실비율
  fault_a       INTEGER NOT NULL,
  fault_b       INTEGER NOT NULL,
  label_a       TEXT,
  label_b       TEXT,
  base_fault_a  INTEGER,
  base_fault_b  INTEGER,
  
  -- 수정요소·법규
  detected_mods TEXT[],                       -- ['야간', '과속']
  applied_mods  JSONB,                        -- [{n, v, tg, applied}, ...]
  laws          JSONB,                        -- [{a, d}, ...]
  
  -- AI 분석
  analysis_text TEXT,                         -- generateAnalysis() 결과
  llm_used      BOOLEAN DEFAULT false,        -- Claude API 사용 여부
  llm_response  JSONB,                        -- Claude 원본 응답 (디버깅용)
  
  -- 세션 정보 (익명)
  session_id    TEXT,                         -- 브라우저 세션 식별 (UUID)
  user_agent    TEXT,
  ip_hash       TEXT                          -- IP 해시 (통계용, 원본 저장 안함)
);

-- ══════ 2. 피드백 테이블 (학습 루프) ══════
CREATE TABLE IF NOT EXISTS feedback (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id   UUID REFERENCES analyses(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  
  is_correct    BOOLEAN,                      -- 분석 결과가 맞았는지
  correct_diagram TEXT,                       -- 사용자가 제안한 올바른 도표
  correct_fault_a INTEGER,
  correct_fault_b INTEGER,
  comment       TEXT,                         -- 사용자 코멘트
  
  expert_level  TEXT DEFAULT 'user'           -- user, adjuster, lawyer, expert
);

-- ══════ 3. 도표별 정확도 통계 (자동 집계) ══════
CREATE TABLE IF NOT EXISTS diagram_stats (
  diagram_id    TEXT PRIMARY KEY,
  total_matches INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  accuracy_pct  DECIMAL(5,2) DEFAULT 0,
  avg_score     DECIMAL(6,2) DEFAULT 0,
  last_updated  TIMESTAMPTZ DEFAULT now()
);

-- ══════ 4. 판례 DB (학습 축적) ══════
CREATE TABLE IF NOT EXISTS precedents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  
  case_number   TEXT,                         -- 2023가단12345
  court         TEXT,
  decision_date DATE,
  accident_type TEXT,                         -- 차대차, 차대사람, 차대자전거
  fault_a       INTEGER,
  fault_b       INTEGER,
  keywords      TEXT[],
  legal_basis   TEXT[],
  key_facts     TEXT[],
  summary       TEXT,
  raw_text      TEXT,
  confidence    INTEGER DEFAULT 50,
  verified      BOOLEAN DEFAULT false,
  source        TEXT DEFAULT 'user'           -- user, crawl, expert
);

-- ══════ 5. LLM 사용량 추적 ══════
CREATE TABLE IF NOT EXISTS llm_usage (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now(),
  
  model         TEXT,                         -- claude-sonnet-4-20250514 등
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      DECIMAL(8,6),
  purpose       TEXT,                         -- match, analyze, report
  session_id    TEXT
);

-- ══════ INDEXES ══════
CREATE INDEX idx_analyses_created ON analyses(created_at DESC);
CREATE INDEX idx_analyses_diagram ON analyses(diagram_id);
CREATE INDEX idx_analyses_category ON analyses(category);
CREATE INDEX idx_analyses_session ON analyses(session_id);
CREATE INDEX idx_feedback_analysis ON feedback(analysis_id);
CREATE INDEX idx_precedents_type ON precedents(accident_type);
CREATE INDEX idx_precedents_keywords ON precedents USING GIN(keywords);
CREATE INDEX idx_llm_usage_date ON llm_usage(created_at DESC);

-- ══════ RLS (Row Level Security) ══════
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE precedents ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_stats ENABLE ROW LEVEL SECURITY;

-- 익명 사용자도 삽입 가능 (서비스 키로 API 통해서만)
CREATE POLICY "Enable insert for service role" ON analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for service role" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for service role" ON precedents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for service role" ON llm_usage FOR INSERT WITH CHECK (true);

-- 읽기는 서비스 키만
CREATE POLICY "Enable read for service role" ON analyses FOR SELECT USING (true);
CREATE POLICY "Enable read for service role" ON feedback FOR SELECT USING (true);
CREATE POLICY "Enable read for service role" ON precedents FOR SELECT USING (true);
CREATE POLICY "Enable read for service role" ON diagram_stats FOR SELECT USING (true);

-- ══════ FUNCTION: 도표별 정확도 자동 업데이트 ══════
CREATE OR REPLACE FUNCTION update_diagram_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO diagram_stats (diagram_id, total_matches, correct_count, incorrect_count, accuracy_pct, last_updated)
  SELECT 
    a.diagram_id,
    COUNT(*),
    COUNT(*) FILTER (WHERE f.is_correct = true),
    COUNT(*) FILTER (WHERE f.is_correct = false),
    CASE WHEN COUNT(*) > 0 
      THEN ROUND(COUNT(*) FILTER (WHERE f.is_correct = true)::DECIMAL / COUNT(*) * 100, 2)
      ELSE 0 END,
    now()
  FROM feedback f
  JOIN analyses a ON a.id = f.analysis_id
  WHERE a.diagram_id = (SELECT diagram_id FROM analyses WHERE id = NEW.analysis_id)
  GROUP BY a.diagram_id
  ON CONFLICT (diagram_id) DO UPDATE SET
    total_matches = EXCLUDED.total_matches,
    correct_count = EXCLUDED.correct_count,
    incorrect_count = EXCLUDED.incorrect_count,
    accuracy_pct = EXCLUDED.accuracy_pct,
    last_updated = EXCLUDED.last_updated;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stats
  AFTER INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_diagram_stats();
