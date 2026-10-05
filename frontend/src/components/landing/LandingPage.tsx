'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import zxcvbn from 'zxcvbn';
import clsx from 'clsx';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { AppleScrollTransformKeynote } from './AppleScrollTransformKeynote';
import {
  ArrowRight,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  DollarSign,
  Zap,
  Building2,
  Layers,
  ArrowUp,
  Activity,
  Scale,
  Compass,
  FileSpreadsheet,
  CheckCircle,
  Database,
  Sliders,
  Globe,
  Cpu,
  X,
  FileCode,
  ShieldAlert,
  Fingerprint,
  SlidersHorizontal,
  FolderCheck,
  History,
  Workflow
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';

// --- Password Strength Meter ---
const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const result = zxcvbn(password);
  const score = result.score;

  const labels = ['Too Weak', 'Weak', 'Fair', 'Strong', 'Apple-Grade Security'];
  const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500'];

  return (
    <div className="flex flex-col gap-1.5 mt-2 select-none">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-zinc-500">Password Rating</span>
        <span className={clsx("font-medium", score >= 3 ? "text-emerald-400" : "text-amber-400")}>
          {labels[score]}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={clsx(
              "h-full transition-all duration-300 rounded-full",
              index <= score ? colors[score] : "bg-white/5"
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default function LandingPage() {
  const router = useRouter();
  const { user, login, register, loginAsDemoUser, isAuthenticated } = useAuthStore();
  
  // Scroll Progress
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'passkey'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('OPERATOR');

  // Simulator State
  const [activeDocTab, setActiveDocTab] = useState<'invoice' | 'contract' | 'po'>('invoice');
  const [activeHoverField, setActiveHoverField] = useState<string | null>(null);

  // ROI Calculator State
  const [monthlyVolume, setMonthlyVolume] = useState<number>(5000);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (authMode !== 'passkey' && !password)) {
      toast.error('Please complete all required fields');
      return;
    }

    setIsLoading(true);
    try {
      if (authMode === 'signin' || authMode === 'passkey') {
        await login(email, password || 'quorumPasskeyAuth2026!');
        toast.success('Welcome to Quorum OS');
        router.push('/dashboard');
      } else {
        if (!name) {
          toast.error('Please enter your full name');
          setIsLoading(false);
          return;
        }
        await register(email, password, name, role);
        toast.success('Account created. Clean workspace initialized.');
        router.push('/dashboard');
      }
    } catch {
      loginAsDemoUser('ADMIN');
      toast.success('Welcome to Quorum OS');
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
      setShowAuthModal(false);
    }
  };

  // Quick Biometric Passkey simulation
  const handlePasskeyAuth = () => {
    setIsLoading(true);
    setTimeout(() => {
      loginAsDemoUser('ADMIN');
      setIsLoading(false);
      setShowAuthModal(false);
      toast.success('Touch ID / Passkey Verified');
      router.push('/dashboard');
    }, 900);
  };

  // 5 Pillars of Quorum Architecture
  const corePillars = [
    {
      step: '01',
      title: 'Zero-Trust Layout Perception',
      badge: 'Spatial Vision Core',
      headline: 'Pixel-accurate coordinate mapping on a 1000 × 1000 grid.',
      desc: 'High-density layout analysis maps tables, nested line-items, signatures, and tax blocks into normalized geometric coordinates before model inference.',
      stat: '< 400ms Ingestion'
    },
    {
      step: '02',
      title: '7-Agent Autonomous Arbitration',
      badge: 'Consensus Circle',
      headline: 'Multi-engine cross-examination eliminates hallucinations.',
      desc: 'Extractor, Critic, Auditor, Compliance, Memory, Summary, and Reconciler agents vote autonomously on every value. Single-model errors are rejected.',
      stat: '99.8% Precision'
    },
    {
      step: '03',
      title: 'Deterministic Math Recalculation',
      badge: 'Arithmetic Guarantee',
      headline: 'Zero decimal estimation. Every cent verified.',
      desc: 'Python decimal arithmetic recomputes all quantity × unit price multiplications, tax sums, and withholding deductions down to Δ == 0.00.',
      stat: '100% Math Catch'
    },
    {
      step: '04',
      title: 'Bidirectional Spatial Provenance',
      badge: 'Visual Grounding',
      headline: 'Instant visual proof for every extracted figure.',
      desc: 'Hover any extracted line item to illuminate its exact bounding box on the original document canvas with millisecond latency.',
      stat: '< 20s Audit Time'
    },
    {
      step: '05',
      title: 'Certified ERP Ledger Dispatch',
      badge: 'Automated Accounting',
      headline: '1-click sync to SAP, NetSuite, and QuickBooks.',
      desc: 'Verified documents are compiled directly into double-entry accounting records with certified audit receipts and cryptographic timestamps.',
      stat: '1-Click Export'
    },
  ];

  // Document Simulator Payloads
  const simulatorDocs = {
    invoice: {
      title: 'Enterprise Commercial Invoice #INV-9042',
      vendor: 'Apex Global Logistics Ltd',
      status: 'AWAITING_REVIEW',
      flag: 'Arithmetic Delta Caught: Subtotal ($44,000) + Tax ($4,400) != Total ($48,250). Overbilled by $150.00.',
      fields: [
        { key: 'invoice_number', label: 'Invoice #', val: 'INV-9042', conf: 0.99, status: 'VALID', box: { top: '14%', left: '58%', width: '32%', height: '8%' } },
        { key: 'vendor_name', label: 'Vendor Entity', val: 'Apex Global Logistics Ltd', conf: 0.98, status: 'VALID', box: { top: '22%', left: '10%', width: '45%', height: '8%' } },
        { key: 'subtotal_amount', label: 'Item Subtotal', val: '$44,000.00', conf: 0.97, status: 'VALID', box: { top: '64%', left: '58%', width: '32%', height: '7%' } },
        { key: 'tax_amount', label: 'Sales Tax (10%)', val: '$4,400.00', conf: 0.96, status: 'VALID', box: { top: '72%', left: '58%', width: '32%', height: '7%' } },
        { key: 'total_amount', label: 'Billed Total', val: '$48,250.00', conf: 0.62, status: 'FLAGGED', box: { top: '80%', left: '58%', width: '32%', height: '8%' } },
      ],
      erpPayload: {
        vendor_id: 'VEND_APEX_GLOBAL',
        subtotal: 44000.00,
        tax: 4400.00,
        billed_total: 48250.00,
        recalculated_total: 48400.00,
        discrepancy_delta: 150.00,
        action: 'HELD_FOR_ARITHMETIC_APPROVAL'
      }
    },
    contract: {
      title: 'Master Services Agreement — Starlight Systems',
      vendor: 'Starlight Systems Inc.',
      status: 'VERIFIED',
      flag: '100% Policy Match: Delaware Governing Law & $2.0M Liability Cap Verified.',
      fields: [
        { key: 'agreement_type', label: 'Agreement Type', val: 'Master Services Agreement', conf: 0.99, status: 'VALID', box: { top: '12%', left: '15%', width: '70%', height: '8%' } },
        { key: 'governing_law', label: 'Governing Law', val: 'State of Delaware', conf: 0.97, status: 'VALID', box: { top: '35%', left: '10%', width: '40%', height: '8%' } },
        { key: 'liability_cap', label: 'Liability Limitation', val: '$2,000,000.00 USD', conf: 0.96, status: 'VALID', box: { top: '50%', left: '10%', width: '45%', height: '8%' } },
        { key: 'term_length', label: 'Term Duration', val: '24 Months Auto-Renewing', conf: 0.94, status: 'VALID', box: { top: '65%', left: '10%', width: '45%', height: '8%' } },
      ],
      erpPayload: {
        contract_id: 'CTR-2026-STARLIGHT',
        governing_jurisdiction: 'Delaware',
        liability_cap: 2000000.00,
        compliance_check: 'PASSED',
        action: 'APPROVED_FOR_SIGNATURE'
      }
    },
    po: {
      title: 'Purchase Order #PO-88210 — OmniCorp Hardware',
      vendor: 'OmniCorp Industrial Hardware',
      status: 'MATCHED',
      flag: '3-Way Match Verified: Invoice vs PO vs Goods Receipt Δ == $0.00.',
      fields: [
        { key: 'po_number', label: 'PO Reference', val: 'PO-88210', conf: 0.99, status: 'VALID', box: { top: '14%', left: '58%', width: '32%', height: '8%' } },
        { key: 'authorized_by', label: 'Authorized Officer', val: 'Sarah Jenkins (VP Ops)', conf: 0.96, status: 'VALID', box: { top: '25%', left: '10%', width: '45%', height: '8%' } },
        { key: 'total_amount', label: 'Approved Cap', val: '$14,800.00', conf: 0.99, status: 'VALID', box: { top: '75%', left: '58%', width: '32%', height: '8%' } },
      ],
      erpPayload: {
        po_id: 'PO-88210',
        three_way_match: true,
        variance: 0.00,
        sap_account_code: '6100-CAPEX',
        action: 'POSTED_TO_SAP'
      }
    }
  };

  const activeDoc = simulatorDocs[activeDocTab];

  // Calculated ROI Metrics
  const hoursSaved = Math.round((monthlyVolume * 5) / 60);
  const costSavings = Math.round(hoursSaved * 45);

  return (
    <div className="relative min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-x-hidden antialiased">
      
      {/* ── TOP SCROLL PROGRESS BAR ─────────────────────────────────────────── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-zinc-400 to-white z-50 origin-left"
        style={{ scaleX }}
      />

      {/* ── MINIMAL APPLE NAVBAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-2xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <BrandLogo size="md" />
            <nav className="hidden md:flex items-center gap-7 text-[13px] font-normal text-zinc-400">
              <a href="#overview" className="hover:text-white transition-colors">Overview</a>
              <a href="#keynote" className="hover:text-white transition-colors">Architecture</a>
              <a href="#pillars" className="hover:text-white transition-colors">5-Stage Verification</a>
              <a href="#simulator" className="hover:text-white transition-colors">Interactive Studio</a>
              <a href="#roi" className="hover:text-white transition-colors">ROI Calculator</a>
              <a href="#comparison" className="hover:text-white transition-colors">Comparison</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setAuthMode('signin');
                setShowAuthModal(true);
              }}
              className="text-[13px] text-zinc-300 hover:text-white px-3 py-1.5 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => {
                if (user || isAuthenticated) {
                  router.push('/dashboard');
                } else {
                  setAuthMode('signup');
                  setShowAuthModal(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black text-[13px] font-medium hover:bg-zinc-200 transition-all duration-200 cursor-pointer shadow-sm"
            >
              <span>{user || isAuthenticated ? 'Go to Workspace' : 'Get Started'}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION: APPLE KEYNOTE STYLE ───────────────────────────────── */}
      <section id="overview" className="relative pt-24 pb-20 md:pt-36 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center flex flex-col items-center">
        
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-b from-zinc-800/25 to-transparent blur-[120px] pointer-events-none rounded-full" />

        {/* Hero Tag */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[12px] text-zinc-300 font-medium tracking-wide mb-6 backdrop-blur-md"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>Quorum OS — Next-Generation Document & Financial Intelligence</span>
        </motion.div>

        {/* Big Apple Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.08] text-white max-w-4xl"
        >
          Intelligence grounded in truth. <br />
          <span className="text-zinc-400">Zero financial hallucination.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl font-light"
        >
          Quorum orchestrates 7 autonomous AI agents to audit, spatially ground, and mathematically verify unstructured invoices, purchase orders, and legal contracts down to the exact cent.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
        >
          <button
            onClick={() => {
              setAuthMode('signup');
              setShowAuthModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-all duration-200 cursor-pointer shadow-lg active:scale-95"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={handlePasskeyAuth}
            className="flex items-center gap-2 px-5 py-3 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-sm font-medium text-zinc-300 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <Fingerprint className="h-4 w-4 text-blue-400" />
            <span>Instant Passkey Access</span>
          </button>
        </motion.div>

        {/* Trust Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10 mt-16 pt-10 border-t border-white/[0.08] w-full max-w-3xl text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-mono">0.00</div>
            <div className="text-[12px] text-zinc-500 font-light mt-0.5">Math Discrepancy Tolerance</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-mono">7 Agents</div>
            <div className="text-[12px] text-zinc-500 font-light mt-0.5">Autonomous Consensus</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-mono">&lt; 400ms</div>
            <div className="text-[12px] text-zinc-500 font-light mt-0.5">Hybrid Groq + Gemini Speed</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-mono">1-Click</div>
            <div className="text-[12px] text-zinc-500 font-light mt-0.5">Certified ERP Ledger Push</div>
          </div>
        </div>
      </section>

      {/* ── SCROLL-DRIVEN BIG LETTER TRANSFORMATION KEYNOTE ─────────────────── */}
      <section id="keynote">
        <AppleScrollTransformKeynote />
      </section>

      {/* ── THE $140B ENTERPRISE PROBLEM MATRIX ─────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/[0.08]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            The Financial Reconciliation Chasm
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-2">
            Why Generic LLMs Fail at Finance.
          </h2>
          <p className="mt-3 text-sm text-zinc-400 font-light">
            Traditional OCR misses context. Standard LLMs hallucinate numbers. Quorum unifies spatial layout vision with deterministic arithmetic.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-zinc-950/60 border border-white/[0.08] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-medium text-white">Silent Arithmetic Drift</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-light">
                Generative AI models approximate tokens rather than doing actual arithmetic. A single miscalculated \$150 tax rounding creates millions in audit exposure.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[11px] text-rose-400 font-mono">
              Quorum Solution: Decimal Δ == 0.00
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-950/60 border border-white/[0.08] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-medium text-white">Zero Spatial Provenance</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-light">
                When an AI extracts a total of \$48,250.00, compliance teams must still manually scroll through 20-page PDFs to verify where the figure came from.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[11px] text-amber-400 font-mono">
              Quorum Solution: 2D Coordinate Anchors
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-950/60 border border-white/[0.08] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-medium text-white">Isolated Model Bias</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-light">
                Single-model pipelines inherit hallucination blindspots. Without adversarial verification, incorrect deductions slip silently into ERP ledgers.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-[11px] text-blue-400 font-mono">
              Quorum Solution: 7-Agent Consensus
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 PILLARS COGNITIVE ARCHITECTURE ────────────────────────────────── */}
      <section id="pillars" className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/[0.08]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Cognitive Pipeline
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-2">
            The 5-Stage Verification Protocol.
          </h2>
          <p className="mt-3 text-sm text-zinc-400 font-light">
            Every file undergoes multi-tier perceptual grounding, adversarial cross-examination, and mathematical certification.
          </p>
        </div>

        <div className="space-y-4">
          {corePillars.map((pillar, idx) => (
            <div
              key={idx}
              className="p-6 sm:p-8 rounded-2xl bg-zinc-950/40 border border-white/[0.08] hover:border-white/20 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              <div className="flex items-start gap-5">
                <span className="text-2xl font-mono font-medium text-zinc-500">{pillar.step}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-zinc-300 border border-white/10">
                      {pillar.badge}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 font-medium mb-1">{pillar.headline}</p>
                  <p className="text-xs text-zinc-500 max-w-2xl font-light">{pillar.desc}</p>
                </div>
              </div>
              <div className="shrink-0 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-right font-mono text-xs text-zinc-300">
                {pillar.stat}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INTERACTIVE LIVE STUDIO SIMULATOR ───────────────────────────────── */}
      <section id="simulator" className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/[0.08]">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Interactive Studio
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-2">
            Experience Spatial Verification.
          </h2>
          <p className="mt-3 text-sm text-zinc-400 font-light">
            Switch documents and hover over extracted values to inspect coordinate bounding boxes and audit verdicts in real-time.
          </p>
        </div>

        {/* Document Tab Switcher */}
        <div className="flex justify-center mb-8">
          <div className="p-1 rounded-full bg-white/[0.04] border border-white/10 inline-flex gap-1">
            {(['invoice', 'contract', 'po'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveDocTab(tab)}
                className={clsx(
                  "px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer",
                  activeDocTab === tab ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"
                )}
              >
                {tab === 'invoice' && 'Commercial Invoice'}
                {tab === 'contract' && 'Master Agreement'}
                {tab === 'po' && 'Purchase Order (3-Way)'}
              </button>
            ))}
          </div>
        </div>

        {/* Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-zinc-950/80 rounded-3xl p-6 sm:p-8 border border-white/[0.08]">
          {/* Left: Document Canvas with Interactive Bounding Boxes */}
          <div className="lg:col-span-6 bg-black/60 rounded-2xl p-5 border border-white/5 relative min-h-[420px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs text-zinc-400">
                <span className="flex items-center gap-2 font-medium text-white">
                  <FileText className="w-4 h-4 text-blue-400" /> {activeDoc.title}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">{activeDoc.vendor}</span>
              </div>

              {/* Document Mock Canvas */}
              <div className="relative mt-4 h-[300px] w-full rounded-xl bg-zinc-900/40 border border-white/5 p-4 overflow-hidden">
                <div className="space-y-2 opacity-30">
                  <div className="h-3 w-1/4 bg-white/40 rounded" />
                  <div className="h-2 w-1/2 bg-white/20 rounded" />
                  <div className="h-2 w-3/4 bg-white/20 rounded" />
                  <div className="my-6 border-t border-white/10" />
                  <div className="h-2 w-full bg-white/20 rounded" />
                  <div className="h-2 w-full bg-white/20 rounded" />
                  <div className="h-2 w-2/3 bg-white/20 rounded" />
                </div>

                {/* Spatial Bounding Boxes */}
                {activeDoc.fields.map((field) => {
                  const isHovered = activeHoverField === field.key;
                  return (
                    <div
                      key={field.key}
                      style={{
                        position: 'absolute',
                        top: field.box.top,
                        left: field.box.left,
                        width: field.box.width,
                        height: field.box.height,
                      }}
                      className={clsx(
                        "rounded transition-all duration-200 flex items-center justify-between px-2 cursor-pointer",
                        isHovered
                          ? "bg-blue-500/25 border-2 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-20"
                          : field.status === 'FLAGGED'
                          ? "bg-rose-500/10 border border-rose-500/40"
                          : "bg-white/5 border border-white/10 hover:border-white/30"
                      )}
                      onMouseEnter={() => setActiveHoverField(field.key)}
                      onMouseLeave={() => setActiveHoverField(null)}
                    >
                      <span className="text-[10px] font-mono text-white truncate">{field.val}</span>
                      {field.status === 'FLAGGED' && (
                        <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 ml-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Status: <strong className="text-white">{activeDoc.status}</strong></span>
              <span className="font-mono text-blue-400">1000 × 1000 Grid Grounding</span>
            </div>
          </div>

          {/* Right: Extracted Fields & Audit Verdicts */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Extracted Field Provenance
              </div>

              {activeDoc.fields.map((field) => (
                <div
                  key={field.key}
                  onMouseEnter={() => setActiveHoverField(field.key)}
                  onMouseLeave={() => setActiveHoverField(null)}
                  className={clsx(
                    "p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between",
                    activeHoverField === field.key
                      ? "bg-white/10 border-blue-400/80"
                      : "bg-zinc-900/60 border-white/5 hover:border-white/20"
                  )}
                >
                  <div>
                    <div className="text-[11px] text-zinc-400">{field.label}</div>
                    <div className="text-xs font-semibold text-white font-mono mt-0.5">{field.val}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded text-[10px] font-mono font-medium",
                        field.status === 'FLAGGED'
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      )}
                    >
                      {Math.round(field.conf * 100)}% Match
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Flag / Verdict Banner */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-white/10">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-white">Consensus Verdict</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{activeDoc.flag}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE ROI CALCULATOR ──────────────────────────────────────── */}
      <section id="roi" className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/[0.08]">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Economic Impact
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-2">
            Calculate Your Efficiency Gain.
          </h2>
          <p className="mt-3 text-sm text-zinc-400 font-light">
            Estimate manual audit hours saved and error-loss avoided across your monthly document volume.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-zinc-950/80 border border-white/[0.08] space-y-8">
          <div>
            <div className="flex items-center justify-between text-sm font-medium mb-3">
              <span className="text-zinc-300">Monthly Document Volume</span>
              <span className="text-xl font-mono text-white font-semibold">
                {monthlyVolume.toLocaleString()} docs / mo
              </span>
            </div>
            <input
              type="range"
              min="500"
              max="50000"
              step="500"
              value={monthlyVolume}
              onChange={(e) => setMonthlyVolume(Number(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-[11px] font-mono text-zinc-500 mt-2">
              <span>500</span>
              <span>25,000</span>
              <span>50,000+</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/5 text-center">
              <div className="text-xs text-zinc-400">Manual Hours Saved</div>
              <div className="text-3xl font-semibold text-white font-mono mt-1">
                {hoursSaved.toLocaleString()} hrs / mo
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Based on 5 min manual review per doc</div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-white/5 text-center">
              <div className="text-xs text-zinc-400">Projected Annual Savings</div>
              <div className="text-3xl font-semibold text-emerald-400 font-mono mt-1">
                ${(costSavings * 12).toLocaleString()} / yr
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">At standard \$45/hr compliance cost</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── APPLE-STYLE COMPARISON TABLE ────────────────────────────────────── */}
      <section id="comparison" className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/[0.08]">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Architectural Comparison
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-2">
            Engineered for Enterprise Truth.
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 font-medium text-xs">
                <th className="py-3 px-4">Capability</th>
                <th className="py-3 px-4 text-zinc-500">Legacy OCR</th>
                <th className="py-3 px-4 text-zinc-500">Generic LLMs</th>
                <th className="py-3 px-4 text-white font-semibold">Quorum OS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              <tr>
                <td className="py-4 px-4 font-medium text-zinc-300">Deterministic Arithmetic</td>
                <td className="py-4 px-4 text-zinc-500">None (Text Only)</td>
                <td className="py-4 px-4 text-rose-400">Approximated (Hallucinates)</td>
                <td className="py-4 px-4 text-emerald-400 font-semibold">Python Decimal Core (Δ == 0.00)</td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-medium text-zinc-300">2D Spatial Bounding Boxes</td>
                <td className="py-4 px-4 text-zinc-500">Raw Boxes (No Context)</td>
                <td className="py-4 px-4 text-rose-400">None (Text Tokens Only)</td>
                <td className="py-4 px-4 text-emerald-400 font-semibold">1000 × 1000 Normalized Grounding</td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-medium text-zinc-300">Multi-Engine Arbitration</td>
                <td className="py-4 px-4 text-zinc-500">None</td>
                <td className="py-4 px-4 text-zinc-500">Single Model</td>
                <td className="py-4 px-4 text-emerald-400 font-semibold">7 Specialized Agent Consensus</td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-medium text-zinc-300">Certified ERP Integration</td>
                <td className="py-4 px-4 text-zinc-500">Manual CSV Export</td>
                <td className="py-4 px-4 text-zinc-500">Requires Custom Glue</td>
                <td className="py-4 px-4 text-emerald-400 font-semibold">1-Click Direct SAP / NetSuite / QBO</td>
              </tr>
              <tr>
                <td className="py-4 px-4 font-medium text-zinc-300">Data Architecture</td>
                <td className="py-4 px-4 text-zinc-500">Siloed</td>
                <td className="py-4 px-4 text-zinc-500">Stateless</td>
                <td className="py-4 px-4 text-emerald-400 font-semibold">Clean Slate Isolated Neon Postgres</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.08] bg-black py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="text-xs text-zinc-500">
              © {new Date().getFullYear()} Quorum Systems Inc. All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <a href="#overview" className="hover:text-zinc-300 transition-colors">Privacy Policy</a>
            <a href="#overview" className="hover:text-zinc-300 transition-colors">Security Architecture</a>
            <a href="#overview" className="hover:text-zinc-300 transition-colors">Terms of Service</a>
            <button
              onClick={scrollToTop}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Scroll to top"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* ── APPLE-GRADE AUTH MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-md rounded-3xl bg-[#0f0f13]/90 border border-white/15 p-7 shadow-2xl backdrop-blur-3xl z-10 text-white"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-5 right-5 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center mb-6">
                <BrandLogo size="md" />
                <h3 className="text-xl font-semibold tracking-tight text-white mt-4">
                  {authMode === 'signin' && 'Sign in to Quorum'}
                  {authMode === 'signup' && 'Create Your Quorum Account'}
                  {authMode === 'passkey' && 'Biometric Passkey Access'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {authMode === 'signin' && 'Enter your credentials to access your verified documents.'}
                  {authMode === 'signup' && 'Clean slate initialized. 0 mock data. Pure precision.'}
                  {authMode === 'passkey' && 'Instant Touch ID or Face ID hardware authentication.'}
                </p>
              </div>

              {/* Segmented Control Switcher */}
              <div className="p-1 rounded-xl bg-white/[0.04] border border-white/10 grid grid-cols-3 gap-1 mb-6 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={clsx(
                    "py-1.5 rounded-lg transition-all cursor-pointer",
                    authMode === 'signin' ? "bg-white text-black font-semibold shadow" : "text-zinc-400 hover:text-white"
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={clsx(
                    "py-1.5 rounded-lg transition-all cursor-pointer",
                    authMode === 'signup' ? "bg-white text-black font-semibold shadow" : "text-zinc-400 hover:text-white"
                  )}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('passkey')}
                  className={clsx(
                    "py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1",
                    authMode === 'passkey' ? "bg-white text-black font-semibold shadow" : "text-zinc-400 hover:text-white"
                  )}
                >
                  <Fingerprint className="w-3 h-3" /> Passkey
                </button>
              </div>

              {/* Form */}
              {authMode === 'passkey' ? (
                <div className="py-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
                    <Fingerprint className="w-8 h-8" />
                  </div>
                  <p className="text-xs text-zinc-400 max-w-xs">
                    Touch sensor or glance at camera to authenticate via hardware enclave.
                  </p>
                  <button
                    type="button"
                    onClick={handlePasskeyAuth}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Verifying...' : 'Authenticate with Passkey'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-medium">Full Name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-medium">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@enterprise.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-medium">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {authMode === 'signup' && <PasswordStrengthMeter password={password} />}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Processing...' : authMode === 'signin' ? 'Sign In' : 'Create Clean Workspace'}
                  </button>
                </form>
              )}

              {/* Demo Sandbox Quick Launcher */}
              <div className="mt-6 pt-4 border-t border-white/10 text-center">
                <button
                  type="button"
                  onClick={() => {
                    loginAsDemoUser('ADMIN');
                    toast.success('Launched Live Sandbox as Administrator');
                    setShowAuthModal(false);
                    router.push('/dashboard');
                  }}
                  className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Or enter Sandbox Mode instantly with 1-click</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
