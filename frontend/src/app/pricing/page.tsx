'use client';

import React, { useState } from 'react';
import { Check, Zap, Building2, Rocket, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const plans = [
  {
    name: 'Developer',
    description: 'For AI/ML teams building custom document intelligence',
    price: {
      monthly: 99,
      annual: 79,
    },
    payAsYouGo: '$0.10 per document',
    features: [
      'Process up to 1,000 documents/month',
      'Full multi-agent consensus engine',
      'REST API & Python SDK access',
      'Spatial grounding & visual diff',
      'Community support (Discord)',
      'Self-hosted option available',
    ],
    cta: 'Start Free Trial',
    popular: false,
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Business',
    description: 'For growing teams processing high document volumes',
    price: {
      monthly: 499,
      annual: 399,
    },
    payAsYouGo: '$0.08 per document',
    features: [
      'Process up to 10,000 documents/month',
      'Priority LLM routing (Groq fallback)',
      'Advanced analytics & FinOps tracking',
      'SSO & RBAC (Role-based access)',
      'Email support with 24h SLA',
      'Custom webhook integrations',
      'Audit logs & compliance reports',
    ],
    cta: 'Start Free Trial',
    popular: true,
    icon: Building2,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Enterprise',
    description: 'For large organizations with compliance requirements',
    price: {
      monthly: null,
      annual: null,
    },
    customPricing: true,
    payAsYouGo: 'Custom volume pricing',
    features: [
      'Unlimited documents',
      'Dedicated AI agent fine-tuning',
      'On-premise deployment option',
      'SOC 2 Type II certified',
      'BAA for HIPAA compliance',
      'Dedicated account manager',
      'Custom SLA (99.9% uptime)',
      'White-label branding available',
    ],
    cta: 'Contact Sales',
    popular: false,
    icon: Rocket,
    color: 'from-purple-500 to-pink-500',
  },
];

const faqs = [
  {
    question: 'What counts as a "document"?',
    answer: 'A document is any file uploaded for processing (PDF, PNG, JPG, TIFF). Multi-page PDFs count as one document.',
  },
  {
    question: 'Can I switch plans anytime?',
    answer: 'Yes! Upgrade or downgrade anytime. Pro-rated credits apply when upgrading mid-cycle.',
  },
  {
    question: 'Do you offer refunds?',
    answer: 'We offer a 14-day money-back guarantee on all plans. No questions asked.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, MasterCard, Amex), PayPal, and wire transfers for Enterprise plans.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We never train AI models on your documents. SOC 2 Type II certified.',
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required. Cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 mt-8 p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={clsx(
                'px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200',
                billingCycle === 'monthly'
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={clsx(
                'px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200 relative',
                billingCycle === 'annual'
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Annual
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const price = plan.customPricing
              ? null
              : billingCycle === 'monthly'
              ? plan.price.monthly
              : plan.price.annual;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={clsx(
                  'relative p-8 rounded-2xl border bg-[#0c0c0c]/80 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1',
                  plan.popular
                    ? 'border-emerald-500/50 shadow-xl shadow-emerald-500/10'
                    : 'border-white/10 hover:border-white/20'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full text-xs font-bold text-white shadow-lg">
                    MOST POPULAR
                  </div>
                )}

                {/* Icon */}
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${plan.color} bg-opacity-10 mb-6`}
                >
                  <Icon size={28} className="text-white" strokeWidth={1.5} />
                </div>

                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  {plan.customPricing ? (
                    <div className="text-3xl font-bold text-foreground">Custom</div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-foreground">${price}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      {billingCycle === 'annual' && (
                        <div className="text-xs text-emerald-400 mt-1">
                          Billed annually (${price! * 12}/year)
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">{plan.payAsYouGo}</div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  className={clsx(
                    'w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200',
                    plan.popular
                      ? `bg-gradient-to-r ${plan.color} text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5`
                      : 'bg-white/5 text-foreground border border-white/10 hover:bg-white/10'
                  )}
                >
                  {plan.cta}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.details
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group p-6 rounded-xl border border-white/10 bg-[#0c0c0c]/50 hover:bg-[#0c0c0c]/80 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground list-none">
                  <span className="flex items-center gap-3">
                    <HelpCircle size={18} className="text-primary shrink-0" />
                    {faq.question}
                  </span>
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed pl-9">
                  {faq.answer}
                </p>
              </motion.details>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 p-8 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10">
          <h3 className="text-2xl font-bold text-foreground mb-3">Still have questions?</h3>
          <p className="text-muted-foreground mb-6">
            Our team is here to help you find the perfect plan for your needs.
          </p>
          <button className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-xl">
            Schedule a Demo
          </button>
        </div>
      </div>
    </div>
  );
}
