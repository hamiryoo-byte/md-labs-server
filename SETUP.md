# MD Labs v7.0 서버 연동 가이드

## 전체 구성도

```
┌─────────────────────────────────────────────┐
│  www.md-labs.co.kr                          │
│  (Vercel 호스팅 — v7.0 HTML + API Routes)   │
│                                             │
│  /                 → MD-Labs-v7.0.html      │
│  /api/analyze      → Claude API 프록시      │
│  /api/save         → 분석 이력 저장         │
│  /api/feedback     → 피드백 (학습 루프)     │
│  /api/stats        → 통계 조회              │
│  /api/health       → 서버 상태 확인         │
└────────────────┬────────────────────────────┘
                 │ HTTPS
    ┌────────────┴────────────┐
    │  Supabase (PostgreSQL)  │
    │  analyses 테이블        │
    │  feedback 테이블        │
    │  precedents 테이블      │
    │  diagram_stats 테이블   │
    │  llm_usage 테이블       │
    └────────────┬────────────┘
                 │
    ┌────────────┴────────────┐
    │  Claude API (Anthropic) │
    │  도표 매칭 · 분석 생성  │
    └─────────────────────────┘
```

---

## STEP 1: Supabase 프로젝트 생성 (5분)

### 1-1. 계정 생성
1. https://supabase.com 접속
2. GitHub 계정으로 가입 (무료)
3. "New Project" 클릭

### 1-2. 프로젝트 설정
- **Name:** `md-labs`
- **Database Password:** 강력한 비밀번호 설정 (메모해둘 것!)
- **Region:** `Northeast Asia (Tokyo)` ← 한국에서 가장 빠름
- **Plan:** Free (시작용 충분)

### 1-3. 데이터베이스 테이블 생성
1. 프로젝트 대시보드 → 좌측 "SQL Editor" 클릭
2. "New Query" 클릭
3. `sql/001_schema.sql` 파일 내용 전체 복사/붙여넣기
4. "Run" 클릭
5. 성공 메시지 확인

### 1-4. API 키 복사
1. 프로젝트 대시보드 → 좌측 "Settings" → "API"
2. 아래 2개를 메모:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **service_role (secret):** `eyJhbGci...` ← 절대 외부 노출 금지!

---

## STEP 2: Claude API 키 발급 (3분)

### 2-1. Anthropic Console
1. https://console.anthropic.com 접속
2. 계정 생성/로그인
3. "API Keys" → "Create Key"
4. 키 이름: `md-labs-production`
5. **API Key:** `sk-ant-api03-...` ← 메모

### 2-2. 크레딧 충전
- 무료 크레딧이 있으면 먼저 사용
- 없으면 $5~10 정도 충전 (약 500~1,000회 분석 가능)
- Claude Sonnet 4 기준: 분석 1회 ≈ $0.005~0.015

---

## STEP 3: Vercel 배포 (10분)

### 3-1. 사전 준비
PC에 아래가 설치되어 있어야 합니다:
- **Node.js** (https://nodejs.org → LTS 버전)
- **Git** (https://git-scm.com)

### 3-2. 프로젝트 폴더 구성
다운로드한 `md-labs-server` 폴더 구조:
```
md-labs-server/
├── api/
│   ├── analyze.js      ← Claude API 프록시
│   ├── save.js         ← 분석 이력 저장
│   ├── feedback.js     ← 피드백 저장
│   ├── stats.js        ← 통계 조회
│   └── health.js       ← 서버 상태
├── lib/
│   ├── supabase.js     ← DB 클라이언트
│   └── claude.js       ← Claude API 클라이언트
├── public/
│   └── index.html      ← MD-Labs-v7.0.html (이름 변경)
├── sql/
│   └── 001_schema.sql  ← DB 스키마
├── vercel.json         ← Vercel 설정
├── package.json        ← 의존성
├── .env.example        ← 환경변수 템플릿
└── SETUP.md            ← 이 가이드
```

### 3-3. MD-Labs-v7.0.html 배치
- `MD-Labs-v7.0.html`을 `public/index.html`로 복사

### 3-4. Vercel CLI 설치 + 배포
터미널(명령프롬프트)에서:

```bash
# 1. Vercel CLI 설치
npm install -g vercel

# 2. 프로젝트 폴더로 이동
cd md-labs-server

# 3. 의존성 설치
npm install

# 4. Vercel 로그인
vercel login

# 5. 배포
vercel
```

첫 배포시 질문에 답변:
- Set up and deploy? → **Y**
- Which scope? → 본인 계정 선택
- Link to existing project? → **N**
- What's your project's name? → **md-labs**
- In which directory is your code? → **./** (현재 디렉토리)
- Detected framework: Other → **Enter**

### 3-5. 환경변수 설정
Vercel 대시보드(https://vercel.com) 에서:
1. md-labs 프로젝트 클릭
2. "Settings" → "Environment Variables"
3. 아래 4개 추가:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` |
| `CLAUDE_API_KEY` | `sk-ant-api03-...` |
| `SALT` | 아무 랜덤 문자열 |

4. "Save" 클릭

### 3-6. 프로덕션 배포
```bash
vercel --prod
```

배포 완료 시 URL: `https://md-labs.vercel.app`

---

## STEP 4: 도메인 연결 (5분)

### 4-1. Vercel에 도메인 추가
1. Vercel 대시보드 → md-labs 프로젝트
2. "Settings" → "Domains"
3. `www.md-labs.co.kr` 입력 → "Add"
4. Vercel이 필요한 DNS 레코드를 안내해줌

### 4-2. 도메인 DNS 설정
도메인 구매처(가비아, 후이즈 등) 관리 페이지에서:

**방법 A: CNAME (추천)**
| 타입 | 호스트 | 값 |
|------|--------|-----|
| CNAME | www | cname.vercel-dns.com |
| A | @ | 76.76.21.21 |

**방법 B: A 레코드**
| 타입 | 호스트 | 값 |
|------|--------|-----|
| A | @ | 76.76.21.21 |
| A | www | 76.76.21.21 |

### 4-3. SSL 자동 적용
- Vercel이 자동으로 HTTPS 인증서 발급 (Let's Encrypt)
- 5~30분 후 `https://www.md-labs.co.kr` 접속 가능

---

## STEP 5: 동작 확인

### 5-1. 서버 상태 확인
브라우저에서: `https://www.md-labs.co.kr/api/health`

정상이면:
```json
{
  "status": "healthy",
  "server": true,
  "supabase": true,
  "claude": true
}
```

### 5-2. 앱 접속
`https://www.md-labs.co.kr` → v7.0 과실비율 분석기 화면

### 5-3. 분석 테스트
예시 입력 후 분석 실행 → 결과 확인 → Supabase 대시보드에서 analyses 테이블에 기록 확인

---

## 비용 정리

| 서비스 | 무료 한도 | 초과 시 비용 |
|--------|----------|-------------|
| Supabase | DB 500MB, 월 5만 요청 | $25/월 (Pro) |
| Vercel | 100GB 트래픽, 무제한 배포 | $20/월 (Pro) |
| Claude API | 없음 (크레딧 별도) | ~$0.01/분석 |
| 도메인 | - | 연 ~₩15,000 |

**초기 예상: 월 $0~5** (무료 한도 내에서 운영 가능)

---

## 문제 해결

### "supabase: false" 나올 때
→ SUPABASE_URL, SUPABASE_SERVICE_KEY 환경변수 확인
→ Supabase 대시보드에서 프로젝트가 Paused 상태인지 확인

### "claude: false" 나올 때
→ CLAUDE_API_KEY 환경변수 확인
→ Anthropic Console에서 API 키 활성 상태 확인

### 도메인 접속 안 될 때
→ DNS 변경 후 최대 48시간 소요 (보통 30분~2시간)
→ `nslookup www.md-labs.co.kr`로 DNS 전파 확인

### 분석 저장 안 될 때
→ Supabase SQL Editor에서 테이블 존재 확인
→ RLS 정책 확인 (001_schema.sql 재실행)
