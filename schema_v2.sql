-- 1. 원가 분석 엔진 모델별 단가표 테이블 생성
CREATE TABLE IF NOT EXISTS public.model_base_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR NOT NULL UNIQUE,
    prompt_cost_per_1k NUMERIC(10, 6) DEFAULT 0,
    completion_cost_per_1k NUMERIC(10, 6) DEFAULT 0,
    reasoning_cost_per_1k NUMERIC(10, 6) DEFAULT 0,
    cache_creation_cost_per_1k NUMERIC(10, 6) DEFAULT 0,
    cache_read_cost_per_1k NUMERIC(10, 6) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 주요 AI 모델 단가표 데이터 삽입 (1K 토큰 당 USD 비용 기준)
INSERT INTO public.model_base_costs (model_name, prompt_cost_per_1k, completion_cost_per_1k) VALUES
('gpt-4o-mini', 0.000150, 0.000600),
('gpt-4o', 0.002500, 0.010000),
('claude-3-5-sonnet', 0.003000, 0.015000),
('gemini-2.5-flash', 0.000075, 0.000300),
('gemini-1.5-pro', 0.001250, 0.005000)
ON CONFLICT (model_name) DO UPDATE SET 
    prompt_cost_per_1k = EXCLUDED.prompt_cost_per_1k,
    completion_cost_per_1k = EXCLUDED.completion_cost_per_1k;

-- 2. api_keys 테이블 확장 (예산 및 회로 차단 기능 추가)
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(15, 4) DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS current_spend NUMERIC(15, 4) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS alert_threshold NUMERIC(4, 2) DEFAULT 0.80,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- 3. usage_logs 테이블 확장 (순수 원가 영수증 기록)
ALTER TABLE public.usage_logs
ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12, 6) DEFAULT 0;

-- 4. [중요] validate_api_key 함수 업그레이드 (예산 및 차단 정보 함께 반환)
CREATE OR REPLACE FUNCTION validate_api_key(p_key VARCHAR)
RETURNS TABLE (api_key_id UUID, customer_name VARCHAR, current_spend NUMERIC, monthly_budget NUMERIC, is_blocked BOOLEAN) AS $$
BEGIN
  RETURN QUERY 
  SELECT a.api_key_id, a.customer_name, a.current_spend, a.monthly_budget, a.is_blocked
  FROM api_keys a
  WHERE a.api_key = p_key AND a.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;


-- 5. [중요] log_usage 함수 업그레이드 (원가 자동 계산 및 API 키 누적 집계 반영)
CREATE OR REPLACE FUNCTION log_usage(
  p_api_key_id UUID,
  p_model VARCHAR,
  p_prompt_tokens INT,
  p_completion_tokens INT
)
RETURNS JSON AS $$
DECLARE
  v_prompt_rate NUMERIC;
  v_completion_rate NUMERIC;
  v_calculated_cost NUMERIC;
  v_current_spend NUMERIC;
BEGIN
  -- 1) 단가표에서 해당 모델의 1K당 원가 가져오기
  SELECT prompt_cost_per_1k, completion_cost_per_1k 
  INTO v_prompt_rate, v_completion_rate
  FROM model_base_costs WHERE model_name = p_model;
  
  -- (만약 단가표에 없는 신규 모델이라면 0원 처리)
  IF NOT FOUND THEN
     v_prompt_rate := 0;
     v_completion_rate := 0;
  END IF;

  -- 2) 영수증 달러($) 환산 수식
  v_calculated_cost := ((p_prompt_tokens::NUMERIC / 1000.0) * v_prompt_rate) + 
                       ((p_completion_tokens::NUMERIC / 1000.0) * v_completion_rate);

  -- 3) 청구 로그 저장
  INSERT INTO usage_logs (api_key_id, model, prompt_tokens, completion_tokens, estimated_cost_usd)
  VALUES (p_api_key_id, p_model, p_prompt_tokens, p_completion_tokens, v_calculated_cost);

  -- 4) 해당 API 키의 누적 사용액(current_spend) 실시간 인상
  UPDATE api_keys 
  SET current_spend = COALESCE(current_spend, 0) + v_calculated_cost
  WHERE api_key_id = p_api_key_id
  RETURNING current_spend INTO v_current_spend;

  -- 성공 메세지와 함께 최신 누적 지출액 반환
  RETURN json_build_object('status', 'success', 'cost_logged', v_calculated_cost, 'total_spend', v_current_spend);
END;
$$ LANGUAGE plpgsql;
