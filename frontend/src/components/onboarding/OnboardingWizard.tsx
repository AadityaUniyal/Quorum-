'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Upload, 
  Eye, 
  CheckCircle2, 
  ArrowRight, 
  FileText,
  Sparkles,
  Target
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to DocIntel AI',
    description: 'Transform document processing with multi-agent AI verification. Let\'s get you started in 60 seconds.',
    icon: Sparkles,
    color: 'from-blue-500 to-purple-500',
  },
  {
    id: 'upload',
    title: 'Upload Documents',
    description: 'Drag & drop invoices, contracts, or purchase orders. Our AI agents will extract and verify every field.',
    icon: Upload,
    color: 'from-emerald-500 to-teal-500',
    action: 'Go to Documents',
    route: '/documents',
  },
  {
    id: 'review',
    title: 'Review & Approve',
    description: 'Documents below 85% confidence land in the review queue. Edit fields, see AI explanations, and approve with confidence.',
    icon: Eye,
    color: 'from-amber-500 to-orange-500',
    action: 'View Review Queue',
    route: '/review',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start processing documents with 9 AI agents working in parallel. Need help? Check the demo sandbox in the header.',
    icon: CheckCircle2,
    color: 'from-green-500 to-emerald-500',
    action: 'Go to Dashboard',
    route: '/dashboard',
  },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const router = useRouter();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  const handleAction = () => {
    const step = steps[currentStep];
    if (step.route) {
      router.push(step.route);
      handleClose();
    } else {
      handleNext();
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative w-full max-w-2xl mx-4 bg-[#0c0c0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 transition-colors z-10"
            aria-label="Close onboarding wizard"
          >
            <X size={20} className="text-muted-foreground" />
          </button>

          {/* Progress Bar */}
          <div className="h-1 bg-white/5">
            <motion.div
              className={`h-full bg-gradient-to-r ${step.color}`}
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Content */}
          <div className="p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                {/* Icon */}
                <div className={`inline-flex p-6 rounded-2xl bg-gradient-to-br ${step.color} bg-opacity-10 mb-6`}>
                  <Icon size={48} className="text-white" strokeWidth={1.5} />
                </div>

                {/* Title */}
                <h2
                  id="onboarding-title"
                  className="text-3xl font-bold text-foreground mb-4"
                >
                  {step.title}
                </h2>

                {/* Description */}
                <p className="text-base text-muted-foreground leading-relaxed max-w-md mx-auto mb-8">
                  {step.description}
                </p>

                {/* Step Indicators */}
                <div className="flex justify-center gap-2 mb-8">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === currentStep
                          ? 'w-8 bg-gradient-to-r ' + step.color
                          : index < currentStep
                          ? 'w-2 bg-emerald-500'
                          : 'w-2 bg-white/10'
                      }`}
                      role="progressbar"
                      aria-valuenow={index === currentStep ? 100 : index < currentStep ? 100 : 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Step ${index + 1} of ${steps.length}`}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-center">
                  {currentStep > 0 && (
                    <button
                      onClick={handleSkip}
                      className="px-6 py-3 border border-white/10 hover:bg-white/5 rounded-lg font-medium text-sm text-muted-foreground transition-colors"
                    >
                      Skip Tour
                    </button>
                  )}
                  <button
                    onClick={handleAction}
                    className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${step.color} hover:shadow-xl hover:-translate-y-0.5 rounded-lg font-semibold text-sm text-white transition-all duration-200 shadow-lg`}
                  >
                    {step.action || 'Next'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
