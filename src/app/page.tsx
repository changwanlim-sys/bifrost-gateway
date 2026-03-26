"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Key, Activity, Copy, LogOut, Loader2, Info, Plus } from 'lucide-react';

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
    if (data) setKeys(data);
  };

  const fetchUsage = async () => {
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
    
    const { error } = await supabase.from('api_keys').insert([
      { key: newKey, name: newKeyName, user_id: session.user.id }
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
    await supabase.from('api_keys').delete().eq('id', id);
    fetchKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('복사되었습니다!');
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
              Bifrost Gateway
            </h1>
            <p className="text-gray-400 mt-2 text-sm">통합형 AI 게이트웨이 로그인</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">이메일</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="developer@company.com"
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
              {loading ? '처리 중...' : (authMode === 'login' ? '로그인' : '회원가입')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {setAuthMode(m => m === 'login' ? 'signup' : 'login'); setAuthError('');}}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {authMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Screen
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-10 w-full backdrop-blur-md bg-gray-950/80 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              Bifrost Admin
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{session.user.email}</span>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* API Keys Section */}
        <section className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex sm:flex-row flex-col sm:items-center justify-between gap-4 mb-6 relative z-10">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Key className="w-6 h-6 text-emerald-400" />
                API Keys
              </h2>
              <p className="text-gray-400 text-sm mt-1">게이트웨이에 접근할 수 있는 비밀 키를 관리하세요.</p>
            </div>
            
            <form onSubmit={createApiKey} className="flex gap-2 w-full sm:w-auto">
              <input 
                type="text" 
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="키 이름 (예: 개발용, 배포용)"
                className="bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2 text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
              <button 
                type="submit" 
                disabled={isGenerating}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                키 발급
              </button>
            </form>
          </div>

          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800 text-sm">
                  <th className="pb-3 px-2 font-medium">이름</th>
                  <th className="pb-3 px-2 font-medium">API Key</th>
                  <th className="pb-3 px-2 font-medium">상태</th>
                  <th className="pb-3 px-2 font-medium">생성일</th>
                  <th className="pb-3 px-2 font-medium text-right">관리</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {keys.map(k => (
                  <tr key={k.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-4 px-2 font-medium text-gray-200">{k.name}</td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-2 max-w-[200px] sm:max-w-xs">
                        <code className="bg-gray-950 px-2 py-1 rounded text-emerald-400 font-mono text-xs w-full overflow-hidden text-ellipsis whitespace-nowrap border border-emerald-900/30">
                          {k.key}
                        </code>
                        <button onClick={() => copyToClipboard(k.key)} className="text-gray-500 hover:text-emerald-400 p-1">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {k.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-gray-500">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-2 text-right">
                      <button 
                        onClick={() => deleteKey(k.id)}
                        className="text-gray-500 hover:text-rose-400 transition-colors text-xs font-medium px-3 py-1 bg-gray-950 rounded border border-gray-800 hover:border-rose-900/50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      발급된 API 키가 없습니다. 위 입력창에서 새 키를 발급해보세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Usage Analytics Section */}
        <section className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <Activity className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">최근 사용량 (Usage Logs)</h2>
          </div>

          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800 text-sm">
                  <th className="pb-3 px-2 font-medium">시간</th>
                  <th className="pb-3 px-2 font-medium">모델 (Provider)</th>
                  <th className="pb-3 px-2 font-medium text-right">프롬프트 토큰</th>
                  <th className="pb-3 px-2 font-medium text-right">완성 토큰</th>
                  <th className="pb-3 px-2 font-medium text-right">총합</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {usage.map(u => (
                  <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-2 text-gray-400">
                      {new Date(u.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${u.model.includes('gpt') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : u.model.includes('gemini') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                        {u.model}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-gray-300 font-mono">{u.prompt_tokens.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right text-emerald-400 font-mono">{u.completion_tokens.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right text-cyan-400 font-mono font-bold">{u.total_tokens.toLocaleString()}</td>
                  </tr>
                ))}
                {usage.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500 flex flex-col items-center">
                      <Info className="w-8 h-8 mb-2 opacity-50" />
                      아직 사용 기록이 없습니다.<br/>
                      API 키를 코드에 적용하고 게이트웨이를 호출해 보세요!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}
