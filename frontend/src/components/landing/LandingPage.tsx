'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import CountUp from 'react-countup';
import zxcvbn from 'zxcvbn';
import clsx from 'clsx';
import { 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  Bot, 
  Cpu, 
  Search, 
  ShieldCheck, 
  Database,
  FileText,
  FileCheck,
  Activity,
  ArrowUpRight,
  MousePointer,
  Play
} from 'lucide-react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

// --- Password Strength Meter Component ---
const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const result = zxcvbn(password);
  const score = result.score; // 0 to 4

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong (Required)', 'Very Strong'];
  const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-[#4f8ef7]'];

  return (
    <div className="flex flex-col gap-1.5 mt-1 select-none">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground">Strength:</span>
        <span className={clsx("font-bold", score >= 3 ? "text-emerald-400" : "text-rose-400")}>
          {labels[score]} ({score}/4)
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={clsx(
              "h-full transition-all duration-300 rounded-full",
              index <= score ? colors[score] : "bg-white/10"
            )}
          />
        ))}
      </div>
      {score < 3 && (
        <p className="text-[9px] text-rose-400 font-mono mt-0.5">
          ⚠️ Minimum score 3 required. {result.feedback.suggestions?.[0] || 'Use a longer phrase with mixed characters.'}
        </p>
      )}
    </div>
  );
};

// --- HTML5 Canvas Particle Engine ---
const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Dynamic sizing on resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle details
    const particleCount = Math.min(100, Math.floor((width * height) / 15000)); // Dynamic density
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
    }> = [];

    const mouse = { x: -1000, y: -1000, radius: 150 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.5,
        color: Math.random() > 0.5 ? 'rgba(79, 142, 247, 0.35)' : 'rgba(139, 92, 246, 0.35)',
      });
    }

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw lines between particles & gravitational mouse attraction
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Slowly drift
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off borders
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse gravity pull
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          p.x -= dx * force * 0.03;
          p.y -= dy * force * 0.03;
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const ldx = p.x - p2.x;
          const ldy = p.y - p2.y;
          const ldist = Math.sqrt(ldx * ldx + ldy * ldy);

          if (ldist < 100) {
            const alpha = (100 - ldist) / 100 * 0.15;
            ctx.strokeStyle = `rgba(124, 58, 237, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
};

// --- Landing Page ---
export default function LandingPage() {
  const router = useRouter();
  const { user, login, register, isAuthenticated } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('OPERATOR');
  const [expandedDoc, setExpandedDoc] = useState<number | null>(null);

  const statsRef = useRef<HTMLDivElement | null>(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.3 });

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back to Googi!');
        router.push('/dashboard');
      } else {
        if (!name) {
          toast.error('Please enter your full name');
          setIsLoading(false);
          return;
        }
        if (zxcvbn(password).score < 3) {
          toast.error('Password is too weak. Please choose a stronger password (minimum score 3/4 required).');
          setIsLoading(false);
          return;
        }
        await register(email, password, name, role);
        toast.success('Registration successful! Please sign in.');
        setIsLogin(true);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Authentication failed';
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-seeded Search Demo State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDemoResult, setActiveDemoResult] = useState<string | null>(null);
  const searchDemos = [
    { q: 'invoice vendors with outstanding amounts', ans: 'Found 3 invoices: Vendor Corp ($45k pending), Acme Inc ($12k pending), Global Ltd ($3k pending).' },
    { q: 'compliance report validation date', ans: 'Certificate #98124 approved on Dec 2025. Valid through Dec 2028.' },
    { q: 'contract escalation rules', ans: 'Sec 12.4: Escalation routes to VP within 48h. Breach triggers standard 30-day cure period.' }
  ];

  const triggerSearchDemo = (q: string, ans: string) => {
    setSearchQuery(q);
    setActiveDemoResult(ans);
  };

  return (
    <div className="relative min-h-screen bg-[#050810] text-[#f1f5f9] font-sans selection:bg-primary/30 overflow-x-hidden">
      
      {/* 1. HERO SECTION WITH PARTICLE BACKGROUND */}
      <section className="relative min-h-screen flex flex-col justify-between items-center px-4 py-8 md:px-12 md:py-16 overflow-hidden border-b border-white/[0.04]">
        <ParticleBackground />

        {/* Top Header Row */}
        <div className="w-full max-w-7xl flex items-center justify-between z-10 select-none">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-tr from-[#4f8ef7] to-[#8b5cf6] text-white shadow-lg shadow-primary/20">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <span className="text-base font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-neutral-100 to-neutral-300 font-sans">
              GOOGI
            </span>
          </div>
          <a href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 uppercase font-mono font-bold tracking-wider">
            Explore Features ↓
          </a>
        </div>

        {/* Hero Content (Floating Glassmorphic Card + Text Grid) */}
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center justify-center my-auto z-10 py-12">
          
          {/* Hero Left: Platform Headline */}
          <div className="lg:col-span-7 flex flex-col gap-6 text-center lg:text-left">
            <div className="inline-flex self-center lg:self-start items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs text-primary font-semibold tracking-wide">
              <Bot className="h-3.5 w-3.5" />
              Multi-Agent AI Document Auditing Platform
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-100 to-neutral-400 font-sans">
              Distributed Document <br className="hidden sm:inline" />
              Intelligence & Search
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed font-sans">
              Googi is a cognitive document orchestration platform that pairs multi-agent LLM consensus audits with PageRank hybrid vector searches and human-in-the-loop overrides.
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-2">
              <a href="#how-it-works" className="px-5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.05] hover:border-white/[0.1] text-xs font-semibold tracking-wider font-mono uppercase text-neutral-300 hover:text-white transition-all duration-300">
                How It Works
              </a>
              <a href="#demo" className="px-5 py-2.5 rounded-xl border border-primary/20 bg-primary/10 hover:bg-primary/20 text-xs font-semibold tracking-wider font-mono uppercase text-primary transition-all duration-300 flex items-center gap-1.5">
                <Play className="h-3 w-3 fill-current" /> Interactive Demo
              </a>
            </div>
          </div>

          {/* Hero Right: Login Glass Card */}
          <div className="lg:col-span-5 w-full flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="w-full max-w-[420px] rounded-3xl border border-white/[0.08] backdrop-blur-[24px] saturate-[180%] bg-white/[0.03] p-8 shadow-2xl relative overflow-hidden"
              style={{ boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)' }}
            >
              {/* Authenticated redirect helper */}
              {user || isAuthenticated ? (
                <div className="flex flex-col gap-6 text-center py-6 select-none">
                  <div className="flex justify-center">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#4f8ef7] to-[#8b5cf6] flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary/20">
                      {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground font-sans">Welcome Back</h3>
                    <p className="text-xs text-muted-foreground mt-1">Logged in as {user?.full_name || 'User'}</p>
                  </div>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-[#4f8ef7] to-[#8b5cf6] hover:brightness-110 text-white rounded-xl text-sm font-semibold tracking-wider transition-all duration-300 cursor-pointer shadow-md"
                  >
                    <span>Go to Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1 items-center text-center select-none">
                    <h2 className="text-lg font-bold text-foreground font-sans">
                      {isLogin ? 'Sign In' : 'Create Account'}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {isLogin ? 'Authenticate to access your workspace' : 'Complete sign up parameters'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 mt-2">
                    {!isLogin && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Full Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Aaditya Uniyal"
                          className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors duration-200 font-sans"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="operator@googi.io"
                        className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors duration-200 font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors duration-200 font-sans"
                      />
                      {!isLogin && <PasswordStrengthMeter password={password} />}
                    </div>

                    {!isLogin && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase font-mono">Platform Role</label>
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors duration-200 font-sans cursor-pointer"
                        >
                          <option value="OPERATOR">Operator (Upload & Search)</option>
                          <option value="REVIEWER">Reviewer (Manual Verification)</option>
                          <option value="ADMIN">Admin (All privileges)</option>
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="group flex items-center justify-center gap-2 mt-2 w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#4f8ef7] to-[#8b5cf6] border border-white/[0.08] hover:shadow-lg hover:shadow-primary/20 text-white transition-all duration-300 shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <span>{isLogin ? 'Authenticate' : 'Register Account'}</span>
                          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>

                    {/* SSO Buttons */}
                    <div className="flex flex-col gap-2.5 mt-1">
                      <div className="flex items-center gap-2 text-muted-foreground select-none">
                        <div className="h-px bg-white/[0.04] flex-1" />
                        <span className="text-[9px] font-bold uppercase tracking-wider font-mono">Or Continue With</span>
                        <div className="h-px bg-white/[0.04] flex-1" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            toast.success("Connecting Google SSO Authentication...");
                            setIsLoading(true);
                            setTimeout(async () => {
                              try {
                                await login("operator@googi.io", "password123");
                                toast.success("Successfully logged in via Google SSO!");
                                router.push('/dashboard');
                              } catch {
                                toast.error("Google SSO login failed");
                              } finally {
                                setIsLoading(false);
                              }
                            }, 1000);
                          }}
                          className="flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.05] hover:border-white/[0.08] text-[10px] font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                          </svg>
                          <span>Google</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            toast.success("Connecting Microsoft SSO Authentication...");
                            setIsLoading(true);
                            setTimeout(async () => {
                              try {
                                await login("operator@googi.io", "password123");
                                toast.success("Successfully logged in via Microsoft SSO!");
                                router.push('/dashboard');
                              } catch {
                                toast.error("Microsoft SSO login failed");
                              } finally {
                                setIsLoading(false);
                              }
                            }, 1000);
                          }}
                          className="flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.05] hover:border-white/[0.08] text-[10px] font-semibold text-neutral-350 hover:text-white transition-all cursor-pointer"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 23 23" fill="currentColor">
                            <rect x="0" y="0" width="11" height="11" fill="#f25022" />
                            <rect x="12" y="0" width="11" height="11" fill="#7fba00" />
                            <rect x="0" y="12" width="11" height="11" fill="#00a4ef" />
                            <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
                          </svg>
                          <span>Microsoft</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mt-2 select-none">
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200 font-mono"
                    >
                      {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="w-full flex justify-center z-10 pt-4 select-none">
          <div className="h-10 w-6 border-2 border-white/20 rounded-full flex justify-center p-1.5 opacity-60">
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="h-1.5 w-1.5 rounded-full bg-white"
            />
          </div>
        </div>
      </section>

      {/* 2. SECTION A — WHAT IS GOOGI? */}
      <section id="features" className="py-24 px-6 md:px-12 border-b border-white/[0.04] bg-[#070b17]/30 relative">
        <div className="max-w-7xl mx-auto flex flex-col gap-12">
          <div className="text-center max-w-2xl mx-auto flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-widest text-[#4f8ef7] font-mono uppercase">Googi Core Features</span>
            <h2 className="text-2xl md:text-3xl font-bold font-sans">Cognitive Platform Features</h2>
            <p className="text-xs text-muted-foreground font-sans">Advanced components working in distributed lockstep for maximum security and ingestion accuracy.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4">
            {[
              {
                icon: Cpu,
                title: 'Multi-Agent Consensus',
                desc: 'Uses specialized extraction, audit, criticism, and reconciler LLM agents concurrently. Compares parameters against databases for consensus score calibration.',
                color: 'group-hover:border-[#4f8ef7]/40'
              },
              {
                icon: Search,
                title: 'PageRank & Vector Search',
                desc: 'Combines reciprocal rank fusion (RRF) of PG tsvector text indexes and high-accuracy Chroma semantic vector embeddings, boosted by crawling PageRank weights.',
                color: 'group-hover:border-[#8b5cf6]/40'
              },
              {
                icon: Database,
                title: 'Distributed Crawler',
                desc: 'RabbitMQ queued tasks, domain sitemaps discovery, content change hash checks, and PageRank link calculation for external knowledgebases.',
                color: 'group-hover:border-[#22c55e]/40'
              }
            ].map((feat, idx) => (
              <div 
                key={idx}
                className="group border border-white/[0.04] bg-[#0d1117]/60 hover:bg-[#0d1117] rounded-2xl p-6 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl relative select-none cursor-default"
              >
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[#4f8ef7] w-11 h-11 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary/10">
                  <feat.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-neutral-100 font-sans mb-2 group-hover:text-primary transition-colors duration-200">
                  {feat.title}
                </h3>
                <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. SECTION B — HOW IT WORKS (Animated Pipeline Flowchart) */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 border-b border-white/[0.04] relative">
        <div className="max-w-7xl mx-auto flex flex-col gap-16">
          <div className="text-center max-w-2xl mx-auto flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-widest text-[#8b5cf6] font-mono uppercase">Data Orchestration Pipeline</span>
            <h2 className="text-2xl md:text-3xl font-bold font-sans">Multi-Agent Processing Flow</h2>
            <p className="text-xs text-muted-foreground font-sans">Visual representation of our pipeline execution steps from initial file drop to structured RAG index.</p>
          </div>

          <div className="relative w-full flex flex-col items-center justify-center gap-8 md:gap-4 max-w-5xl mx-auto font-mono">
            {/* flowchart items */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 w-full items-center relative z-10 text-center">
              {[
                { title: '1. Ingestion', desc: 'File Upload & OCR text extraction', icon: FileText },
                { title: '2. LLM Agents', desc: '5 concurrent validation agents', icon: Cpu },
                { title: '3. Reconcile', desc: 'Consensus calculation & checks', icon: Bot },
                { title: '4. Human Review', desc: 'Auditors verification queue', icon: FileCheck },
                { title: '5. RAG Index', desc: 'Semantic search vectors & metrics', icon: Activity }
              ].map((step, idx) => (
                <div key={idx} className="flex flex-col items-center p-5 rounded-2xl border border-white/[0.04] bg-[#0d1117]/80 shadow-md">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-neutral-300 mb-3 flex items-center justify-center">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="text-[11px] font-bold text-foreground mb-1">{step.title}</h4>
                  <p className="text-[9px] text-muted-foreground leading-normal">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Glowing lines background helper for visual flow */}
            <div className="absolute inset-0 top-1/2 -translate-y-1/2 hidden md:block h-0.5 bg-gradient-to-r from-primary/10 via-[#8b5cf6]/35 to-primary/10 w-full pointer-events-none z-0" />
          </div>
        </div>
      </section>

      {/* 4. SECTION C — AGENT INTELLIGENCE STATS TICKER */}
      <section ref={statsRef} className="py-20 px-6 md:px-12 border-b border-white/[0.04] bg-gradient-to-r from-[#050810] via-[#070e20] to-[#050810] relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center font-mono">
            {[
              { value: 99.2, decimals: 1, suffix: '%', label: 'Average OCR Accuracy' },
              { value: 5, decimals: 0, suffix: ' Agents', label: 'Concurrent Consensus Engine' },
              { value: 70, decimals: 0, suffix: '%', label: 'Verification Acceleration' }
            ].map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center p-6 border border-white/[0.04] bg-[#0d1117]/40 rounded-2xl">
                <span className="text-3xl md:text-4xl font-extrabold text-foreground flex items-center justify-center">
                  {statsInView ? (
                    <CountUp end={stat.value} decimals={stat.decimals} duration={2} separator="," />
                  ) : (
                    <span>0</span>
                  )}
                  {stat.suffix}
                </span>
                <span className="text-xs text-muted-foreground mt-2 font-sans tracking-wide">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SECTION D — INTERACTIVE SEARCH DEMO */}
      <section id="demo" className="py-24 px-6 md:px-12 border-b border-white/[0.04] relative">
        <div className="max-w-7xl mx-auto flex flex-col gap-12">
          <div className="text-center max-w-2xl mx-auto flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-widest text-[#22c55e] font-mono uppercase">Cognitive Demo Console</span>
            <h2 className="text-2xl md:text-3xl font-bold font-sans">Cognitive Query Sandbox</h2>
            <p className="text-xs text-muted-foreground font-sans">Try pre-seeded prompts below to preview index queries returns.</p>
          </div>

          <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
            {/* Fake Search Container */}
            <div className="glass-card border border-white/[0.06] p-6 bg-[#0c0c0c]/90 rounded-2xl flex flex-col gap-5">
              <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 p-2.5 pl-4 rounded-xl">
                <Search className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  readOnly
                  placeholder="Click a query suggestion below to test search capability..."
                  className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-xs text-foreground placeholder-neutral-500 font-mono"
                />
              </div>

              {/* Suggestions */}
              <div className="flex flex-wrap items-center gap-2 select-none">
                {searchDemos.map((demo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => triggerSearchDemo(demo.q, demo.ans)}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.05] hover:border-white/[0.08] text-[10px] font-semibold font-mono text-neutral-300 cursor-pointer transition-all duration-200"
                  >
                    "{demo.q}"
                  </button>
                ))}
              </div>

              {/* Demo Results Panel */}
              <AnimatePresence mode="wait">
                {activeDemoResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-4 rounded-xl border border-primary/10 bg-primary/5 flex flex-col gap-2.5 font-mono"
                  >
                    <div className="flex items-center justify-between text-[9px] font-bold text-primary uppercase">
                      <span>RRF Result Matches</span>
                      <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Cognitive Agent Answer</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {activeDemoResult}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION E — DOCUMENT TYPES SHOWCASE */}
      <section className="py-24 px-6 md:px-12 border-b border-white/[0.04] bg-[#070b17]/30 relative">
        <div className="max-w-7xl mx-auto flex flex-col gap-12">
          <div className="text-center max-w-2xl mx-auto flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-widest text-[#4f8ef7] font-mono uppercase">Pre-built Metadata Schemas</span>
            <h2 className="text-2xl md:text-3xl font-bold font-sans">OCR Documents Support</h2>
            <p className="text-xs text-muted-foreground font-sans">Ready-made validation metrics and classifiers mapping common business templates.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mt-4">
            {[
              { type: 'INVOICE', fields: 'Vendor, Invoice No, Total Amount, Tax, Due Date', detail: 'Checks duplicate invoices, vendor payment details, and total line items automatically.' },
              { type: 'CONTRACT', fields: 'Parties, Signature, Term, Jurisdiction, Liability', detail: 'Flags indemnification terms, jurisdiction alignment, and checks for digital signature validity.' },
              { type: 'RFQ', fields: 'Requestor, Quote Date, Line Items, Delivery terms', detail: 'Matches RFQ catalog requirements against submitted quotes and verifies tax calculations.' },
              { type: 'COMPLIANCE', fields: 'Certificate #, Issuing Authority, Expiration date', detail: 'Tracks validity periods, certificates authentication codes, and scans for regulatory drift.' },
              { type: 'PURCHASE_ORDER', fields: 'PO Number, Requisitioner, Delivery Date, Items', detail: 'Auto-correlates PO items against corresponding Vendor invoices within tolerances.' },
              { type: 'UNKNOWN', fields: 'Generic text structures, fallback custom schemas', detail: 'Uses general purpose agents to construct unstructured key-values out of raw text.' }
            ].map((doc, idx) => {
              const isExpanded = expandedDoc === idx;
              return (
                <motion.div 
                  key={idx}
                  onClick={() => setExpandedDoc(isExpanded ? null : idx)}
                  whileHover={{ y: -5, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="group p-5 border border-white/[0.04] bg-[#0d1117]/60 hover:bg-[#0d1117] rounded-2xl flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-[#4f8ef7]/5 select-none cursor-pointer relative"
                  style={{ perspective: 1000 }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold font-mono group-hover:rotate-12 transition-transform duration-300">
                      {doc.type[0]}
                    </div>
                    <h4 className="text-xs font-bold tracking-wider font-mono text-neutral-100">{doc.type}</h4>
                    <p className="text-[10px] text-muted-foreground leading-normal font-sans">
                      Extracted keys: {doc.fields}
                    </p>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-2 text-[9px] text-[#4f8ef7] leading-relaxed font-sans border-t border-white/[0.04] pt-2"
                        >
                          {doc.detail}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <div className="text-[9px] font-bold font-mono text-primary flex items-center gap-0.5 mt-4 group-hover:text-primary-hover">
                    <span>{isExpanded ? 'Collapse Schema' : 'Explore Schema'}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="py-12 px-6 md:px-12 relative border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 select-none text-xs text-muted-foreground font-mono">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} Googi AI Platform. Distributed under MIT License.</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground font-mono select-none">
            <a href="#" className="hover:text-foreground transition-colors">Documentation</a>
            <a href="#" className="hover:text-foreground transition-colors">GitHub Repository</a>
            <a href="#" className="hover:text-foreground transition-colors">API Docs</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
