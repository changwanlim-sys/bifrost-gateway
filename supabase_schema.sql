-- 1. Create API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Usage Logs Table
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid default gen_random_uuid() primary key,
  api_key_id uuid references api_keys(id) on delete set null,
  model text not null,
  prompt_tokens int not null,
  completion_tokens int not null,
  total_tokens int not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- 4. User Policies (For Next.js frontend Dashboard)
CREATE POLICY "Users can view their own API keys" ON api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own API keys" ON api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own API keys" ON api_keys FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view usage logs for their keys" ON usage_logs FOR SELECT USING (
  api_key_id IN (SELECT id FROM api_keys WHERE user_id = auth.uid())
);

-- 5. RPC Functions for Go Gateway (Using Anon Key safely)

-- validate_api_key: Return the API Key ID if it is valid and active
CREATE OR REPLACE FUNCTION validate_api_key(p_key text)
RETURNS table(api_key_id uuid) AS $$
BEGIN
    RETURN QUERY 
    SELECT id FROM api_keys WHERE key = p_key AND is_active = true LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- log_usage: Log the token consumption of a request
CREATE OR REPLACE FUNCTION log_usage(p_api_key_id uuid, p_model text, p_prompt_tokens int, p_completion_tokens int)
RETURNS void AS $$
BEGIN
    INSERT INTO usage_logs (api_key_id, model, prompt_tokens, completion_tokens, total_tokens)
    VALUES (p_api_key_id, p_model, p_prompt_tokens, p_completion_tokens, p_prompt_tokens + p_completion_tokens);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
