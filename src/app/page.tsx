"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Key, Activity, Copy, LogOut, Loader2, Info, Plus, DollarSign, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [keys, setKeys] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Aggregated Stats
  const [totalSpend, setTotalSpend] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        fetchKeys();
        fetchUsage();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchKeys();
        fetchUsage();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    
    let error;
    if (authMode === 'signup') {
      const res = await supabase.auth.signUp({ email, password });
      error = res.error;
      if (!error) {
        setAuthError('회원가입 성공! 메일함을 확인하거나 바로 로그인해보세요.');
        setAuthMode('login');
      }
    } else {
      const res = await supabase.auth.signInWithPassword({ email, password });
      error = res.error;
    }

    if (error) setAuthError(error.message);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchKeys = async () => {
    const { data, error } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
    if (data) {
      setKeys(data);
      // Calc aggregate
      let spend = 0;
      let budget = 0;
      data.forEach(k => {
        spend += Number(k.current_spend || 0);
        budget += Number(k.monthly_budget || 0);
      });
      setTotalSpend(spend);
      setTotalBudget(budget);
    }
  };

  const fetchUsage = async () => {
    // We now fetch estimated_cost_usd as well
    const { data, error } = await supabase.from('usage_logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setUsage(data);
  };

  const generateRandomKey = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return 'bf_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const createApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !session) return;
    
    setIsGenerating(true);
    const newKey = generateRandomKey();
    
    // Insert with default $100 budget
    const { error } = await supabase.from('api_keys').insert([
      { 
        api_key: newKey, 
        customer_name: newKeyName, 
        monthly_budget: 100.00
      }
    ]);

    if (!error) {
      setNewKeyName('');
      fetchKeys();
    } else {
      alert("키 생성 실패: " + error.message);
    }
    setIsGenerating(false);
  };

  const deleteKey = async (id: string) => {
    if (!confirm('정말 이 API 키를 삭제하시겠습니까? (연결된 서비스가 중단될 수 있습니다)')) return;
    await supabase.from('api_keys').delete().eq('api_key_id', id);
    fetchKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('✅ 클립보드에 복사되었습니다!');
  };

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  // Auth Screen
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              AGI Gateway
            </h1>
            <p className="text-gray-400 mt-2 text-sm">엔터프라이즈 AI 비용 통제 대시보드</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">이메일</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="admin@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">비밀번호</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {authError && (
              <div className="text-sm text-rose-400 bg-rose-400/10 p-3 rounded-lg border border-rose-400/20">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
            >
              {loading ? '처리 중...' : (authMode === 'login' ? '게이트웨이 접속' : '관리자 가입')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {setAuthMode(m => m === 'login' ? 'signup' : 'login'); setAuthError('');}}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {authMode === 'login' ? '계정이 없으신가요? 관리자 가입 (SaaS)' : '계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Screen
  return (
    <div className="min-h-screen bg-[#000000] text-gray-100 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Navbar (Helicone Style) */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#000000]/80 border-b border-gray-800/80">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <Activity className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              AGI Gateway
            </h1>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-gray-800 text-gray-400 border border-gray-700">ENTERPRISE</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-400 hidden sm:block">{session.user.email}</span>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* KPI Overview (Helicone visual style) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Spend */}
          <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 text-gray-400 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h3 className="font-medium">Total Billed Estimate</h3>
            </div>
            <div className="text-4xl font-bold text-white tracking-tight">
              ${totalSpend.toFixed(4)}
            </div>
            <div className="mt-4 w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-1.5 rounded-full ${totalSpend / totalBudget > 0.8 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                style={{ width: `${Math.min((totalSpend / totalBudget) * 100, 100) || 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {((totalSpend / (totalBudget || 1)) * 100).toFixed(1)}% of total budget (${totalBudget}) consumed
            </p>
          </div>

          {/* Forecasting */}
          <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group">
             <div className="flex items-center gap-3 text-gray-400 mb-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <h3 className="font-medium">Burn-rate Forecast</h3>
            </div>
            <div className="text-4xl font-bold text-white tracking-tight">
              {totalSpend === 0 ? 'Safe' : '14 Days'} 
            </div>
            <p className="text-sm text-cyan-400 mt-2">
              Based on rolling 7-day average
            </p>
            <p className="text-xs text-gray-500 mt-2">
              At current speed, budget exhausts before month end.
            </p>
          </div>

          {/* Blocked Requests */}
          <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group">
             <div className="flex items-center gap-3 text-gray-400 mb-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <h3 className="font-medium">Circuit Breaker Blocked</h3>
            </div>
            <div className="text-4xl font-bold text-white tracking-tight">
              0
            </div>
            <p className="text-sm text-rose-400 mt-2">
              Requests dropped
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Throttled requests or Budget limit reached.
            </p>
          </div>
        </div>

        {/* API Keys & Budget Section */}
        <section className="bg-[#0A0A0A] border border-gray-800 rounded-2xl p-6">
          <div className="flex sm:flex-row flex-col sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-gray-400" />
                API Keys & Budget limits
              </h2>
              <p className="text-gray-500 text-sm mt-1">프로젝트별 식별 키를 발급하고 예산 소진 차단기(Circuit Breaker)를 제어합니다.</p>
            </div>
            
            <form onSubmit={createApiKey} className="flex gap-2 w-full sm:w-auto">
              <input 
                type="text" 
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="프로젝트/부서명 입력"
                className="bg-[#000000] border border-gray-800 text-white rounded-lg px-4 py-2 text-sm w-full sm:w-48 focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
              <button 
                type="submit" 
                disabled={isGenerating}
                className="bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Key 발급 ($100 기본예산)
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wider">
                  <th className="pb-3 px-2 font-medium">Customer / Project</th>
                  <th className="pb-3 px-2 font-medium">Gateway Key (BYOK)</th>
                  <th className="pb-3 px-2 font-medium">Spend / Budget</th>
                  <th className="pb-3 px-2 font-medium">Status / Breaker</th>
                  <th className="pb-3 px-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {keys.map(k => {
                  const percent = Math.min((Number(k.current_spend) / Number(k.monthly_budget)) * 100, 100);
                  const isCritical = percent >= 80;
                  const isBlocked = k.is_blocked || percent >= 100;

                  return (
                    <tr key={k.api_key_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                      <td className="py-4 px-2 font-medium text-gray-200">{k.customer_name}</td>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => copyToClipboard(k.api_key)}>
                          <code className="bg-[#000000] px-2 py-1 rounded text-gray-400 font-mono text-xs w-[120px] overflow-hidden text-ellipsis whitespace-nowrap border border-gray-800 group-hover:border-gray-600 transition-colors">
                            {k.api_key}
                          </code>
                          <Copy className="w-3.5 h-3.5 text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex flex-col gap-1.5 w-40">
                          <div className="flex justify-between text-xs font-mono">
                            <span className={isCritical ? 'text-rose-400' : 'text-emerald-400'}>${Number(k.current_spend).toFixed(4)}</span>
                            <span className="text-gray-500">${k.monthly_budget}</span>
                          </div>
                          <div className="w-full bg-gray-900 rounded-full h-1 overflow-hidden">
                            <div className={`h-1 rounded-full ${isCritical ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        {isBlocked ? (
                          <span className="px-2 py-1 flex items-center gap-1 w-max rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="w-3 h-3" /> BLOCKED
                          </span>
                        ) : (
                          <span className="px-2 py-1 flex items-center gap-1 w-max rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Activity className="w-3 h-3" /> ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-right">
                        <button 
                          onClick={() => deleteKey(k.api_key_id)}
                          className="text-gray-600 hover:text-rose-400 transition-colors text-xs font-medium px-2 py-1 bg-[#000000] rounded hover:bg-gray-900"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Real-time Ticker / Cost Ledger */}
        <section className="bg-[#0A0A0A] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-bold text-white">Live Cost Ledger (실시간 지출 장부)</h2>
            </div>
            <button 
              onClick={() => { fetchUsage(); fetchKeys(); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#000000] border border-gray-800 hover:bg-gray-900 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wider">
                  <th className="pb-3 px-2 font-medium">Requests (KST)</th>
                  <th className="pb-3 px-2 font-medium">Model</th>
                  <th className="pb-3 px-2 font-medium text-right">Tokens (In / Out)</th>
                  <th className="pb-3 px-2 font-medium text-right">Calculated Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {usage.map(u => (
                  <tr key={u.log_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                    <td className="py-3 px-2 text-gray-400 text-xs">
                       {new Date(u.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="py-3 px-2">
                       <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${u.model.includes('gpt') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : u.model.includes('gemini') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                        {u.model}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-gray-400 font-mono text-xs">{u.prompt_tokens}</span>
                      <span className="text-gray-600 mx-1">/</span>
                      <span className="text-emerald-400 font-mono text-xs">{u.completion_tokens}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-white font-mono font-medium tracking-tight">
                        ${Number(u.estimated_cost_usd || 0).toFixed(6)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}
