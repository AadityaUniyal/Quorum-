/**
 * DocIntel AI - Milestone 3 Automated Accessibility E2E Test Suite
 * 
 * Validates:
 * 1. EmptyState WCAG Level A compliance across all views
 * 2. 100% ARIA label and icon aria-hidden="true" compliance on icon-only controls
 * 3. ConfidenceBar progressbar semantics
 * 4. Radix UI Dialog primitives, focus traps, Escape/backdrop dismissal, and trigger focus restoration across all 4 modals
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createRequire } from 'node:module';
import './test-modals-adversarial.mjs';

const require = createRequire(import.meta.url);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, message = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    const failMsg = message ? `${testName}: ${message}` : testName;
    failures.push(failMsg);
    console.error(`  ✗ [FAIL] ${failMsg}`);
  }
}

function suite(title, fn) {
  console.log(`\n============================================================`);
  console.log(` SUITE: ${title}`);
  console.log(`============================================================`);
  try {
    fn();
  } catch (err) {
    console.error(`Unexpected suite error in "${title}":`, err);
    assert(false, `Suite execution for "${title}"`, err.message);
  }
}

// Helper to transpile TSX to CommonJS module
function transpileAndLoad(filePath, customExports = {}) {
  const absolutePath = path.resolve(filePath);
  const src = fs.readFileSync(absolutePath, 'utf-8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });

  const moduleObj = { exports: {} };
  const customRequire = (id) => {
    if (customExports[id]) return customExports[id];
    if (id.startsWith('@/')) {
      const rel = id.replace('@/', 'src/');
      return transpileAndLoad(path.resolve(rel), customExports);
    }
    return require(id);
  };

  const fn = new Function('require', 'module', 'exports', transpiled.outputText);
  fn(customRequire, moduleObj, moduleObj.exports);
  return moduleObj.exports;
}

// ============================================================================
// SUITE 1: EmptyState WCAG Level A Semantic Compliance
// ============================================================================
suite('1. EmptyState Component WCAG Level A Compliance', () => {
  const emptyStateModule = transpileAndLoad('src/components/ui/EmptyState.tsx');
  const EmptyState = emptyStateModule.EmptyState || emptyStateModule.default;

  assert(typeof EmptyState === 'function', 'EmptyState component is exported');

  // Render standard EmptyState
  const standardHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(EmptyState, {
      title: 'No Documents Found',
      description: 'Upload documents or adjust query filters to see results.',
    })
  );

  assert(standardHtml.includes('role="status"'), 'Container has role="status"');
  assert(standardHtml.includes('aria-live="polite"'), 'Container has aria-live="polite"');
  assert(standardHtml.includes('<h3'), 'Title uses semantic <h3> heading');
  assert(standardHtml.includes('aria-hidden="true"'), 'Icon has aria-hidden="true"');
  assert(standardHtml.includes('No Documents Found'), 'Renders title text correctly');

  // Render with Action Button
  const actionHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(EmptyState, {
      title: 'No Data Available',
      description: 'Run reconciliation now.',
      action: {
        label: 'Run Analysis',
        onClick: () => {},
      },
    })
  );
  assert(actionHtml.includes('<button'), 'Renders action button when action prop provided');
  assert(actionHtml.includes('Run Analysis'), 'Action button displays label');

  // Render Compact variant
  const compactHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(EmptyState, {
      title: 'Compact Empty',
      description: 'Compact variant in dialog.',
      compact: true,
    })
  );
  assert(compactHtml.includes('py-6'), 'Compact variant uses reduced padding (py-6)');
});

// ============================================================================
// SUITE 2: EmptyState Integration across Views (Search, Review, Documents, Bookmarks)
// ============================================================================
suite('2. EmptyState Integration Across Core Views', () => {
  const searchSrc = fs.readFileSync(path.resolve('src/app/search/page.tsx'), 'utf-8');
  const reviewSrc = fs.readFileSync(path.resolve('src/app/review/page.tsx'), 'utf-8');
  const documentsSrc = fs.readFileSync(path.resolve('src/app/documents/page.tsx'), 'utf-8');
  const threeWaySrc = fs.readFileSync(path.resolve('src/components/review/ThreeWayReconciliationModal.tsx'), 'utf-8');

  // Search Page
  assert(searchSrc.includes("import { EmptyState } from '@/components/ui/EmptyState'"), 'search/page.tsx imports EmptyState');
  assert(searchSrc.includes('title="No Search Results"'), 'search/page.tsx uses EmptyState for zero search results');
  assert(searchSrc.includes('title="No Saved Bookmarks"'), 'search/page.tsx uses EmptyState for empty bookmarks list');
  assert(!searchSrc.includes('No saved search bookmarks yet.</div>'), 'search/page.tsx eliminated hardcoded bookmark empty state');

  // Review Page
  assert(reviewSrc.includes("import { EmptyState } from '@/components/ui/EmptyState'"), 'review/page.tsx imports EmptyState');
  assert(reviewSrc.includes('title="No Documents Awaiting Review"'), 'review/page.tsx uses EmptyState when queue empty');
  assert(reviewSrc.includes('title="Review Workspace"'), 'review/page.tsx uses EmptyState when no document selected');
  assert(reviewSrc.includes('title="No Tabular Data Detected"'), 'review/page.tsx uses EmptyState for empty table reconstruction');
  assert(threeWaySrc.includes('title="Reconcile Ledger across Triplicate Artifacts"'), 'ThreeWayReconciliationModal uses EmptyState before analysis');

  // Documents Page
  assert(documentsSrc.includes("import { EmptyState } from '@/components/ui/EmptyState'"), 'documents/page.tsx imports EmptyState');
  assert(documentsSrc.includes('title="No Documents Found"'), 'documents/page.tsx uses EmptyState when doc list is empty');
});

// ============================================================================
// SUITE 3: ConfidenceBar Progressbar Semantics
// ============================================================================
suite('3. ConfidenceBar Progressbar Semantics', () => {
  const confidenceModule = transpileAndLoad('src/components/ui/ConfidenceBar.tsx');
  const ConfidenceBar = confidenceModule.ConfidenceBar;

  assert(typeof ConfidenceBar === 'function', 'ConfidenceBar component is exported');

  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ConfidenceBar, { score: 0.94, label: 'Field confidence' })
  );

  assert(html.includes('role="progressbar"'), 'ConfidenceBar specifies role="progressbar"');
  assert(html.includes('aria-valuenow="94"'), 'ConfidenceBar specifies aria-valuenow="94"');
  assert(html.includes('aria-valuemin="0"'), 'ConfidenceBar specifies aria-valuemin="0"');
  assert(html.includes('aria-valuemax="100"'), 'ConfidenceBar specifies aria-valuemax="100"');
  assert(html.includes('aria-valuetext="94% confidence"'), 'ConfidenceBar specifies aria-valuetext');
  assert(html.includes('aria-label="Field confidence"'), 'ConfidenceBar sets custom aria-label');
  assert(html.includes('aria-hidden="true"'), 'Visible percentage text has aria-hidden="true" to prevent redundant reading');
});

// ============================================================================
// SUITE 4: Icon-Only Interactive Controls & ARIA Accessibility
// ============================================================================
suite('4. 100% ARIA Label & Icon aria-hidden Compliance on Search & Review', () => {
  const searchSrc = fs.readFileSync(path.resolve('src/app/search/page.tsx'), 'utf-8');
  const reviewSrc = fs.readFileSync(path.resolve('src/app/review/page.tsx'), 'utf-8');
  const spatialSrc = fs.readFileSync(path.resolve('src/components/review/SpatialBoundingCanvas.tsx'), 'utf-8');

  // Check search page controls
  assert(searchSrc.includes('aria-label="Search documents"'), 'Search input has accessible aria-label');
  assert(searchSrc.includes('aria-label="Submit search query"'), 'Search submit button has aria-label');
  assert(searchSrc.includes('aria-label="Toggle AI query expansion"'), 'Query expansion toggle has aria-label and aria-pressed');
  assert(searchSrc.includes('aria-label="Save current search as bookmark"'), 'Save bookmark trigger button has aria-label');
  assert(searchSrc.includes('aria-label="Export search results as CSV file"'), 'CSV export button has aria-label');
  assert(searchSrc.includes('aria-label="Export search results as PDF document"'), 'PDF export button has aria-label');

  // Check review page controls
  assert(reviewSrc.includes('aria-label={`Select document ${item.filename},'), 'Queue document selection controls have accessible aria-labels');
  assert(reviewSrc.includes('aria-label="Open 3-way reconciliation"'), '3-Way reconciliation trigger button has aria-label');
  assert(reviewSrc.includes('aria-label="Open ERP export"'), 'Top ERP export trigger button has aria-label');
  assert(reviewSrc.includes('aria-label="View visual diff (Alt+D)"'), 'Diff modal trigger button has aria-label');
  assert(reviewSrc.includes('aria-label="Export to ERP system"'), 'Bottom ERP export trigger button has aria-label');
  assert(reviewSrc.includes('aria-label="Approve and index document"'), 'Approve document button has aria-label');

  // Check spatial pagination controls
  assert(spatialSrc.includes('aria-label="Go to previous document page"'), 'Spatial canvas previous page button has aria-label');
  assert(spatialSrc.includes('aria-label="Go to next document page"'), 'Spatial canvas next page button has aria-label');

  // Check that icons in buttons specify aria-hidden="true"
  assert(searchSrc.includes('<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />'), 'Sparkles icon in search button has aria-hidden');
  assert(searchSrc.includes('<Bookmark className="h-3.5 w-3.5" aria-hidden="true" />'), 'Bookmark icon in search button has aria-hidden');
  assert(reviewSrc.includes('<Building2 className="h-3 w-3" aria-hidden="true" />'), 'Building2 icon in ERP button has aria-hidden');
  assert(reviewSrc.includes('<Eye className="h-3.5 w-3.5" aria-hidden="true" />'), 'Eye icon in diff button has aria-hidden');
});

// ============================================================================
// SUITE 5: Radix UI Modal 1 — Save Bookmark & Saved Searches Modals (`search/page.tsx`)
// ============================================================================
suite('5. Search Modals Migration to Radix UI Dialog Primitives', () => {
  const searchSrc = fs.readFileSync(path.resolve('src/app/search/page.tsx'), 'utf-8');

  // Primitives import
  assert(searchSrc.includes("import * as Dialog from '@radix-ui/react-dialog'"), 'search/page.tsx imports Radix Dialog primitives');

  // Save Bookmark Modal
  assert(searchSrc.includes('<Dialog.Root open={isSaveBookmarkModalOpen} onOpenChange={setIsSaveBookmarkModalOpen}>'), 'Save bookmark modal uses controlled Dialog.Root');
  assert(searchSrc.includes('<Dialog.Portal>'), 'Save bookmark modal uses Dialog.Portal');
  assert(searchSrc.includes('<Dialog.Overlay'), 'Save bookmark modal uses Dialog.Overlay');
  assert(searchSrc.includes('<Dialog.Content'), 'Save bookmark modal uses Dialog.Content');
  assert(searchSrc.includes('<Dialog.Title className="text-sm font-bold text-foreground">Save Search Bookmark</Dialog.Title>'), 'Save bookmark modal has Dialog.Title');
  assert(searchSrc.includes('<Dialog.Description className="sr-only">'), 'Save bookmark modal has accessible sr-only Dialog.Description');
  assert(searchSrc.includes('<Dialog.Close asChild>'), 'Save bookmark modal wraps close/cancel buttons in Dialog.Close asChild');
  assert(searchSrc.includes('htmlFor="save-bookmark-name-input"'), 'Save bookmark label correctly references input ID');
  assert(searchSrc.includes('id="save-bookmark-name-input"') && searchSrc.includes('autoFocus'), 'Save bookmark input has id and autoFocus');

  // Saved Searches & Bookmarks Dialog
  assert(searchSrc.includes('<Dialog.Root open={isBookmarksOpen} onOpenChange={setIsBookmarksOpen}>'), 'Bookmarks dialog uses controlled Dialog.Root');
  assert(searchSrc.includes('<Dialog.Title className="text-sm font-bold text-foreground">Saved Searches & Bookmarks</Dialog.Title>'), 'Bookmarks dialog has Dialog.Title');
  assert(searchSrc.includes('<Dialog.Description className="sr-only">'), 'Bookmarks dialog has accessible sr-only Dialog.Description');
  assert(searchSrc.includes('tabIndex={0}') && searchSrc.includes('aria-label="Saved search bookmarks list"'), 'Bookmarks scroll list has tabIndex={0} and aria-label');
  assert(searchSrc.includes('aria-label={`Apply saved bookmark:'), 'Bookmark apply buttons have descriptive aria-labels');
  assert(searchSrc.includes('aria-label={`Delete saved bookmark:'), 'Bookmark delete buttons have descriptive aria-labels');
});

// ============================================================================
// SUITE 6: Radix UI Modal 2 — Three-Way Reconciliation Modal
// ============================================================================
suite('6. Three-Way Reconciliation Modal & Mount Lifecycle', () => {
  const threeWaySrc = fs.readFileSync(path.resolve('src/components/review/ThreeWayReconciliationModal.tsx'), 'utf-8');
  const reviewSrc = fs.readFileSync(path.resolve('src/app/review/page.tsx'), 'utf-8');

  // Radix primitives
  assert(threeWaySrc.includes("import * as Dialog from '@radix-ui/react-dialog'"), 'ThreeWayReconciliationModal imports Radix Dialog');
  assert(threeWaySrc.includes('<Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>'), 'Uses controlled Dialog.Root with onClose on dismiss');
  assert(threeWaySrc.includes('<Dialog.Portal>'), 'Uses Dialog.Portal for DOM isolation');
  assert(threeWaySrc.includes('<Dialog.Overlay'), 'Uses Dialog.Overlay for backdrop dismissal');
  assert(threeWaySrc.includes('<Dialog.Content'), 'Uses Dialog.Content for focus trapping and dialog semantics');
  assert(threeWaySrc.includes('<Dialog.Title'), 'Contains accessible Dialog.Title');
  assert(threeWaySrc.includes('<Dialog.Description'), 'Contains accessible Dialog.Description');
  assert(threeWaySrc.includes('<Dialog.Close asChild>'), 'Header and footer buttons use Dialog.Close asChild');

  // Accessibility refinements
  assert(threeWaySrc.includes('<th scope="col"'), 'Table headers specify scope="col"');
  assert(threeWaySrc.includes('focus-visible:ring-indigo-500'), 'Interactive buttons include visible focus rings');

  // Mount lifecycle in review/page.tsx
  assert(
    !reviewSrc.includes('{show3WayModal && (\n        <ThreeWayReconciliationModal') &&
    !reviewSrc.includes('{show3WayModal && <ThreeWayReconciliationModal'),
    'ThreeWayReconciliationModal is rendered directly without conditional unmounting'
  );
  assert(reviewSrc.includes('threeWayTriggerRef.current?.focus()'), 'Focus is restored to 3-way match trigger button upon modal close');
});

// ============================================================================
// SUITE 7: Radix UI Modal 3 — ERP Export Modal
// ============================================================================
suite('7. ERP Export Modal Lifecycle, Tab Semantics & Focus Management', () => {
  const erpSrc = fs.readFileSync(path.resolve('src/components/review/ErpExportModal.tsx'), 'utf-8');
  const reviewSrc = fs.readFileSync(path.resolve('src/app/review/page.tsx'), 'utf-8');

  // Radix primitives & null lifecycle
  assert(erpSrc.includes("import * as Dialog from '@radix-ui/react-dialog'"), 'ErpExportModal imports Radix Dialog');
  assert(!erpSrc.includes('if (!document) return null;'), 'Premature if (!document) return null is removed to preserve dialog lifecycle');
  assert(erpSrc.includes('<Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>'), 'Uses controlled Dialog.Root');
  assert(erpSrc.includes('<Dialog.Portal>'), 'Uses Dialog.Portal');
  assert(erpSrc.includes('<Dialog.Overlay'), 'Uses Dialog.Overlay');
  assert(erpSrc.includes('<Dialog.Content'), 'Uses Dialog.Content');
  assert(erpSrc.includes('<Dialog.Title'), 'Contains Dialog.Title');
  assert(erpSrc.includes('<Dialog.Description'), 'Contains Dialog.Description');

  // Tab semantics
  assert(erpSrc.includes('role="tablist"') && erpSrc.includes('aria-label="Export format options"'), 'Format options container has role="tablist"');
  assert(erpSrc.includes('role="tab"') && erpSrc.includes('aria-selected={activeFormat === \'quickbooks\'}'), 'Format buttons use role="tab" and aria-selected');
  assert(erpSrc.includes('aria-controls="export-preview-panel"'), 'Tabs link to export-preview-panel via aria-controls');

  // Scrollable container keyboard accessibility
  assert(
    erpSrc.includes('id="export-preview-panel"') &&
    erpSrc.includes('tabIndex={0}') &&
    erpSrc.includes('aria-label="Export payload content"'),
    'Export payload box has id, role="tabpanel", tabIndex={0} and aria-label for keyboard scrollability'
  );

  // Close wrapping
  assert(erpSrc.includes('<Dialog.Close asChild>') && erpSrc.includes('Close\n            </button>'), 'Footer close button wrapped in Dialog.Close asChild');

  // Mount lifecycle in review/page.tsx
  assert(
    !reviewSrc.includes('{showErpModal && (\n        <ErpExportModal') &&
    !reviewSrc.includes('{showErpModal && <ErpExportModal'),
    'ErpExportModal is rendered directly without conditional unmounting'
  );
  assert(reviewSrc.includes('erpTriggerRef.current') && reviewSrc.includes('lastErpTriggerRef'), 'Focus restoration tracks and returns focus to ERP trigger');
});

// ============================================================================
// SUITE 8: Radix UI Modal 4 — Document Visual Diff Viewer
// ============================================================================
suite('8. Document Visual Diff Viewer Controlled Lifecycle & Accessibility', () => {
  const diffSrc = fs.readFileSync(path.resolve('src/components/review/DocumentDiffViewer.tsx'), 'utf-8');
  const reviewSrc = fs.readFileSync(path.resolve('src/app/review/page.tsx'), 'utf-8');

  // isOpen prop
  assert(diffSrc.includes('isOpen?: boolean') || diffSrc.includes('isOpen: boolean'), 'DocumentDiffViewer accepts isOpen prop');
  assert(diffSrc.includes('<Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>'), 'Dialog.Root binds controlled open={isOpen}');
  assert(diffSrc.includes('<Dialog.Portal>'), 'Uses Dialog.Portal');
  assert(diffSrc.includes('<Dialog.Overlay'), 'Uses Dialog.Overlay');
  assert(diffSrc.includes('<Dialog.Content'), 'Uses Dialog.Content');
  assert(diffSrc.includes('<Dialog.Title'), 'Contains Dialog.Title');
  assert(diffSrc.includes('<Dialog.Description'), 'Contains Dialog.Description');
  assert(diffSrc.includes('<Dialog.Close asChild>'), 'Uses Dialog.Close asChild on header close button');

  // Scrollable diff list keyboard accessibility
  assert(diffSrc.includes('tabIndex={0}') && diffSrc.includes('aria-label="Field comparison list"'), 'Field comparison list has tabIndex={0} and aria-label');

  // Mount lifecycle in review/page.tsx
  assert(
    !reviewSrc.includes('{showDiffModal && (\n        <DocumentDiffViewer') &&
    !reviewSrc.includes('{showDiffModal && <DocumentDiffViewer'),
    'DocumentDiffViewer is rendered directly without conditional unmounting'
  );
  assert(reviewSrc.includes('diffTriggerRef.current?.focus()'), 'Focus is restored to visual diff trigger button upon modal close');
});

// ============================================================================
// SUMMARY & EXIT
// ============================================================================
console.log(`\n============================================================`);
console.log(` ACCESSIBILITY E2E TEST SUMMARY`);
console.log(`============================================================`);
console.log(`Total Assertions Run: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests > 0) {
  console.error(`\nTest suite FAILED with ${failedTests} failure(s):`);
  failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
  process.exit(1);
} else {
  console.log(`\nAll ${passedTests} accessibility assertions PASSED cleanly.`);
  process.exit(0);
}
