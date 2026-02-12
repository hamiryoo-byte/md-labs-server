const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  const checks = { server: true, supabase: false, claude: false, timestamp: new Date().toISOString() };

  // Supabase 연결 확인
  try {
    const { error } = await supabase.from('analyses').select('id').limit(1);
    checks.supabase = !error;
  } catch (e) { checks.supabase = false; }

  // Claude API 키 존재 확인
  checks.claude = !!process.env.CLAUDE_API_KEY;

  const ok = checks.server && checks.supabase && checks.claude;
  return res.status(ok ? 200 : 503).json({
    status: ok ? 'healthy' : 'degraded',
    version: '1.0.0',
    ...checks
  });
};
