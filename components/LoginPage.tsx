
import React, { useState, useEffect } from 'react';
import { supabase, getErrorMessage } from '../supabaseClient';
import { Lock, AlertCircle, User as UserIcon, Eye, EyeOff, Calculator } from 'lucide-react';
import Logo from './Logo';

const CACHE_KEY_PREFIX = 'fast_comand_v4_';

const LoginPage: React.FC = () => {
    const [loginInput, setLoginInput] = useState(''); // Can be email or username
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const [pageLoading, setPageLoading] = useState(true);
    const [companyName, setCompanyName] = useState<string>('Fast Comand SM');
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        
        // Try to load cached branding first for immediate display
        try {
            const cachedCompany = localStorage.getItem(CACHE_KEY_PREFIX + 'CompanyInfo');
            if (cachedCompany) {
                const parsed = JSON.parse(cachedCompany);
                if (parsed.data && parsed.data[0]) {
                    if (parsed.data[0].logo) setCompanyLogo(parsed.data[0].logo);
                    if (parsed.data[0].name) setCompanyName(parsed.data[0].name);
                }
            }
        } catch (e) {
            console.error("Failed to load cached branding", e);
        }

        const fetchData = async () => {
            if (!supabase) {
                if (isMounted) setPageLoading(false);
                return;
            }

            try {
                // Fetch public info safely. Ignore errors (404/Missing Table)
                const { data: companyData, error } = await supabase
                    .from('CompanyInfo')
                    .select('name, logo')
                    .limit(1)
                    .maybeSingle();

                if (isMounted && companyData && !error) {
                    if (companyData.name) setCompanyName(companyData.name);
                    if (companyData.logo) setCompanyLogo(companyData.logo);

                    // CRITICAL FIX: Save to cache immediately so App.tsx can read it during transition
                    try {
                        localStorage.setItem(
                            CACHE_KEY_PREFIX + 'CompanyInfo', 
                            JSON.stringify({ timestamp: Date.now(), data: [companyData] })
                        );
                    } catch (cacheError) {
                        console.error("Failed to cache company info", cacheError);
                    }
                }
            } catch (e) {
                // Ignore initial fetch errors
            } finally {
                if (isMounted) setPageLoading(false);
            }
        };
        
        fetchData();

        return () => { isMounted = false; };
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!supabase) {
            setError("CONNECTION_ERROR");
            setLoading(false);
            return;
        }

        let targetEmail = loginInput.trim();
        const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail);

        try {
            // If input is NOT an email, assume it's a username and try to find the email
            if (!isEmailFormat) {
                const { data, error: lookupError } = await supabase
                    .from('Users')
                    .select('email')
                    .ilike('username', targetEmail) // Case-insensitive lookup
                    .limit(1)
                    .maybeSingle();

                if (lookupError) {
                    // If table doesn't exist yet, we can't lookup.
                    if (lookupError.code === '42P01') {
                         setError('قاعدة البيانات غير مهيئة. يرجى الدخول بالبريد الإلكتروني للمدير.');
                         setLoading(false);
                         return;
                    }
                    console.error("Username lookup error", lookupError);
                }

                if (data && data.email) {
                    targetEmail = data.email;
                } else {
                    // Username not found or multiple users found (taking specific path)
                    // If not found as username, we will still try to auth with it as is (will likely fail format check by supabase)
                    // But better to fail early here for UX
                    if (!isEmailFormat && !data) {
                         setError('اسم المستخدم غير موجود.');
                         setLoading(false);
                         return;
                    }
                }
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: targetEmail,
                password: password,
            });

            if (signInError) {
                console.error("Login Error:", signInError);
                if (signInError.message === 'Invalid login credentials') {
                    setError('بيانات الدخول غير صحيحة');
                } else if (signInError.message.includes("Email not confirmed")) {
                    setError('الحساب غير مفعل (البريد غير مؤكد)');
                } else {
                    setError(getErrorMessage(signInError));
                }
                setLoading(false);
                return;
            }

            // Success - App.tsx listener will handle transition
            // We keep loading true until unmount or transition

        } catch (e: any) {
            console.error("Critical Login Exception:", e);
            setError(getErrorMessage(e));
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark" dir="rtl">
                <div className="flex flex-col items-center gap-4 animate-pulse">
                    <div className="w-24 h-24 flex items-center justify-center">
                         {companyLogo ? (
                             <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
                         ) : (
                             <Logo className="w-16 h-16 animate-spin-slow" />
                         )}
                    </div>
                    <div className="text-gray-500 text-sm font-medium">جاري التحميل...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 relative overflow-hidden" dir="rtl">
            
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md p-8 md:p-10 space-y-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-3xl shadow-soft border border-white/50 dark:border-slate-700 z-10 mx-4 relative">
                <div className="flex flex-col items-center text-center">
                    {companyLogo ? (
                        <div className="w-32 h-32 mb-6 flex items-center justify-center drop-shadow-xl">
                            <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="mb-6 drop-shadow-2xl">
                            <Logo className="w-32 h-32" />
                        </div>
                    )}
                    
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">{companyName}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        مرحباً بك مجدداً، يرجى تسجيل الدخول للمتابعة
                    </p>
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div className="relative group">
                             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                <UserIcon size={20} />
                             </span>
                            <input
                                type="text"
                                required
                                className="w-full pr-12 pl-4 py-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                                placeholder="البريد الإلكتروني أو اسم المستخدم"
                                value={loginInput}
                                onChange={(e) => setLoginInput(e.target.value)}
                            />
                        </div>
                        <div className="relative group">
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                <Lock size={20} />
                             </span>
                            <input
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                className="w-full pr-12 pl-12 py-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                                placeholder="كلمة المرور"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary focus:outline-none p-1"
                                title={showPassword ? "إخفاء كلمة المرور" : "عرض كلمة المرور"}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    
                    {error && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <div className="flex flex-col gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800">
                                <div className="flex items-start gap-3">
                                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                                    <p className="font-bold leading-tight">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-primary/20 text-base font-bold text-white bg-gradient-to-r from-primary to-primary-dark hover:to-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                            {loading ? <span className="animate-pulse">جاري التحقق...</span> : 'تسجيل الدخول'}
                        </button>
                    </div>
                </form>
                
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => window.location.href = '/calculator'}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
                    >
                        <Calculator size={18}/>
                        حاسبة للعملاء (بدون دخول)
                    </button>
                </div>

                <div className="text-center space-y-4">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        © {new Date().getFullYear()} جميع الحقوق محفوظة
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
