module.exports = async (req, res) => {
  const checks = {
    server: true,
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
    claude_key: !!process.env.CLAUDE_API_KEY,
    env_keys: Object.keys(process.env).filter(k => k.startsWith('SUPA') || k.startsWith('CLAUDE')),
    timestamp: new Date().toISOString()
  };
  return res.status(200).json(checks);
};
