'use client';

import React, { useState } from 'react';
import {
  Check,
  Zap,
  Building2,
  Rocket,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Lock,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'react-hot-toast';

const plans = [
  {
    id: 'developer',
    name: 'Developer',
    badge: 'API & Sandbox',
    description: 'For engineers & ML teams requiring deterministic math and spatial OCR extraction.',
    price: {
      monthly: 99,
      annual: 79,
    },
    payAsYouGo: '$0.08 per document overage',
    features: [
      'Up to 1,500 documents / month',
      '7-agent consensus arbitration core',
      'Python SDK & REST API streaming',
      '1000 × 1000 coordinate spatial grounding',
      'Deterministic decimal math audit',
      'Neon PostgreSQL dedicated schema',
    ],
    cta: 'Start 14-Day Free Trial',
    popular: false,
    icon: Zap,
    glow: 'from-blue-500/20 via-transparent to-transparent',
  },
  {
    id: 'business',
    name: 'Business Pro',
    badge: 'Most Popular',
    description: 'For growing finance and compliance teams automating invoices, POs, and contracts.',
    price: {
      monthly: 399,
      annual: 319,
    },
    payAsYouGo: '$0.05 per document overage',
    features: [
      'Up to 15,000 documents / month',
      'Priority multi-engine routing (Groq + Gemini)',
      '1-Click ERP dispatch (SAP, NetSuite, QBO)',
      'Human-in-the-loop audit workspace',
      'Role-based access & SSO integration',
      'Real-time spend anomaly & tax variance alerts',
      '24/7 Priority SLA & Dedicated Slack channel',
    ],
    cta: 'Start 14-Day Free Trial',
    popular: true,
    icon: Building2,
    glow: 'from-blue-500/30 via-indigo-500/10 to-transparent',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Sovereign',
    badge: 'Custom Deployment',
    description: 'For multinational enterprises with air-gapped security and bespoke compliance SLAs.',
    price: {
      monthly: null,
      annual: null,
    },
    customPricing: true,
    payAsYouGo: 'Volume tiered enterprise pricing',
    features: [
      'Unlimited documents & historical archive',
      'Self-hosted VPC or On-Premise deployment',
      'Custom fine-tuned consensus agents',
      'SOC 2 Type II & HIPAA certified compliance',
      'Dedicated Customer Success Architect',
      'Cryptographic tamper-proof audit receipts',
      '99.99% Guaranteed uptime SLA',
    ],
    cta: 'Contact Sovereign Sales',
    popular: false,
    icon: Rocket,
    glow: 'from-purple-500/20 via-transparent to-transparent',
  },
];

const faqs = [
  {
    question: 'How does Quorum guarantee zero financial hallucination?',
    answer: 'Standard LLMs approximate mathematical tokens. Quorum uses a 7-agent consensus pipeline combined with deterministic Python decimal arithmetic engines to recalculate line items, subtotals, and taxes down to Δ == $0.00.',
  },
  {
    question: 'What file formats and layout structures are supported?',
    answer: 'Quorum processes native PDFs, scanned raster documents (PNG, JPG, TIFF), complex multi-page financial statements, tables, and handwritten signatures with 1000 × 1000 spatial coordinate grounding.',
  },
  {
    question: 'Can I integrate Quorum directly into my existing ERP or accounting system?',
    answer: 'Yes. Quorum provides native certified export targets for SAP S/4HANA, Oracle NetSuite, QuickBooks Online, and universal double-entry JSON/CSV schemas.',
  },
  {
    question: 'Is my financial and corporate data private and secure?',
    answer: 'Absolutely. We enforce a clean-slate architecture isolated by tenant in Neon PostgreSQL. We never train public models on customer documents, and all data is encrypted at rest (AES-256) and in transit (TLS 1.3).',
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[0] | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const { user, loginAsDemoUser } = useAuthStore();

  const handleSelectPlan = (plan: typeof plans[0]) => {
    setSelectedPlan(plan);
    setShowCheckoutModal(true);
  };

  const handleConfirmSubscription = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setShowCheckoutModal(false);
      if (!user) {
        loginAsDemoUser('ADMIN');
      }
      toast.success(`Welcome to Quorum ${selectedPlan?.name}! Clean workspace active.`);
      router.push('/dashboard');
    }, 900);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-x-hidden antialiased">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </Link>
            <div className="h-4 w-[1px] bg-white/10" />
            <BrandLogo size="sm" />
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-zinc-200 hover:text-white border border-white/10 transition-all cursor-pointer"
            >
              <span>Workspace</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] text-zinc-300 font-medium tracking-wide mb-6 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Transparent Enterprise Pricing — Zero Hidden Overage Fees</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.1] text-white max-w-3xl mx-auto">
          Predictable investment. <br />
          <span className="text-zinc-400">Mathematical certainty.</span>
        </h1>

        <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto font-light leading-relaxed">
          Every plan includes our 7-agent consensus pipeline, spatial coordinate verification, and 1-click ERP integration.
        </p>

        {/* Apple-Style Billing Switcher */}
        <div className="inline-flex items-center gap-2 mt-8 p-1 bg-white/[0.04] border border-white/10 rounded-full backdrop-blur-xl">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={clsx(
              'px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer',
              billingCycle === 'monthly'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={clsx(
              'px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5',
              billingCycle === 'annual'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <span>Annual Billing</span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold rounded-full font-mono">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, idx) => {
            const Icon = plan.icon;
            const price = plan.customPricing
              ? null
              : billingCycle === 'monthly'
              ? plan.price.monthly
              : plan.price.annual;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className={clsx(
                  'relative rounded-3xl p-7 flex flex-col justify-between transition-all duration-300 backdrop-blur-2xl select-none',
                  plan.popular
                    ? 'bg-[#101015]/95 border-2 border-blue-500/60 shadow-[0_0_40px_rgba(59,130,246,0.15)]'
                    : 'bg-[#0d0d11]/90 border border-white/[0.08] hover:border-white/20'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-semibold tracking-wider uppercase shadow-md">
                    Recommended Choice
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 border border-white/5">
                      {plan.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-white tracking-tight">{plan.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1.5 font-light leading-relaxed min-h-[36px]">
                    {plan.description}
                  </p>

                  <div className="my-6 pt-5 border-t border-white/5">
                    {plan.customPricing ? (
                      <div>
                        <div className="text-3xl font-semibold text-white font-mono">Custom</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">Tailored to enterprise SLA</div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-semibold text-white font-mono">${price}</span>
                          <span className="text-xs text-zinc-400">/ month</span>
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono mt-1">
                          {billingCycle === 'annual' ? `Billed annually ($${price! * 12}/yr)` : 'Billed monthly'}
                        </div>
                      </div>
                    )}
                    <div className="text-[11px] text-zinc-500 mt-2 font-mono">{plan.payAsYouGo}</div>
                  </div>

                  <div className="space-y-2.5 mb-8">
                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Included Capabilities:
                    </div>
                    {plan.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs text-zinc-300 font-light">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={clsx(
                    'w-full py-3 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-lg',
                    plan.popular
                      ? 'bg-white text-black hover:bg-zinc-200'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10'
                  )}
                >
                  <span>{plan.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Enterprise Security Banner */}
        <div className="mt-16 p-8 rounded-3xl bg-zinc-950/70 border border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-white">Sovereign Enterprise & On-Premise Requirements?</h4>
              <p className="text-xs text-zinc-400 font-light mt-0.5">
                We support private cloud deployment (AWS, GCP, Azure, Sovereign Enclaves) with dedicated GPU routing.
              </p>
            </div>
          </div>
          <button
            onClick={() => handleSelectPlan(plans[2])}
            className="shrink-0 px-5 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white border border-white/10 transition-all cursor-pointer"
          >
            Talk to Solutions Architect
          </button>
        </div>

        {/* FAQ Accordion Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
              Frequently Asked Questions
            </span>
            <h3 className="text-2xl font-semibold text-white mt-1">Everything You Need to Know</h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-zinc-950/60 border border-white/[0.06] hover:border-white/15 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-sm font-medium text-white">
                  <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{faq.question}</span>
                </div>
                <p className="mt-2.5 text-xs text-zinc-400 pl-6.5 font-light leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Checkout / Confirmation Modal */}
      <AnimatePresence>
        {showCheckoutModal && selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCheckoutModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-2xl"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md rounded-3xl bg-[#0f0f14]/95 border border-white/15 p-7 shadow-2xl backdrop-blur-3xl z-10 text-white"
            >
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="absolute top-5 right-5 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Activate {selectedPlan.name}</h3>
                  <p className="text-xs text-zinc-400">14-day full access sandbox included</p>
                </div>
              </div>

              <div className="my-5 p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Selected Tier</span>
                  <span className="text-white font-semibold">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Billing Cycle</span>
                  <span className="text-white capitalize">{billingCycle}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Starting Balance Due</span>
                  <span className="text-emerald-400 font-semibold">$0.00 (Trial Active)</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleConfirmSubscription}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-2xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isProcessing ? 'Initializing Workspace...' : 'Confirm & Launch Workspace'}
                </button>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="w-full py-2.5 rounded-2xl bg-transparent text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
