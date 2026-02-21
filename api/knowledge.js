import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  try {
    const { type, tier, accident_place, accident_type, violation, sensor, keyword } = req.query;
    // 1. AI Hub 분류 코드 조회
    if (type === 'categories') {
      const { data } = await sb.from('aihub_categories').select('*').eq('tier', tier || '1st').order('code');
      return res.status(200).json({ data });
    }
    // 2. 영상 학습 데이터 통계
    if (type === 'stats') {
      const { data } = await sb.from('video_training_data').select('accident_place, accident_type, rate_a, rate_b').not('rate_a', 'is', null);
      const stats = {};
      data.forEach(r => {
        const key = `${r.accident_place}_${r.accident_type}`;
        if (!stats[key]) stats[key] = { count: 0, avg_a: 0, avg_b: 0 };
        stats[key].count++;
        stats[key].avg_a += r.rate_a;
        stats[key].avg_b += r.rate_b;
      });
      Object.values(stats).forEach(s => { s.avg_a = Math.round(s.avg_a / s.count); s.avg_b = Math.round(s.avg_b / s.count); });
      return res.status(200).json({ stats, total: data.length });
    }
    // 3. 도표 정확도 조회
    if (type === 'accuracy') {
      const { data } = await sb.from('diagram_accuracy').select('*').order('accuracy_rate', { ascending: false });
      return res.status(200).json({ data });
    }
    // 4. 유사 사고 사례 검색
    if (type === 'similar') {
      const { data } = await sb.from('video_training_data').select('video_name, accident_place, place_feature, vehicle_a_info, vehicle_b_info, rate_a, rate_b, accident_type').eq('accident_place', accident_place).eq('accident_type', accident_type).not('rate_a', 'is', null).limit(10);
      return res.status(200).json({ data });
    }
    // 5. 교통법규위반 통계 (신규)
    if (type === 'violation') {
      const q = sb.from('traffic_violation_data').select('violation_type, sub_type, weather, day_night, road_type');
      if (violation) q.eq('violation_type', violation);
      const { data } = await q.limit(100);
      const stats = {};
      data.forEach(r => {
        const key = `${r.violation_type}_${r.sub_type}`;
        if (!stats[key]) stats[key] = { violation_type: r.violation_type, sub_type: r.sub_type, count: 0 };
        stats[key].count++;
      });
      return res.status(200).json({ stats: Object.values(stats), total: data.length });
    }
    // 6. 이륜차 위험 시설물 (신규)
    if (type === 'motorcycle') {
      const q = sb.from('motorcycle_hazard_data').select('category, label, weather, road_type, is_defect');
      if (keyword) q.ilike('label', `%${keyword}%`);
      const { data } = await q.limit(50);
      const stats = {};
      data.forEach(r => {
        if (!stats[r.label]) stats[r.label] = { label: r.label, category: r.category, count: 0, defect_count: 0 };
        stats[r.label].count++;
        if (r.is_defect === 'Y') stats[r.label].defect_count++;
      });
      return res.status(200).json({ stats: Object.values(stats) });
    }
    // 7. 자율주행 고장진단 (신규)
    if (type === 'autonomous') {
      const q = sb.from('autonomous_fault_data').select('fault_category, fault_type, sensor_name, vehicle_type');
      if (sensor) q.eq('sensor_name', sensor);
      const { data } = await q.limit(100);
      const stats = {};
      data.forEach(r => {
        const key = `${r.fault_category}_${r.fault_type}`;
        if (!stats[key]) stats[key] = { fault_category: r.fault_category, fault_type: r.fault_type, count: 0 };
        stats[key].count++;
      });
      return res.status(200).json({ stats: Object.values(stats) });
    }
    // 8. 판례 검색 (신규)
    if (type === 'precedent') {
      const q = sb.from('precedent_cases').select('case_number, court, date, accident_type, fault_ratio_a, fault_ratio_b, key_reasoning');
      if (keyword) q.ilike('accident_type', `%${keyword}%`);
      const { data } = await q.order('date', { ascending: false }).limit(10);
      return res.status(200).json({ data });
    }
    return res.status(400).json({ error: 'type 파라미터 필요: categories|stats|accuracy|similar|violation|motorcycle|autonomous|precedent' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
