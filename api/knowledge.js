import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const { type, tier, accident_place, accident_type } = req.query;

    // 1. AI Hub 분류 코드 조회
    if (type === 'categories') {
      const { data } = await sb.from('aihub_categories')
        .select('*')
        .eq('tier', tier || '1st')
        .order('code');
      return res.status(200).json({ data });
    }

    // 2. 영상 학습 데이터 통계
    if (type === 'stats') {
      const { data } = await sb.from('video_training_data')
        .select('accident_place, accident_type, rate_a, rate_b')
        .not('rate_a', 'is', null);
      
      const stats = {};
      data.forEach(r => {
        const key = ${r.accident_place}_;
        if (!stats[key]) stats[key] = { count: 0, avg_a: 0, avg_b: 0 };
        stats[key].count++;
        stats[key].avg_a += r.rate_a;
        stats[key].avg_b += r.rate_b;
      });
      Object.values(stats).forEach(s => {
        s.avg_a = Math.round(s.avg_a / s.count);
        s.avg_b = Math.round(s.avg_b / s.count);
      });
      return res.status(200).json({ stats, total: data.length });
    }

    // 3. 도표 정확도 조회
    if (type === 'accuracy') {
      const { data } = await sb.from('diagram_accuracy')
        .select('*')
        .order('accuracy_rate', { ascending: false });
      return res.status(200).json({ data });
    }

    // 4. 유사 사고 사례 검색
    if (type === 'similar') {
      const { data } = await sb.from('video_training_data')
        .select('video_name, accident_place, place_feature, vehicle_a_info, vehicle_b_info, rate_a, rate_b, accident_type')
        .eq('accident_place', accident_place)
        .eq('accident_type', accident_type)
        .not('rate_a', 'is', null)
        .limit(10);
      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: 'type 파라미터 필요: categories|stats|accuracy|similar' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
