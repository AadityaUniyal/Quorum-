'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import zxcvbn from 'zxcvbn';
import clsx from 'clsx';
import { BrandLogo } from '@/components/ui/BrandLogo';
import {
  ArrowRight,
  FileText,
  FileCheck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  ChevronLeft,
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
  Network,
  Database,
  Clock,
  Sliders,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';

// --- Password Strength Meter ---
const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const result = zxcvbn(password);
  const score = result.score;

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong (Required)', 'Very Strong'];
  const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-primary'];

  return (
    <div className="flex flex-col gap-1.5 mt-1 select-none">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground">Password Quality:</span>
        <span className={clsx("font-bold", score >= 3 ? "text-emerald-400" : "text-amber-400")}>
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
        <p className="text-[10px] text-amber-400 font-sans mt-0.5">
          Minimum strength of 3 required for enterprise safety.
        </p>
      )}
    </div>
  );
};

export default function LandingPage() {
  const router = useRouter();
  const { user, login, register, loginAsDemoUser, isAuthenticated } = useAuthStore();
  
  // Scroll Progress
  const { scrollYProgress, scrollY } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    return scrollY.onChange((latest) => {
      setShowScrollTop(latest > 400);
    });
  }, [scrollY]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('OPERATOR');

  // Interactive Architecture Flow Loop State
  const [activeLoopStep, setActiveLoopStep] = useState<number>(0);

  // Interactive Feature Track Filter & Scroll
  const [activeFeatureFilter, setActiveFeatureFilter] = useState<'all' | 'vision' | 'audit' | 'reconcile' | 'security'>('all');
  const featureScrollerRef = useRef<HTMLDivElement>(null);

  // Interactive Document Simulator State
  const [activeDocTab, setActiveDocTab] = useState<'invoice' | 'contract' | 'po'>('invoice');
  const [simulatorViewMode, setSimulatorViewMode] = useState<'fields' | 'json' | 'erp'>('fields');
  const [activeHoverField, setActiveHoverField] = useState<string | null>(null);

  // ROI Calculator State
  const [monthlyVolume, setMonthlyVolume] = useState<number>(5000);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome to DocIntel AI');
        router.push('/dashboard');
      } else {
        if (!name) {
          toast.error('Please enter your full name');
          setIsLoading(false);
          return;
        }
        if (zxcvbn(password).score < 3) {
          toast.error('Password is too weak (minimum score 3/4 required).');
          setIsLoading(false);
          return;
        }
        await register(email, password, name, role);
        toast.success('Registration complete! Please sign in.');
        setIsLogin(true);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Authentication failed';
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // One-Click Demo Handler
  const handleLaunchDemo = (demoRole: 'ADMIN' | 'OPERATOR' | 'REVIEWER' = 'ADMIN') => {
    loginAsDemoUser(demoRole);
    toast.success(`Launched interactive workspace as ${demoRole}!`);
    router.push('/dashboard');
  };

  // 5-Stage Cognitive Architecture Loop Steps (Clean, professional, enterprise-grade)
  const loopSteps = [
    {
      step: '01',
      title: 'Zero-Trust Ingestion',
      subtitle: 'High-Fidelity Document Perception',
      desc: 'High-resolution multi-modal parsing and automated privacy shielding protect sensitive corporate assets before document processing begins.',
      badge: 'Zero Data Exposure',
      highlight: 'Layout & Geometry Analysis',
    },
    {
      step: '02',
      title: 'Cognitive Arbitration',
      subtitle: 'Multi-Engine Consensus Circle',
      desc: 'Independent cognitive extraction and validation models cross-verify field boundaries and confidence parameters, eliminating single-model hallucinations.',
      badge: '99.8% Field Precision',
      highlight: 'Autonomous Arbitration',
    },
    {
      step: '03',
      title: 'Deterministic Audit',
      subtitle: 'Mathematical Integrity Engine',
      desc: 'Automated financial rules recompute line-item multiplications, subtotal aggregations, and tax rates to guarantee zero silent math discrepancies.',
      badge: '100% Math Catch Rate',
      highlight: 'Deterministic Equation Check',
    },
    {
      step: '04',
      title: 'Spatial Grounding',
      subtitle: 'Bidirectional Visual Provenance',
      desc: 'Every extracted key-value pair is tied directly to its physical document coordinates, enabling 1-click provenance tracing on visual documents.',
      badge: 'Interactive Visual Canvas',
      highlight: 'Coordinate Provenance',
    },
    {
      step: '05',
      title: 'Enterprise Dispatch',
      subtitle: 'Automated Reconciliation & ERP Sync',
      desc: 'Dispatches validated documents directly into QuickBooks Online, Xero, SAP S/4HANA, or downstream event streams with complete audit trails.',
      badge: 'Immediate ERP Sync',
      highlight: 'Multi-Format Export Ready',
    },
  ];

  // Infinite Marquee Data ("Scoabble" ticker items)
  const marqueeRow1 = [
    { label: 'Commercial Accounts Payable Invoices', category: 'Financial' },
    { label: 'Master Services & SaaS Agreements (MSA)', category: 'Legal' },
    { label: 'Enterprise Purchase Orders (PO)', category: 'Procurement' },
    { label: 'Warehouse Bills of Lading & Freight Waybills', category: 'Logistics' },
    { label: 'Consolidated Balance Sheets & Ledgers', category: 'Accounting' },
    { label: 'Cross-Border Customs Declarations', category: 'Compliance' },
    { label: 'Vendor Service Level Agreements (SLA)', category: 'Contracts' },
    { label: 'Corporate Tax Filings & Schedules', category: 'Regulatory' },
  ];

  const marqueeRow2 = [
    { label: '99.8% F1 Field Extraction Precision', highlight: 'Enterprise Benchmark' },
    { label: '100% Deterministic Arithmetic Verification', highlight: 'Zero Silent Math Error' },
    { label: 'Sub-500ms End-to-End Processing Latency', highlight: 'Edge Ingestion' },
    { label: 'Automated 3-Way Triplicate Matching', highlight: 'PO vs GRN vs Invoice' },
    { label: 'Bidirectional Spatial Bounding Provenance', highlight: '1-Click Audit Trace' },
    { label: 'SAP S/4HANA, QuickBooks & Xero Sync', highlight: 'Certified Integration' },
    { label: 'Pre-Inference Automated Privacy Shield', highlight: 'SOC 2 Type II' },
    { label: 'Immutable Audit Trail with SHA-256 Provenance', highlight: 'Tamper-Proof Logs' },
  ];

  // Feature Tracks (modeled after modern interactive showcase with category filtering)
  const allFeatureTracks = [
    {
      id: 'f1',
      category: 'vision',
      icon: Eye,
      title: 'Multi-Modal Spatial Perception',
      subtitle: 'Precision Visual Layout & Table Matrix Extraction',
      desc: 'Parses complex multi-column documents, nested tables, and irregular line items with pixel-perfect coordinate mapping across high-resolution files.',
      metrics: '99.8% Spatial Alignment',
      color: 'from-blue-500/20 via-blue-500/5 to-transparent border-blue-500/30 text-blue-400',
    },
    {
      id: 'f2',
      category: 'audit',
      icon: Scale,
      title: 'Multi-Engine Consensus Circle',
      subtitle: 'Autonomous Peer Arbitration Without Single-Point Hallucinations',
      desc: 'Multiple cognitive analysis models independently analyze field values and debate discrepancies, producing verified consensus confidence scores.',
      metrics: 'Zero Single-Model Hallucinations',
      color: 'from-indigo-500/20 via-indigo-500/5 to-transparent border-indigo-500/30 text-indigo-400',
    },
    {
      id: 'f3',
      category: 'audit',
      icon: ShieldCheck,
      title: 'Deterministic Math & Tax Engine',
      subtitle: '100% Verification of Equations, Multiplications & Subtotals',
      desc: 'Mathematical verification recalibrates line-item counts, unit prices, discount deductions, tax rates, and grand totals to ensure zero financial drift.',
      metrics: '100% Math Error Intercept',
      color: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30 text-emerald-400',
    },
    {
      id: 'f4',
      category: 'vision',
      icon: Compass,
      title: 'Bidirectional Visual Grounding',
      subtitle: 'Instant Interactive SVG Coordinate Provenance',
      desc: 'Every extracted key-value pair remains linked to its physical visual bounding polygon. Click any field in the UI to instantly illuminate its document source.',
      metrics: '1-Click Visual Provenance',
      color: 'from-cyan-500/20 via-cyan-500/5 to-transparent border-cyan-500/30 text-cyan-400',
    },
    {
      id: 'f5',
      category: 'reconcile',
      icon: CheckCircle2,
      title: 'Automated 3-Way Reconciliation',
      subtitle: 'Continuous Triplicate Matching for Accounts Payable',
      desc: 'Cross-checks Purchase Orders, Warehouse Receiving Notes, and Vendor Invoices before financial booking to catch overbilling and quantity discrepancies.',
      metrics: 'Zero Overbilling Risk',
      color: 'from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30 text-amber-400',
    },
    {
      id: 'f6',
      category: 'reconcile',
      icon: FileSpreadsheet,
      title: 'Universal ERP & Ledger Dispatch',
      subtitle: 'Turnkey Accounting Sync with Enterprise Workflows',
      desc: 'Export verified invoices, POs, and financial summaries directly into SAP S/4HANA, QuickBooks Online, Xero, or custom enterprise webhooks.',
      metrics: 'Instant Financial Booking',
      color: 'from-purple-500/20 via-purple-500/5 to-transparent border-purple-500/30 text-purple-400',
    },
    {
      id: 'f7',
      category: 'security',
      icon: Lock,
      title: 'Enterprise Privacy & PII Shield',
      subtitle: 'Automated Ingestion-Level Redaction and AES-256 Vault',
      desc: 'Sanitizes tax identification numbers, corporate bank details, and personal identifiers before processing. All records are isolated in tenant vaults.',
      metrics: 'SOC 2 Type II Compliant',
      color: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30 text-emerald-400',
    },
    {
      id: 'f8',
      category: 'vision',
      icon: Zap,
      title: 'Sub-500ms Edge Performance',
      subtitle: 'Real-Time Ingestion Engineered for Enterprise Scale',
      desc: 'High-throughput stream processing indexes and analyzes multi-page legal documents and financial reports in sub-second timeframes with zero UI lag.',
      metrics: '< 450ms Average Ingestion',
      color: 'from-cyan-500/20 via-cyan-500/5 to-transparent border-cyan-500/30 text-cyan-400',
    },
  ];

  const filteredFeatures = activeFeatureFilter === 'all'
    ? allFeatureTracks
    : allFeatureTracks.filter(f => f.category === activeFeatureFilter);

  const scrollFeatures = (direction: 'left' | 'right') => {
    if (featureScrollerRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      featureScrollerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Sample Simulator Datasets
  const simulatorDocs = {
    invoice: {
      title: 'Commercial Supply Invoice #INV-9042',
      category: 'INVOICE',
      status: 'AWAITING_REVIEW',
      vendor: 'Apex Logistics Global Ltd',
      amount: '$48,250.00',
      flag: 'Arithmetic Delta: Subtotal ($44,000.00) + Tax ($4,400.00) != Total ($48,250.00)',
      fields: [
        { key: 'invoice_number', val: 'INV-9042', conf: 0.99, status: 'VALID', box: { top: '15%', left: '60%', width: '30%', height: '8%' } },
        { key: 'vendor_name', val: 'Apex Logistics Global Ltd', conf: 0.98, status: 'VALID', box: { top: '12%', left: '8%', width: '40%', height: '10%' } },
        { key: 'invoice_date', val: '2026-09-15', conf: 0.96, status: 'VALID', box: { top: '25%', left: '60%', width: '30%', height: '7%' } },
        { key: 'subtotal_amount', val: '$44,000.00', conf: 0.97, status: 'VALID', box: { top: '65%', left: '55%', width: '35%', height: '7%' } },
        { key: 'tax_amount', val: '$4,400.00', conf: 0.95, status: 'VALID', box: { top: '74%', left: '55%', width: '35%', height: '7%' } },
        { key: 'total_amount', val: '$48,250.00', conf: 0.62, status: 'FLAGGED', box: { top: '83%', left: '55%', width: '35%', height: '9%' } },
      ],
      agents: {
        extractor: 'Extracted 6 key value elements and 4 line items with table geometry',
        critic: 'Verified vendor identity against corporate registry; confirmed physical address polygon',
        auditor: 'FLAGGED: $150.00 arithmetic discrepancy caught in grand total equation',
      },
      jsonPreview: {
        document_id: "doc_inv_9042",
        schema_version: "2.1.0",
        consensus_score: 0.945,
        fields: {
          invoice_number: "INV-9042",
          vendor: "Apex Logistics Global Ltd",
          subtotal: 44000.00,
          tax: 4400.00,
          total: 48250.00,
          math_discrepancy_delta: 150.00
        }
      }
    },
    contract: {
      title: 'Master Services Agreement v4.2',
      category: 'CONTRACT',
      status: 'PROCESSED',
      vendor: 'Starlight Software Systems',
      amount: 'Fixed Fee: $120,000/yr',
      flag: 'Risk Intercept: 30-Day Auto-Renewal Clause Identified (Auto-Escalated to Legal)',
      fields: [
        { key: 'agreement_type', val: 'Master Services Agreement', conf: 0.99, status: 'VALID', box: { top: '10%', left: '10%', width: '80%', height: '10%' } },
        { key: 'effective_date', val: '2026-10-01', conf: 0.97, status: 'VALID', box: { top: '24%', left: '10%', width: '40%', height: '8%' } },
        { key: 'term_length', val: '24 Months', conf: 0.94, status: 'VALID', box: { top: '34%', left: '10%', width: '40%', height: '8%' } },
        { key: 'governing_law', val: 'State of Delaware', conf: 0.96, status: 'VALID', box: { top: '48%', left: '10%', width: '45%', height: '8%' } },
        { key: 'liability_cap', val: '12 Months Fees Paid', conf: 0.88, status: 'VALID', box: { top: '60%', left: '10%', width: '50%', height: '8%' } },
        { key: 'auto_renewal', val: '30-Day Notice Required', conf: 0.72, status: 'FLAGGED', box: { top: '72%', left: '10%', width: '80%', height: '10%' } },
      ],
      agents: {
        extractor: 'Segmented 18 distinct legal clauses across multi-page document structure',
        critic: 'Matched standard confidentiality, indemnification, and jurisdiction bounds',
        auditor: 'Flagged opt-out notice window for legal counsel sign-off',
      },
      jsonPreview: {
        document_id: "doc_msa_42",
        category: "LEGAL_CONTRACT",
        governing_law: "State of Delaware",
        clauses_extracted: 18,
        risk_flags: ["AUTO_RENEWAL_30_DAYS"]
      }
    },
    po: {
      title: 'Purchase Order #PO-88210',
      category: 'PURCHASE_ORDER',
      status: 'PROCESSED',
      vendor: 'OmniCorp Industrial Hardware',
      amount: '$14,800.00',
      flag: '3-Way Match Verified: Matches Delivery Receipt #DR-3310 and Vendor Quote',
      fields: [
        { key: 'po_number', val: 'PO-88210', conf: 0.99, status: 'VALID', box: { top: '14%', left: '55%', width: '35%', height: '8%' } },
        { key: 'authorized_by', val: 'Sarah Jenkins (VP Ops)', conf: 0.96, status: 'VALID', box: { top: '24%', left: '10%', width: '40%', height: '8%' } },
        { key: 'delivery_date', val: '2026-09-28', conf: 0.95, status: 'VALID', box: { top: '34%', left: '55%', width: '35%', height: '8%' } },
        { key: 'cost_center', val: 'CC-ENG-402', conf: 0.93, status: 'VALID', box: { top: '44%', left: '10%', width: '35%', height: '8%' } },
        { key: 'reconciliation_status', val: '100% Matched', conf: 0.99, status: 'VALID', box: { top: '75%', left: '10%', width: '80%', height: '10%' } },
      ],
      agents: {
        extractor: 'Parsed itemized SKUs, quantity lines, and unit pricing table',
        critic: 'Confirmed authorized approval signature, cost center, and tax ID',
        auditor: 'Reconciled 100% against ERP database inventory receipt logs',
      },
      jsonPreview: {
        document_id: "doc_po_88210",
        po_number: "PO-88210",
        three_way_match: true,
        quantity_variance: 0.0,
        price_variance: 0.0,
        status: "APPROVED_FOR_PAYMENT"
      }
    }
  };

  const activeDoc = simulatorDocs[activeDocTab];

  // Calculated ROI Metrics
  const hoursSaved = Math.round((monthlyVolume * 5) / 60);
  const costSavings = Math.round(hoursSaved * 45);

  return (
    <div className="relative min-h-screen bg-[#06090f] text-foreground font-sans selection:bg-primary/25 overflow-x-hidden bg-grid-pattern">
      
      {/* ── TOP SCROLL PROGRESS BAR ─────────────────────────────────────────── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 z-50 origin-left"
        style={{ scaleX }}
      />

      {/* ── TOP ENTERPRISE NAVBAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#06090f]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <BrandLogo size="md" />
            <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-neutral-400">
              <a href="#showcase" className="hover:text-foreground transition-colors">Showcase</a>
              <a href="#features" className="hover:text-foreground transition-colors">Capabilities</a>
              <a href="#pipeline" className="hover:text-foreground transition-colors">Cognitive Flow</a>
              <a href="#simulator" className="hover:text-foreground transition-colors">Audit Simulator</a>
              <a href="#reconciliation" className="hover:text-foreground transition-colors">3-Way Match</a>
              <a href="#roi" className="hover:text-foreground transition-colors">ROI Calculator</a>
              <a href="#security" className="hover:text-foreground transition-colors">Security</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLaunchDemo('ADMIN')}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-all duration-200 cursor-pointer shadow-sm shadow-primary/5 touch-press"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Launch Live Sandbox</span>
            </button>
            <a
              href="#auth-card"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-all duration-200 cursor-pointer shadow-md shadow-primary/25 touch-press"
            >
              <span>{user || isAuthenticated ? 'Open Workspace' : 'Sign In'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero Left: Value Prop */}
          <div className="lg:col-span-7 flex flex-col gap-6 text-center lg:text-left">
            <div className="inline-flex self-center lg:self-start items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs text-primary font-medium tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 pulse-dot" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span>Next-Generation Enterprise Document Automation</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-white">
              Enterprise Document Automation <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
                Engineered for Absolute Precision
              </span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              DocIntel AI converts unstructured commercial invoices, high-stakes contracts, and purchase orders into deterministic, audit-ready structured data. Multi-engine cognitive validation cross-verifies financial calculations, enforces provenance, and guarantees zero silent math errors.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={() => handleLaunchDemo('ADMIN')}
                className="group flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold tracking-wide shadow-lg shadow-primary/25 hover:shadow-primary/35 transition-all duration-200 cursor-pointer touch-press animate-shimmer"
              >
                <span>Launch Interactive Sandbox</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <a
                href="#showcase"
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] text-sm font-semibold text-neutral-200 hover:text-white transition-all duration-200 touch-press"
              >
                <Compass className="h-4 w-4 text-cyan-400" />
                <span>Explore Live Features</span>
              </a>
            </div>

            {/* Trust Signals */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/[0.06] text-left">
              <div>
                <div className="text-2xl font-bold font-mono text-white tracking-tight">99.8%</div>
                <div className="text-xs text-muted-foreground mt-0.5">Extraction Precision</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-white tracking-tight">&lt; 450ms</div>
                <div className="text-xs text-muted-foreground mt-0.5">Average Ingestion Speed</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-white tracking-tight">100%</div>
                <div className="text-xs text-muted-foreground mt-0.5">Math Discrepancies Caught</div>
              </div>
            </div>
          </div>

          {/* Hero Right: Clean Authentication Console Card */}
          <div id="auth-card" className="lg:col-span-5 w-full flex justify-center scroll-mt-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-[440px] glass-card p-6 sm:p-8 relative glow-blue"
            >
              {user || isAuthenticated ? (
                <div className="flex flex-col gap-6 text-center py-6 select-none">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/20">
                      {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Welcome Back</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Active session: <span className="font-semibold text-neutral-200">{user?.full_name || 'Enterprise Auditor'}</span>
                    </p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                      Role: {user?.role || 'ADMIN'}
                    </span>
                  </div>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold tracking-wide transition-all cursor-pointer shadow-md touch-press"
                  >
                    <span>Enter Console Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Segmented Auth Mode Switch */}
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-black/40 border border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setIsLogin(true)}
                      className={clsx(
                        "py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer touch-press",
                        isLogin ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLogin(false)}
                      className={clsx(
                        "py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer touch-press",
                        !isLogin ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Create Account
                    </button>
                  </div>

                  <div className="text-center">
                    <h2 className="text-base font-bold text-white">
                      {isLogin ? 'Access Your Enterprise Workspace' : 'Set Up Auditor Account'}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isLogin ? 'Enter your enterprise credentials' : 'Configure role parameters and credentials'}
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {!isLogin && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase font-mono">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Alex Vance"
                          className="w-full bg-[#0c121e] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-neutral-600 focus:outline-none focus:border-primary/60 transition-colors"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase font-mono">
                        Work Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="auditor@organization.com"
                        className="w-full bg-[#0c121e] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-neutral-600 focus:outline-none focus:border-primary/60 transition-colors"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase font-mono">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-[#0c121e] border border-white/[0.08] rounded-xl px-3.5 py-2.5 pr-10 text-xs text-foreground placeholder:text-neutral-600 focus:outline-none focus:border-primary/60 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {!isLogin && <PasswordStrengthMeter password={password} />}
                    </div>

                    {!isLogin && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase font-mono">
                          Workspace Role
                        </label>
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="w-full bg-[#0c121e] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/60 transition-colors cursor-pointer"
                        >
                          <option value="OPERATOR">Operator (Upload & Extract)</option>
                          <option value="REVIEWER">Reviewer (Audit & Approve)</option>
                          <option value="ADMIN">Administrator (Full Privileges)</option>
                        </select>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex items-center justify-center gap-2 mt-2 w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary-hover text-white transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50 touch-press"
                    >
                      <span>{isLogin ? 'Authenticate & Enter' : 'Create Workspace Account'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </form>

                  {/* One-Click Demo Button */}
                  <div className="flex flex-col gap-3 pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => handleLaunchDemo('ADMIN')}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-all cursor-pointer touch-press"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Instant Sandbox Demo (No Registration)</span>
                    </button>

                    <p className="text-[11px] text-center text-muted-foreground">
                      SOC-2 Type II Certified · Immutable Audit Trail Active
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── THE INFINITE MARQUEE SHOWCASE ("SCOABBLE") ─────────────────────── */}
      <section id="showcase" className="border-y border-white/[0.06] bg-[#070b14]/90 py-8 overflow-hidden select-none relative">
        {/* Glow Gradients on Sides */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#06090f] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#06090f] to-transparent z-10 pointer-events-none" />

        <div className="flex flex-col gap-4">
          {/* Row 1: Leftward Ticker */}
          <div className="animate-marquee pause-hover flex items-center gap-4">
            {[...marqueeRow1, ...marqueeRow1].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-primary/40 transition-all cursor-default text-xs font-sans shrink-0 backdrop-blur-sm"
              >
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-neutral-200">{item.label}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {item.category}
                </span>
              </div>
            ))}
          </div>

          {/* Row 2: Rightward Reverse Ticker */}
          <div className="animate-marquee-reverse pause-hover flex items-center gap-4">
            {[...marqueeRow2, ...marqueeRow2].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-cyan-400/40 transition-all cursor-default text-xs font-sans shrink-0 backdrop-blur-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="font-semibold text-neutral-200">{item.label}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {item.highlight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE FEATURE TRACK SCROLLER (Modeled after awsclubgeu.in) ─── */}
      <section id="features" className="py-24 border-b border-white/[0.06] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold uppercase tracking-wider mb-3">
              <Layers className="h-3.5 w-3.5" />
              <span>Platform Capabilities</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Interactive Intelligence Tracks
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Explore specialized document intelligence capabilities built to handle complex tables, financial calculations, and compliance standards.
            </p>
          </div>

          {/* Category Filter Pills & Controls */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#090d18] border border-white/[0.06]">
              {[
                { id: 'all', label: 'All' },
                { id: 'vision', label: 'Vision' },
                { id: 'audit', label: 'Auditing' },
                { id: 'reconcile', label: 'Reconciliation' },
                { id: 'security', label: 'Security' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeatureFilter(tab.id as any)}
                  className={clsx(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer touch-press",
                    activeFeatureFilter === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Prev/Next arrows */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                onClick={() => scrollFeatures('left')}
                className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-neutral-300 hover:text-white transition-all cursor-pointer touch-press"
                title="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => scrollFeatures('right')}
                className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-neutral-300 hover:text-white transition-all cursor-pointer touch-press"
                title="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Scrollable Feature Card Container */}
        <div
          ref={featureScrollerRef}
          className="flex gap-6 overflow-x-auto pb-6 scrollbar snap-x snap-mandatory"
        >
          {filteredFeatures.map((track) => {
            const Icon = track.icon;
            return (
              <motion.div
                key={track.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className={clsx(
                  "min-w-[320px] sm:min-w-[360px] max-w-[380px] p-6 rounded-2xl border bg-gradient-to-b flex flex-col justify-between gap-6 snap-start transition-all duration-300 transform hover:-translate-y-1.5 shadow-xl select-none group touch-press",
                  track.color
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 font-bold uppercase tracking-wider">
                    {track.metrics}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors">
                    {track.title}
                  </h3>
                  <p className="text-xs font-mono text-neutral-400 mt-1">
                    {track.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                    {track.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <span className="font-mono text-[11px] text-muted-foreground">Ready for Production</span>
                  <button
                    onClick={() => handleLaunchDemo('ADMIN')}
                    className="flex items-center gap-1 text-primary hover:underline cursor-pointer group-hover:translate-x-1 transition-transform"
                  >
                    <span>Test In Sandbox</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── THE COGNITIVE FLOW LOOP (5-STAGE PIPELINE) ────────────────────────── */}
      <section id="pipeline" className="py-24 border-b border-white/[0.06] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <Network className="h-3.5 w-3.5" />
            <span>The Enterprise Processing Loop</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How Documents Travel from Ingestion to Reconciled ERP
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            An orchestrated multi-stage lifecycle separating layout parsing from cognitive critique, mathematical verification, and enterprise dispatch.
          </p>
        </div>

        {/* 5-Step Visual Pipeline Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {loopSteps.map((step, idx) => (
            <button
              key={step.step}
              onClick={() => setActiveLoopStep(idx)}
              className={clsx(
                "p-4 rounded-2xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[120px] relative overflow-hidden touch-press",
                activeLoopStep === idx
                  ? "bg-primary/10 border-primary shadow-lg shadow-primary/20 glow-blue"
                  : "bg-[#0c121e]/80 border-white/[0.06] hover:border-white/[0.15] hover:bg-[#101726]"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={clsx(
                  "font-mono font-bold text-xs px-2 py-0.5 rounded",
                  activeLoopStep === idx ? "bg-primary text-white" : "bg-white/[0.05] text-neutral-400"
                )}>
                  {step.step}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{step.highlight}</span>
              </div>
              <div className="mt-3">
                <h4 className="text-xs font-bold text-white">{step.title}</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{step.subtitle}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Active Step Deep-Dive Card */}
        <div className="glass-card p-8 rounded-3xl border border-white/[0.08] shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-primary/20 text-primary border border-primary/30">
                  STAGE {loopSteps[activeLoopStep].step} OF 05
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {loopSteps[activeLoopStep].badge}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white">
                {loopSteps[activeLoopStep].title}: {loopSteps[activeLoopStep].subtitle}
              </h3>
              <p className="text-sm text-neutral-300 leading-relaxed max-w-3xl">
                {loopSteps[activeLoopStep].desc}
              </p>
              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={() => handleLaunchDemo('ADMIN')}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 touch-press"
                >
                  <span>Test in Interactive Sandbox</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setActiveLoopStep((prev) => (prev + 1) % loopSteps.length)}
                  className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer touch-press"
                >
                  Next Stage ({activeLoopStep + 1}/5)
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 p-5 rounded-2xl bg-[#090d18] border border-white/[0.06] font-mono text-xs flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 text-neutral-400 text-[11px]">
                <span>Stage Telemetry</span>
                <span className="text-emerald-400">Live Active</span>
              </div>
              <div className="flex justify-between py-1 text-neutral-300">
                <span className="text-neutral-500">Execution Mode:</span>
                <span>Deterministic</span>
              </div>
              <div className="flex justify-between py-1 text-neutral-300">
                <span className="text-neutral-500">Confidence Gate:</span>
                <span>&gt;= 85.0%</span>
              </div>
              <div className="flex justify-between py-1 text-neutral-300">
                <span className="text-neutral-500">Audit Provenance:</span>
                <span>SHA-256 Logged</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE DOCUMENT AUDIT SIMULATOR ──────────────────────────────── */}
      <section id="simulator" className="py-24 border-b border-white/[0.06] bg-[#070b14]/80 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Live Interactive Simulator</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Test Real Commercial Invoices & MSA Contracts
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Click through documents to see how cognitive validation and audit engines identify arithmetic errors, auto-renewal risks, and reconciliation states.
            </p>
          </div>

          {/* Simulator Document Switcher Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            {[
              { id: 'invoice', label: 'Commercial Invoice (Arithmetic Discrepancy)', icon: DollarSign },
              { id: 'contract', label: 'MSA Contract (Auto-Renewal Legal Risk)', icon: FileText },
              { id: 'po', label: 'Purchase Order (3-Way Matched)', icon: FileCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeDocTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDocTab(tab.id as any)}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border touch-press",
                    isActive
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 glow-blue"
                      : "bg-[#0c121e] text-muted-foreground hover:text-white border-white/[0.06] hover:border-white/[0.12]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Simulator Console Container */}
          <div className="glass-card overflow-hidden border border-white/[0.08] shadow-2xl rounded-3xl">
            {/* Header Bar with View Mode Toggle */}
            <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="h-4.5 w-4.5 text-primary" />
                <span className="text-sm font-bold text-white">{activeDoc.title}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {activeDoc.category}
                </span>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#090d18] border border-white/[0.08]">
                {[
                  { id: 'fields', label: 'Field Inspector' },
                  { id: 'json', label: 'Universal JSON' },
                  { id: 'erp', label: 'ERP Schema' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSimulatorViewMode(mode.id as any)}
                    className={clsx(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer touch-press",
                      simulatorViewMode === mode.id
                        ? "bg-primary text-white font-bold"
                        : "text-neutral-400 hover:text-white"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Discrepancy Alert Banner */}
            <div className="px-6 py-3.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs font-medium text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{activeDoc.flag}</span>
              </div>
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Audit Intercepted
              </span>
            </div>

            {/* Main Interactive Workspace Area */}
            {simulatorViewMode === 'fields' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
                
                {/* Left Column: Simulated Spatial Grounding Sheet */}
                <div className="lg:col-span-6 p-6 bg-[#080b12] flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground uppercase">Simulated Document Canvas</span>
                    <span className="text-[11px] font-mono text-cyan-400">Hover fields to highlight bounding coordinates</span>
                  </div>

                  <div className="relative w-full h-[340px] rounded-2xl bg-[#0c101a] border border-white/[0.08] p-6 overflow-hidden flex flex-col justify-between">
                    {/* Simulated Document Header */}
                    <div className="flex justify-between items-start border-b border-white/[0.06] pb-4">
                      <div>
                        <div className="h-4 w-32 bg-white/20 rounded mb-2" />
                        <div className="h-3 w-48 bg-white/10 rounded" />
                      </div>
                      <div className="text-right font-mono text-xs text-neutral-400">
                        <div>{activeDoc.vendor}</div>
                        <div className="text-[10px] text-neutral-500 mt-1">{activeDoc.title}</div>
                      </div>
                    </div>

                    {/* Simulated Interactive Bounding Boxes */}
                    <div className="relative flex-1 my-4">
                      {activeDoc.fields.map((field) => {
                        const isHovered = activeHoverField === field.key;
                        const isFlagged = field.status === 'FLAGGED';
                        return (
                          <div
                            key={field.key}
                            style={field.box as any}
                            onMouseEnter={() => setActiveHoverField(field.key)}
                            onMouseLeave={() => setActiveHoverField(null)}
                            className={clsx(
                              "absolute rounded-lg border-2 transition-all duration-200 cursor-pointer flex items-center px-2",
                              isFlagged
                                ? "border-amber-400 bg-amber-400/20"
                                : isHovered
                                ? "border-primary bg-primary/25 shadow-lg shadow-primary/30 scale-105"
                                : "border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-400"
                            )}
                          >
                            <span className="text-[10px] font-mono font-bold text-white truncate">
                              {field.val}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-right text-[10px] font-mono text-neutral-500 border-t border-white/[0.06] pt-2">
                      Page 1 of 1 • Provenance Grounding Active
                    </div>
                  </div>
                </div>

                {/* Right Column: Extracted Values & Multi-Agent Debate */}
                <div className="lg:col-span-6 p-6 flex flex-col gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                        Extracted Fields &amp; Confidence
                      </h4>
                      <span className="text-[11px] font-mono text-neutral-400">Consensus Threshold: 85%</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeDoc.fields.map((field, idx) => {
                        const isHovered = activeHoverField === field.key;
                        const isFlagged = field.status === 'FLAGGED';
                        return (
                          <div
                            key={idx}
                            onMouseEnter={() => setActiveHoverField(field.key)}
                            onMouseLeave={() => setActiveHoverField(null)}
                            className={clsx(
                              "p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 touch-press",
                              isFlagged
                                ? "border-amber-500/50 bg-amber-500/10"
                                : isHovered
                                ? "border-primary bg-primary/10 scale-102"
                                : "border-white/[0.06] bg-[#090d18] hover:border-white/[0.12]"
                            )}
                          >
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-neutral-400">{field.key}</span>
                              <span
                                className={clsx(
                                  "font-bold",
                                  isFlagged ? "text-amber-400" : "text-emerald-400"
                                )}
                              >
                                {(field.conf * 100).toFixed(0)}%
                              </span>
                            </div>
                            <span className="text-xs font-bold text-white font-mono truncate">
                              {field.val}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Multi-Engine Validation Log */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-3">
                      Cognitive Verification Audit Log
                    </h4>

                    <div className="flex flex-col gap-2.5 text-xs">
                      <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col gap-0.5">
                        <span className="font-mono font-bold text-blue-400 text-[10px] uppercase">
                          Stage 1: Semantic Perception
                        </span>
                        <p className="text-neutral-300 text-[11px]">{activeDoc.agents.extractor}</p>
                      </div>

                      <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col gap-0.5">
                        <span className="font-mono font-bold text-indigo-400 text-[10px] uppercase">
                          Stage 2: Validation &amp; Cross-Check
                        </span>
                        <p className="text-neutral-300 text-[11px]">{activeDoc.agents.critic}</p>
                      </div>

                      <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col gap-0.5">
                        <span className="font-mono font-bold text-amber-400 text-[10px] uppercase">
                          Stage 3: Mathematical Integrity Audit
                        </span>
                        <p className="text-neutral-300 text-[11px]">{activeDoc.agents.auditor}</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ) : simulatorViewMode === 'json' ? (
              <div className="p-6 font-mono text-xs bg-[#070b14] overflow-x-auto">
                <pre className="text-cyan-300 leading-relaxed">
                  {JSON.stringify(activeDoc.jsonPreview, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="p-6 font-mono text-xs bg-[#070b14] flex flex-col gap-3">
                <span className="text-neutral-400 text-[11px]">ERP Integration Ready Output (Xero ACCPAY / SAP S/4HANA / QuickBooks):</span>
                <pre className="p-4 rounded-xl bg-black/40 border border-white/[0.06] text-emerald-400 overflow-x-auto leading-relaxed">
{`<Invoice>
  <InvoiceNumber>${activeDoc.fields[0]?.val}</InvoiceNumber>
  <Contact><Name>${activeDoc.vendor}</Name></Contact>
  <AmountTotal>${activeDoc.amount}</AmountTotal>
  <Status>AWAITING_PAYMENT_APPROVAL</Status>
  <AuditedBy>DocIntel Consensus Engine v2.4</AuditedBy>
</Invoice>`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 3-WAY RECONCILIATION SHOWCASE ─────────────────────────────────────── */}
      <section id="reconciliation" className="py-24 border-b border-white/[0.06] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Financial Governance</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Automated 3-Way Triplicate Matching
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            Guarantee accounts payable precision by cross-reconciling Purchase Orders against Goods Receipts and Vendor Invoices before booking.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Node 1: Purchase Order */}
          <div className="glass-card p-6 flex flex-col gap-4 border-t-2 border-t-blue-500 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-blue-400 uppercase">Step 1: Authorization</span>
              <span className="text-[10px] font-mono text-muted-foreground">PO-2026-441</span>
            </div>
            <h4 className="text-base font-bold text-white">Purchase Order</h4>
            <div className="flex flex-col gap-2 font-mono text-xs text-neutral-300">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-muted-foreground">Qty:</span>
                <span>500 Units</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-muted-foreground">Unit Price:</span>
                <span>$24.90</span>
              </div>
              <div className="flex justify-between py-1 font-bold text-white">
                <span className="text-muted-foreground">Authorized Total:</span>
                <span>$12,450.00</span>
              </div>
            </div>
            <div className="mt-auto pt-2 flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>ERP Approved Baseline</span>
            </div>
          </div>

          {/* Node 2: Receiving Slip */}
          <div className="glass-card p-6 flex flex-col gap-4 border-t-2 border-t-emerald-500 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Step 2: Receiving</span>
              <span className="text-[10px] font-mono text-muted-foreground">GRN-1904</span>
            </div>
            <h4 className="text-base font-bold text-white">Warehouse Receiving Slip</h4>
            <div className="flex flex-col gap-2 font-mono text-xs text-neutral-300">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-muted-foreground">Received Qty:</span>
                <span>500 Units (100% Intact)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-muted-foreground">Dock Timestamp:</span>
                <span>Sept 18, 08:30 AM</span>
              </div>
              <div className="flex justify-between py-1 font-bold text-white">
                <span className="text-muted-foreground">Physical Match:</span>
                <span className="text-emerald-400">0% Variance</span>
              </div>
            </div>
            <div className="mt-auto pt-2 flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Inspection Verified</span>
            </div>
          </div>

          {/* Node 3: Vendor Invoice */}
          <div className="glass-card p-6 flex flex-col gap-4 border-t-2 border-t-amber-500 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase">Step 3: Billing</span>
              <span className="text-[10px] font-mono text-muted-foreground">INV-8820</span>
            </div>
            <h4 className="text-base font-bold text-white">Vendor Invoice</h4>
            <div className="flex flex-col gap-2 font-mono text-xs text-neutral-300">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-muted-foreground">Qty Invoiced:</span>
                <span>500 Units</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-muted-foreground">Unit Price:</span>
                <span className="text-amber-400 font-bold">$26.40 (+6.0%)</span>
              </div>
              <div className="flex justify-between py-1 font-bold text-amber-400">
                <span className="text-muted-foreground">Invoiced Total:</span>
                <span>$13,200.00</span>
              </div>
            </div>
            <div className="mt-auto pt-2 flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Variance Flag: +$750.00 Delta</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE OPERATIONAL ROI CALCULATOR ────────────────────────────── */}
      <section id="roi" className="py-24 border-b border-white/[0.06] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
        <div className="glass-card p-8 sm:p-12 border border-white/[0.08] shadow-2xl rounded-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div>
                <span className="text-xs font-mono font-bold text-primary uppercase">Financial Impact Simulator</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  Calculate Your Operational ROI
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  See the exact analyst hours recovered and audit expenses saved by replacing manual data entry with cognitive validation.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-neutral-300">Monthly Document Processing Volume:</span>
                  <span className="font-mono text-primary font-bold text-sm">
                    {monthlyVolume.toLocaleString()} documents / mo
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="25000"
                  step="500"
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>500 docs</span>
                  <span>10,000 docs</span>
                  <span>25,000 docs</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.06] flex flex-col gap-1">
                <span className="text-[11px] font-mono uppercase text-muted-foreground">Analyst Hours Saved</span>
                <span className="text-3xl sm:text-4xl font-bold font-mono text-emerald-400">
                  {hoursSaved.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1">hours / month</span>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.06] flex flex-col gap-1">
                <span className="text-[11px] font-mono uppercase text-muted-foreground">Monthly Cost Recovery</span>
                <span className="text-3xl sm:text-4xl font-bold font-mono text-primary">
                  ${costSavings.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1">estimated monthly savings</span>
              </div>

              <div className="col-span-2 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Ready to automate your document processing?
                </span>
                <button
                  onClick={() => handleLaunchDemo('ADMIN')}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer shadow-md touch-press"
                >
                  Launch Demo Now
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── ENTERPRISE SECURITY & COMPLIANCE ──────────────────────────────────── */}
      <section id="security" className="py-24 border-b border-white/[0.06] bg-[#070b14]/60 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
              <Lock className="h-3.5 w-3.5" />
              <span>Security &amp; Privacy Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Enterprise Data Protection by Default
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Your sensitive financial and legal records remain private, encrypted, and isolated with zero cross-tenant leakage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Lock,
                title: 'AES-256 & TLS 1.3',
                desc: 'All documents, vector embeddings, and database tables are encrypted at rest and in transit via TLS 1.3.'
              },
              {
                icon: ShieldCheck,
                title: 'Immutable Audit Trail',
                desc: 'Every human override, validation disagreement, and status change is immutably logged with SHA-256 provenance.'
              },
              {
                icon: Building2,
                title: 'Multi-Tenant Isolation',
                desc: 'Organization-level tenant isolation ensures zero cross-organization leakage across vector or relational stores.'
              },
              {
                icon: Zap,
                title: 'VPC & Air-Gapped Ready',
                desc: 'Deploy on dedicated Kubernetes clusters, GovCloud, or air-gapped private data centers with zero external calls.'
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} className="glass-card p-6 flex flex-col gap-3 rounded-2xl hover:border-primary/30 transition-all duration-300">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-bold text-white mt-1">{card.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ENTERPRISE FOOTER ─────────────────────────────────────────────────── */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-[#04060b]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <BrandLogo size="sm" />
            <span className="text-neutral-600">|</span>
            <span>© 2026 DocIntel AI Technologies. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#showcase" className="hover:text-foreground transition-colors">Showcase</a>
            <a href="#features" className="hover:text-foreground transition-colors">Capabilities</a>
            <a href="#pipeline" className="hover:text-foreground transition-colors">Cognitive Flow</a>
            <a href="#simulator" className="hover:text-foreground transition-colors">Audit Simulator</a>
            <a href="#reconciliation" className="hover:text-foreground transition-colors">3-Way Match</a>
            <a href="#security" className="hover:text-foreground transition-colors">Security</a>
            <button
              onClick={() => handleLaunchDemo('OPERATOR')}
              className="text-primary hover:underline cursor-pointer font-semibold"
            >
              Demo Sandbox
            </button>
          </div>
        </div>
      </footer>

      {/* ── FLOATING BACK-TO-TOP & SANDBOX ISLAND ────────────────────────────── */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-1.5 rounded-2xl bg-[#0b101c]/90 border border-white/10 shadow-2xl backdrop-blur-xl"
          >
            <button
              onClick={() => handleLaunchDemo('ADMIN')}
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm touch-press"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Launch Sandbox</span>
            </button>
            <button
              onClick={scrollToTop}
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 hover:text-white transition-all cursor-pointer touch-press"
              title="Scroll to top"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
