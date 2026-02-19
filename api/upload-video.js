// ══════════════════════════════════════════════
// ATLAS — upload-video.js
// 배포: Vercel Serverless Function (/api/upload-video)
// 기능: 영상 학습 데이터 JSON → Supabase 업로드
// ══════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { records } = req.body;  // 배열로 받음 (일괄 업로드)
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records[] required' });
    }

    // JSON → DB 행 변환
    const rows = records.map(r => {
      const v = r.video || r;  // video 키가 있으면 그 안, 없으면 직접
      return {
        video_name:    v.video_name,
        video_date:    v.video_date || null,
        filming_way:   v.filming_way || null,
        point_of_view: v.video_point_of_view ?? null,
        rate_a:        v.accident_negligence_rateA ?? null,
        rate_b:        v.accident_negligence_rateB ?? null,
        accident_object: v.accident_object ?? null,
        accident_place:  v.accident_place ?? null,
        place_feature:   v.accident_place_feature ?? null,
        vehicle_a_info:  v.vehicle_a_progress_info ?? null,
        vehicle_b_info:  v.vehicle_b_progress_info ?? null,
        accident_type:   v.accident_type ?? v.traffic_accident_type ?? null,
        damage_location: v.damage_location || null,
        related_laws:    v.related_laws || null,
        violation_of_law: v.violation_of_law || null,
        additional_elements: v.additional_elements || null,
        violation_factor: v.violation_factor || null,
        weather:         v.weather || null,
        has_mp4:         v.has_mp4 ?? false,
        raw_json:        r  // 원본 전체 보관
      };
    });

    // Upsert (video_name 기준 중복 방지)
    const { data, error } = await supabase
      .from('video_training_data')
      .upsert(rows, { onConflict: 'video_name' })
      .select('video_name');

    if (error) {
      return res.status(500).json({ error: error.message, detail: error.details });
    }

    return res.status(200).json({
      success: true,
      uploaded: data.length,
      total_sent: records.length,
      names: data.map(d => d.video_name)
    });

  } catch (err) {
    console.error('upload-video error:', err);
    return res.status(500).json({ error: err.message });
  }
}

