import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  matchesPracticeTest1,
  PRACTICE_TEST_1_SCORING,
  scorePracticeTest1,
} from "./actPracticeTest1Scoring.js";
import { generateRecommendations } from "./studyRecommendations.js";

const BACKEND_BASE_URL = (
  import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5000"
).replace(/\/$/, "");
const TESTS_ENDPOINT = `${BACKEND_BASE_URL}/tests`;
const ADMIN_TESTS_ENDPOINT = `${BACKEND_BASE_URL}/admin/tests`;
const ADMIN_IMPORT_ENDPOINT = `${BACKEND_BASE_URL}/admin/tests/import-pdf`;

const API_ENDPOINTS = {
  parse: {
    label: "Score Report",
    url: `${BACKEND_BASE_URL}/parse-omr`,
    successMessage: "Your score report is ready.",
  },
};
const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "omr123";

const SECTION_CONFIG = [
  { key: "english", title: "English", total: 50 },
  { key: "math", title: "Math", total: 45 },
  { key: "reading", title: "Reading", total: 36 },
  { key: "science", title: "Science", total: 40 },
];

const ODD_LABELS = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
};

const EVEN_LABELS = {
  1: "F",
  2: "G",
  3: "H",
  4: "J",
};

const styles = `
  :root {
    --bg: #edf5f1;
    --bg-accent: #d7e7df;
    --surface: rgba(255, 255, 255, 0.88);
    --surface-soft: #f5faf8;
    --surface-strong: #ffffff;
    --line: rgba(16, 40, 35, 0.1);
    --text: #10231f;
    --muted: #64756f;
    --shadow: 0 28px 90px rgba(20, 54, 47, 0.16);
    --shadow-soft: 0 14px 38px rgba(20, 54, 47, 0.1);
    --accent: #0d7c66;
    --accent-strong: #075f50;
    --accent-soft: #d9f4ea;
    --info: #2563eb;
    --info-soft: #dbeafe;
    --warning: #b45309;
    --warning-soft: #fef3c7;
    --danger: #b91c1c;
    --danger-soft: #fee2e2;
    --blank: #94a3b8;
    --filled: #0f172a;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    background:
      radial-gradient(circle at 8% -8%, rgba(13, 124, 102, 0.22), transparent 28rem),
      radial-gradient(circle at 88% 2%, rgba(180, 83, 9, 0.16), transparent 24rem),
      linear-gradient(135deg, var(--bg) 0%, #fbfdfb 48%, var(--bg-accent) 100%);
    color: var(--text);
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  .app-shell {
    min-height: 100vh;
    padding: 18px 20px 52px;
    position: relative;
    overflow: hidden;
  }

  .app-shell::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(16, 35, 31, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16, 35, 31, 0.035) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.75), transparent 74%);
  }

  .app-container {
    width: min(1160px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 16px;
    position: relative;
    z-index: 1;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    position: sticky;
    top: 14px;
    z-index: 30;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 18px 50px rgba(20, 54, 47, 0.1);
    backdrop-filter: blur(18px);
  }

  .header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
  }

  .educator-profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
  }

  .profile-avatar {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-size: 0.82rem;
    font-weight: 900;
  }

  .profile-name {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 800;
  }

  .profile-role {
    margin: 1px 0 0;
    color: var(--muted);
    font-size: 0.76rem;
  }

  .brand-mark {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .brand-logo {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: var(--shadow-soft);
  }

  .brand-title {
    margin: 0;
    font-size: 1rem;
    line-height: 1.2;
  }

  .brand-subtitle {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .hero-card,
  .panel-card,
  .result-card,
  .answer-card,
  .saved-test-card {
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(18px);
  }

  .hero-card {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    padding: clamp(22px, 3vw, 34px);
    display: grid;
    gap: 22px;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(245, 250, 248, 0.88)),
      radial-gradient(circle at 92% 12%, rgba(13, 124, 102, 0.16), transparent 22rem);
    animation: rise 0.7s ease both;
  }

  .hero-card::after {
    content: "";
    position: absolute;
    width: 260px;
    height: 260px;
    right: -92px;
    top: -110px;
    border-radius: 999px;
    background: rgba(13, 124, 102, 0.12);
    filter: blur(2px);
    animation: breathe 7s ease-in-out infinite;
  }

  .hero-top {
    display: grid;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    padding: 7px 11px;
    border-radius: 999px;
    background: rgba(13, 124, 102, 0.1);
    color: var(--accent);
    font-size: 0.76rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero-title {
    margin: 0;
    max-width: 840px;
    font-size: clamp(2.15rem, 4vw, 4.15rem);
    line-height: 0.96;
    letter-spacing: -0.045em;
  }

  .hero-copy {
    margin: 0;
    max-width: 720px;
    color: var(--muted);
    font-size: 1.05rem;
    line-height: 1.6;
  }

  .hero-highlights {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 4px;
  }

  .hero-highlight {
    padding: 9px 11px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.86rem;
    font-weight: 800;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(310px, 0.82fr);
    gap: 16px;
    align-items: start;
    position: relative;
    z-index: 1;
  }

  .panel-card {
    border-radius: 22px;
    padding: 18px;
    animation: rise 0.85s ease both;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  }

  .panel-card:hover,
  .result-card:hover,
  .saved-test-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
    border-color: rgba(13, 124, 102, 0.16);
  }

  .upload-card {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 251, 249, 0.92));
  }

  .insight-card {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(245, 250, 248, 0.82));
    animation-delay: 0.08s;
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 14px;
  }

  .panel-title {
    margin: 0;
    font-size: 1.15rem;
  }

  .panel-subtitle {
    margin: 6px 0 0;
    color: var(--muted);
    line-height: 1.5;
    font-size: 0.94rem;
  }

  .status-chip {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(13, 124, 102, 0.1);
    color: var(--accent);
    font-weight: 700;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  .stack {
    display: grid;
    gap: 12px;
  }

  .field {
    display: grid;
    gap: 8px;
  }

  .field label {
    font-size: 0.9rem;
    font-weight: 700;
  }

  .text-input,
  .textarea-input,
  .file-input {
    width: 100%;
    border-radius: 14px;
    border: 1px solid var(--line);
    padding: 13px 14px;
    background: var(--surface-strong);
    color: var(--text);
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .text-input:focus,
  .textarea-input:focus,
  .file-input:focus {
    outline: none;
    border-color: rgba(31, 111, 95, 0.35);
    box-shadow: 0 0 0 4px rgba(31, 111, 95, 0.12);
    transform: translateY(-1px);
  }

  .textarea-input {
    min-height: 90px;
    resize: vertical;
  }

  .file-pick {
    display: grid;
    gap: 10px;
  }

  .file-name {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
    color: var(--muted);
    font-size: 0.92rem;
    word-break: break-word;
  }

  .file-input::file-selector-button {
    margin-right: 12px;
    border: 0;
    border-radius: 12px;
    padding: 10px 12px;
    background: var(--info-soft);
    color: var(--info);
    font-weight: 800;
    cursor: pointer;
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .primary-button,
  .secondary-button {
    border: 0;
    border-radius: 14px;
    padding: 13px 17px;
    cursor: pointer;
    transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
    font-weight: 700;
  }

  .primary-button {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
    color: white;
    box-shadow: 0 12px 26px rgba(31, 111, 95, 0.22);
  }

  .secondary-button {
    background: rgba(16, 35, 31, 0.08);
    color: var(--text);
  }

  .primary-button:hover,
  .secondary-button:hover {
    transform: translateY(-2px);
  }

  .primary-button:disabled,
  .secondary-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    transform: none;
    box-shadow: none;
  }

  .helper-text {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .photo-checklist {
    display: grid;
    gap: 9px;
    padding: 12px;
    border-radius: 18px;
    background: var(--surface-soft);
    border: 1px solid var(--line);
  }

  .photo-checklist-title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 800;
  }

  .photo-checklist-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .photo-check-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 0.88rem;
  }

  .photo-check-icon {
    width: 24px;
    height: 20px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-size: 0.62rem;
    font-weight: 900;
    flex: 0 0 auto;
  }

  .photo-preview-card {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: 18px;
    background: var(--surface-soft);
    border: 1px solid var(--line);
  }

  .photo-preview-image {
    width: 100%;
    max-height: 220px;
    object-fit: contain;
    border-radius: 14px;
    background: #ffffff;
    border: 1px solid var(--line);
  }

  .photo-guide {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 2px;
  }

  .photo-example {
    display: grid;
    gap: 8px;
    padding: 10px;
    border-radius: 14px;
    background: #ffffff;
    border: 1px solid var(--line);
  }

  .photo-example-label {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 800;
    color: var(--muted);
  }

  .sample-photo {
    height: 86px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #e8f3f1, #f9fbfc);
    overflow: hidden;
  }

  .sample-photo.bad {
    background: linear-gradient(135deg, #f4e7df, #f9fbfc);
  }

  .sample-sheet {
    width: 54px;
    height: 70px;
    border-radius: 4px;
    background:
      repeating-linear-gradient(to bottom, transparent 0 9px, rgba(15, 23, 42, 0.12) 9px 11px),
      #ffffff;
    border: 2px solid rgba(15, 23, 42, 0.2);
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  }

  .sample-photo.bad .sample-sheet {
    transform: rotate(-13deg) translateX(10px);
    filter: blur(1px);
    opacity: 0.72;
  }

  .message {
    border-radius: 16px;
    padding: 14px 16px;
    font-size: 0.94rem;
    line-height: 1.5;
  }

  .message.error {
    background: var(--danger-soft);
    color: var(--danger);
  }

  .message.success {
    background: rgba(31, 111, 95, 0.12);
    color: var(--accent);
  }

  .message.warning {
    background: var(--warning-soft);
    color: var(--warning);
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .result-card {
    border-radius: 22px;
    padding: 18px;
    display: grid;
    gap: 18px;
    animation: rise 0.75s ease both;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  }

  .results-grid .result-card:nth-child(2) {
    animation-delay: 0.04s;
  }

  .results-grid .result-card:nth-child(3) {
    animation-delay: 0.08s;
  }

  .results-grid .result-card:nth-child(4) {
    animation-delay: 0.12s;
  }

  .result-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .result-title {
    margin: 0;
    font-size: 1.08rem;
  }

  .result-meta {
    color: var(--muted);
    font-size: 0.9rem;
  }

  .answers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
    gap: 8px;
  }

  .score-summary {
    display: grid;
    gap: 14px;
    padding: 16px;
    border-radius: 18px;
    background: rgba(31, 111, 95, 0.08);
    border: 1px solid rgba(31, 111, 95, 0.14);
  }

  .score-overview {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .score-pill,
  .score-category-card {
    border-radius: 8px;
    padding: 11px 12px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(59, 48, 36, 0.08);
  }

  .score-label,
  .score-category-name {
    color: var(--muted);
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .score-value,
  .score-category-value {
    margin-top: 4px;
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--filled);
  }

  .score-category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }

  .results-banner {
    grid-column: 1 / -1;
  }

  .scan-warning-list {
    margin: 8px 0 0;
    padding-left: 18px;
  }

  .scan-warning-list li {
    margin-top: 4px;
  }

  .study-plan-shell {
    display: grid;
    gap: 16px;
  }

  .study-plan-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    align-items: start;
  }

  .study-plan-card {
    display: grid;
    gap: 16px;
    align-content: start;
  }

  .study-plan-header {
    display: grid;
    gap: 6px;
  }

  .study-plan-copy {
    margin: 0;
    color: var(--muted);
    font-size: 0.93rem;
    line-height: 1.5;
  }

  .study-category-list,
  .study-strategy-list,
  .study-module-list {
    display: grid;
    gap: 10px;
    align-content: start;
  }

  .study-category-card,
  .study-strategy-card,
  .study-module-card {
    border-radius: 16px;
    border: 1px solid rgba(59, 48, 36, 0.08);
    background: rgba(255, 255, 255, 0.72);
  }

  .study-category-card {
    padding: 14px;
    display: grid;
    gap: 12px;
  }

  .study-category-head,
  .study-module-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .study-category-title,
  .study-module-title {
    margin: 0;
    font-size: 0.96rem;
  }

  .study-category-score,
  .study-module-subtitle {
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .study-category-reason {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .study-module-card,
  .study-strategy-card {
    padding: 12px 14px;
  }

  .study-priority {
    padding: 7px 10px;
    border-radius: 999px;
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .study-priority.high {
    background: rgba(182, 71, 71, 0.12);
    color: var(--danger);
  }

  .study-priority.medium {
    background: rgba(158, 113, 54, 0.14);
    color: #8b5a1f;
  }

  .study-priority.low {
    background: rgba(31, 111, 95, 0.12);
    color: var(--accent);
  }

  .study-strategy-title {
    margin: 0;
    font-size: 0.92rem;
  }

  .answer-card {
    border-radius: 16px;
    padding: 10px;
    min-height: 66px;
    display: grid;
    align-content: center;
    gap: 6px;
    border: 1px solid rgba(59, 48, 36, 0.08);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }

  .answer-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(20, 54, 47, 0.08);
    border-color: rgba(31, 111, 95, 0.18);
  }

  .answer-card.blank {
    color: var(--blank);
    background: rgba(196, 184, 170, 0.12);
  }

  .answer-card.filled {
    color: var(--filled);
    background: rgba(255, 255, 255, 0.85);
  }

  .answer-question {
    font-size: 0.84rem;
    color: var(--muted);
  }

  .answer-value {
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  .admin-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .saved-tests {
    display: grid;
    gap: 14px;
  }

  .preview-card {
    border-radius: 22px;
    padding: 18px;
    display: grid;
    gap: 16px;
    background: var(--surface);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255, 255, 255, 0.58);
    box-shadow: var(--shadow-soft);
    animation: rise 0.8s ease both;
  }

  .preview-image {
    width: 100%;
    max-height: 520px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid rgba(59, 48, 36, 0.08);
    background: rgba(255, 255, 255, 0.72);
  }

  .preview-code {
    margin: 0;
    border-radius: 8px;
    padding: 18px;
    overflow: auto;
    background: rgba(32, 28, 23, 0.92);
    color: #f7f3ee;
    font-size: 0.88rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .endpoint-list {
    display: grid;
    gap: 10px;
  }

  .endpoint-item {
    display: grid;
    gap: 6px;
    padding: 13px 14px;
    border-radius: 18px;
    background: var(--surface-soft);
    border: 1px solid rgba(59, 48, 36, 0.08);
    transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }

  .endpoint-item:hover {
    transform: translateY(-2px);
    border-color: rgba(13, 124, 102, 0.2);
    background: #ffffff;
  }

  .endpoint-item strong {
    font-size: 0.95rem;
  }

  .endpoint-url {
    color: var(--muted);
    font-size: 0.84rem;
    word-break: break-word;
  }

  .saved-test-card {
    border-radius: 18px;
    padding: 16px;
    display: grid;
    gap: 12px;
  }

  .saved-test-title {
    margin: 0;
    font-size: 1rem;
  }

  .saved-test-date {
    color: var(--muted);
    font-size: 0.88rem;
  }

  .saved-test-sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .saved-section-pill {
    border-radius: 999px;
    padding: 10px 12px;
    background: rgba(32, 28, 23, 0.05);
    font-size: 0.88rem;
    color: var(--muted);
  }

  .empty-state {
    padding: 26px 18px;
    border-radius: 22px;
    border: 1px dashed rgba(59, 48, 36, 0.18);
    color: var(--muted);
    text-align: center;
    background: var(--surface);
  }

  .quiet-button {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-weight: 700;
    text-align: left;
  }

  .quiet-button:hover {
    color: var(--text);
  }

  .score-report-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    scroll-margin-top: 24px;
    border-radius: 24px;
  }

  .results-action-bar {
    position: sticky;
    top: 12px;
    z-index: 12;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(12px);
  }

  .results-action-copy {
    margin: 0;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .score-kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(120px, 1fr));
    gap: 10px;
  }

  .score-kpi {
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--surface-soft);
  }

  .score-kpi-label {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .score-kpi-value {
    margin-top: 6px;
    font-size: 1.45rem;
    font-weight: 900;
    color: var(--filled);
  }

  .scan-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .scan-summary-card {
    padding: 12px;
    border-radius: 18px;
    background: var(--surface-soft);
    border: 1px solid var(--line);
  }

  .scan-summary-label {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .scan-summary-value {
    margin-top: 4px;
    font-size: 1.2rem;
    font-weight: 900;
  }

  .section-status {
    border-radius: 999px;
    padding: 8px 10px;
    font-size: 0.78rem;
    font-weight: 900;
  }

  .section-status.good {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .section-status.review {
    background: var(--warning-soft);
    color: var(--warning);
  }

  .section-status.poor {
    background: var(--danger-soft);
    color: var(--danger);
  }

  .low-confidence-card {
    display: grid;
    gap: 10px;
    padding: 16px;
    border-radius: 18px;
    background: var(--warning-soft);
    color: var(--warning);
  }

  .answer-review {
    display: grid;
    gap: 14px;
  }

  .answer-review summary {
    cursor: pointer;
    width: fit-content;
    color: var(--accent);
    font-weight: 800;
  }

  .answer-review summary:focus {
    outline: 3px solid rgba(15, 118, 110, 0.18);
    outline-offset: 4px;
    border-radius: 6px;
  }

  .loading-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.42);
    backdrop-filter: blur(10px);
    animation: fadeIn 0.18s ease both;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 45;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.46);
    backdrop-filter: blur(10px);
    animation: fadeIn 0.18s ease both;
  }

  .login-modal {
    width: min(430px, 100%);
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
    padding: 22px;
    display: grid;
    gap: 18px;
  }

  .modal-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .icon-button {
    border: 0;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--surface-soft);
    color: var(--muted);
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
  }

  .loading-modal {
    width: min(440px, 100%);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.62);
    background: #ffffff;
    box-shadow: var(--shadow);
    padding: 24px;
    display: grid;
    gap: 18px;
    text-align: center;
  }

  .loading-ring {
    width: 54px;
    height: 54px;
    margin: 0 auto;
    border-radius: 50%;
    border: 5px solid var(--accent-soft);
    border-top-color: var(--accent);
    animation: spin 0.85s linear infinite;
  }

  .loading-title {
    margin: 0;
    font-size: 1.25rem;
  }

  .loading-copy {
    margin: 0;
    color: var(--muted);
    line-height: 1.55;
  }

  .modal-steps {
    display: grid;
    gap: 8px;
    text-align: left;
  }

  .modal-step {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--surface-soft);
    color: var(--muted);
    font-size: 0.9rem;
    opacity: 0.46;
    transform: translateX(-4px);
    transition: opacity 0.25s ease, transform 0.25s ease, background 0.25s ease, color 0.25s ease;
  }

  .modal-step.active {
    background: var(--accent-soft);
    color: var(--accent-strong);
    opacity: 1;
    transform: translateX(0);
  }

  .modal-step.complete {
    opacity: 0.78;
    transform: translateX(0);
  }

  .modal-step-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: currentColor;
    flex: 0 0 auto;
    opacity: 0.42;
  }

  .modal-step.active .modal-step-dot {
    opacity: 1;
    animation: pulseDot 0.9s ease-in-out infinite;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(22px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes breathe {
    0%,
    100% {
      transform: scale(1) translate3d(0, 0, 0);
      opacity: 0.7;
    }

    50% {
      transform: scale(1.08) translate3d(-10px, 12px, 0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.001ms !important;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulseDot {
    0%,
    100% {
      transform: scale(0.9);
      opacity: 0.55;
    }

    50% {
      transform: scale(1.28);
      opacity: 1;
    }
  }

  @media (max-width: 980px) {
    .hero-grid,
    .results-grid,
    .admin-grid,
    .study-plan-grid,
    .score-report-head,
    .score-kpis {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .app-shell {
      padding: 14px 12px 36px;
    }

    .hero-card,
    .panel-card,
    .result-card {
      padding: 16px;
      border-radius: 8px;
    }

    .app-header {
      align-items: flex-start;
    }

    .header-actions {
      width: 100%;
      justify-content: flex-start;
    }

    .hero-title {
      font-size: 2rem;
    }

    .panel-head,
    .result-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .answers-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .saved-test-sections {
      grid-template-columns: 1fr;
    }

    .photo-checklist-grid {
      grid-template-columns: 1fr;
    }

    .score-overview,
    .score-category-grid,
    .scan-summary,
    .photo-guide {
      grid-template-columns: 1fr;
    }

    .results-action-bar {
      position: static;
      align-items: flex-start;
      flex-direction: column;
    }

    .loading-modal {
      padding: 20px;
    }
  }
`;

function mapAnswer(value, questionNumber) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 4) {
    return "-";
  }

  const labels = questionNumber % 2 === 1 ? ODD_LABELS : EVEN_LABELS;
  return labels[numericValue] || "-";
}

function countAnswers(sectionAnswers = []) {
  const answered = sectionAnswers.filter(
    (value) => value !== null && value !== undefined && value !== ""
  ).length;

  return {
    answered,
    blank: sectionAnswers.length - answered,
  };
}

function summarizeResults(results) {
  if (!results) {
    return {
      answered: 0,
      blank: 0,
      total: SECTION_CONFIG.reduce((sum, section) => sum + section.total, 0),
      percentAnswered: 0,
      hasManyBlanks: false,
      isLowConfidence: false,
    };
  }

  const totals = SECTION_CONFIG.reduce(
    (summary, { key, total }) => {
      const answers = Array.isArray(results[key]) ? results[key] : [];
      const counts = countAnswers(answers);
      summary.answered += counts.answered;
      summary.blank += total - counts.answered;
      summary.total += total;
      return summary;
    },
    { answered: 0, blank: 0, total: 0 }
  );

  const percentAnswered = totals.total ? totals.answered / totals.total : 0;

  return {
    ...totals,
    percentAnswered,
    hasManyBlanks: percentAnswered < 0.75,
    isLowConfidence: totals.answered < 10 || percentAnswered < 0.08,
  };
}

function getSectionScanStatus(counts, total) {
  const answeredPercent = total ? counts.answered / total : 0;

  if (counts.answered === 0 || answeredPercent < 0.2) {
    return {
      label: "Needs a new photo",
      className: "poor",
    };
  }

  if (answeredPercent < 0.8) {
    return {
      label: "Needs review",
      className: "review",
    };
  }

  if (counts.blank > 0) {
    return {
      label: "Some blanks",
      className: "review",
    };
  }

  return {
    label: "Looks good",
    className: "good",
  };
}

function parseJsonLike(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || !["{", "["].includes(trimmed[0])) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeDetectedAnswer(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = String(value).trim().toUpperCase();
  if (!cleaned || cleaned === "NULL" || cleaned === "-") {
    return null;
  }

  const labelMap = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    F: 1,
    G: 2,
    H: 3,
    J: 4,
  };

  if (labelMap[cleaned]) {
    return labelMap[cleaned];
  }

  const numericValue = Number(cleaned);
  return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 4
    ? numericValue
    : null;
}

function coerceSectionAnswers(value, total) {
  const parsedValue = parseJsonLike(value);
  let answers = null;

  if (Array.isArray(parsedValue)) {
    answers = parsedValue;
  } else if (parsedValue && typeof parsedValue === "object") {
    const numericKeys = Object.keys(parsedValue)
      .map((key) => Number(key))
      .filter((key) => Number.isInteger(key))
      .sort((left, right) => left - right);

    if (numericKeys.length) {
      const zeroBased = numericKeys.includes(0);
      answers = Array(total).fill(null);

      numericKeys.forEach((key) => {
        const index = zeroBased ? key : key - 1;
        if (index >= 0 && index < total) {
          answers[index] = parsedValue[key] ?? parsedValue[String(key)];
        }
      });
    }
  }

  if (!answers) {
    return null;
  }

  return Array.from({ length: total }, (_, index) =>
    normalizeDetectedAnswer(answers[index])
  );
}

function normalizeAnswerKeyPayload(payload, depth = 0) {
  if (depth > 4) {
    return null;
  }

  const parsedPayload = parseJsonLike(payload);

  if (Array.isArray(parsedPayload)) {
    for (const item of parsedPayload) {
      const normalized = normalizeAnswerKeyPayload(item, depth + 1);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  if (!parsedPayload || typeof parsedPayload !== "object") {
    return null;
  }

  const normalizedSections = {};
  const hasAllSections = SECTION_CONFIG.every(({ key, total }) => {
    const answers = coerceSectionAnswers(parsedPayload[key], total);
    if (!answers) {
      return false;
    }

    normalizedSections[key] = answers;
    return true;
  });

  if (hasAllSections) {
    return {
      ...normalizedSections,
      _status: parsedPayload._status || "ok",
      _warnings: Array.isArray(parsedPayload._warnings)
        ? parsedPayload._warnings
        : [],
    };
  }

  for (const key of ["json", "body", "data", "result", "results", "response"]) {
    if (key in parsedPayload) {
      const normalized = normalizeAnswerKeyPayload(parsedPayload[key], depth + 1);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function formatSavedDate(isoDate) {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

function getDisplayedCategoryScores(sectionKey, sectionScore) {
  const config = PRACTICE_TEST_1_SCORING[sectionKey];
  if (!config || !sectionScore) {
    return [];
  }

  return config.categoryOrder
    .map((categoryCode) => {
      const sourceScore = config.groupedCategories[categoryCode]
        ? sectionScore.groupedCategoryScores[categoryCode]
        : sectionScore.categoryScores[categoryCode];

      if (!sourceScore) {
        return null;
      }

      return {
        code: categoryCode,
        label: config.categoryDisplayNames[categoryCode] || categoryCode,
        ...sourceScore,
      };
    })
    .filter(Boolean);
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return {
      type: "json",
      contentType,
      data: await response.json(),
    };
  }

  if (contentType.startsWith("image/")) {
    const imageBlob = await response.blob();
    return {
      type: "image",
      contentType,
      data: URL.createObjectURL(imageBlob),
    };
  }

  const rawText = await response.text();

  try {
    return {
      type: "json",
      contentType: contentType || "text/plain",
      data: JSON.parse(rawText),
    };
  } catch {
    return {
      type: "text",
      contentType: contentType || "text/plain",
      data: rawText,
    };
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.detail || payload.error || `Request failed with status ${response.status}`
    );
  }

  return payload;
}

function buildBasicAuthHeader(username, password) {
  if (typeof window === "undefined") {
    return "";
  }

  return `Basic ${window.btoa(`${username}:${password}`)}`;
}

export default function App() {
  const uploadRef = useRef(null);
  const resultsRef = useRef(null);
  const answersRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState("");
  const [fileInputResetKey, setFileInputResetKey] = useState(0);
  const [isAnswerReviewOpen, setIsAnswerReviewOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [availableTests, setAvailableTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState("");
  const [results, setResults] = useState(null);
  const [apiPreview, setApiPreview] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [testName, setTestName] = useState("");
  const [scoringRubricFile, setScoringRubricFile] = useState(null);
  const [recommendationFiles, setRecommendationFiles] = useState({
    english: null,
    math: null,
    reading: null,
    science: null,
  });
  const [savedTests, setSavedTests] = useState([]);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [adminUploadResetKey, setAdminUploadResetKey] = useState(0);

  const selectedTest = useMemo(
    () =>
      availableTests.find((test) => String(test.id) === String(selectedTestId)) ||
      null,
    [availableTests, selectedTestId]
  );
  const practiceTest1ScoringState = useMemo(() => {
    const practiceTestReference = `${selectedTest?.name || ""} ${
      selectedTest?.sourceFilename || ""
    }`;
    const isPracticeTest1 = matchesPracticeTest1(practiceTestReference);

    if (!results || !isPracticeTest1) {
      return {
        isPracticeTest1,
        scores: null,
        error: "",
      };
    }

    try {
      return {
        isPracticeTest1,
        scores: scorePracticeTest1(results),
        error: "",
      };
    } catch (scoringError) {
      console.error("Score calculation failed", scoringError);
      return {
        isPracticeTest1,
        scores: null,
        error: "We could not calculate this test score yet.",
      };
    }
  }, [results, selectedTest]);
  const studyRecommendations = useMemo(() => {
    if (!practiceTest1ScoringState.scores) {
      return null;
    }

    return generateRecommendations(practiceTest1ScoringState.scores);
  }, [practiceTest1ScoringState.scores]);
  const resultReadSummary = useMemo(() => summarizeResults(results), [results]);
  const scoreSummaryItems = useMemo(
    () =>
      SECTION_CONFIG.map(({ key, title }) => {
        const sectionScore = practiceTest1ScoringState.scores?.[key];
        const answers = Array.isArray(results?.[key]) ? results[key] : [];
        const counts = countAnswers(answers);

        return {
          key,
          title,
          primary: resultReadSummary.isLowConfidence
            ? "Review"
            : sectionScore
              ? sectionScore.scaleScore
              : counts.answered,
          label: resultReadSummary.isLowConfidence
            ? "Scan quality"
            : sectionScore
              ? "ACT score"
              : "Answered",
          meta: resultReadSummary.isLowConfidence
            ? "Try a clearer photo"
            : sectionScore
            ? `${sectionScore.rawScore} of ${sectionScore.totalPossible} questions correct`
            : `${counts.blank} blank`,
        };
      }),
    [practiceTest1ScoringState.scores, resultReadSummary.isLowConfidence, results]
  );

  const loadPublicTests = async () => {
    setTestsLoading(true);
    setTestsError("");

    try {
      const payload = await fetchJson(TESTS_ENDPOINT);
      const tests = Array.isArray(payload.tests) ? payload.tests : [];
      setAvailableTests(tests);
      setSelectedTestId((current) => {
        if (current && tests.some((test) => String(test.id) === String(current))) {
          return current;
        }

        return tests[0] ? String(tests[0].id) : "";
      });
    } catch (loadError) {
      const friendlyMessage =
        loadError.message &&
        !/failed to fetch|networkerror|load failed|request failed/i.test(loadError.message)
          ? loadError.message
          : "We could not load the test list. Please try again.";
      setTestsError(friendlyMessage);
    } finally {
      setTestsLoading(false);
    }
  };

  const loadAdminTests = async (credentials = adminCredentials) => {
    const authHeader = buildBasicAuthHeader(
      credentials.username.trim(),
      credentials.password.trim()
    );
    const payload = await fetchJson(ADMIN_TESTS_ENDPOINT, {
      headers: {
        Authorization: authHeader,
      },
    });
    setSavedTests(Array.isArray(payload.tests) ? payload.tests : []);
  };

  const loadingModal = isSavingTest
    ? {
        title: "Saving test",
        copy: "We are reading the scoring guide and study materials. This can take a little while for larger PDFs.",
        steps: [
          "Reading the scoring guide",
          "Preparing study recommendations",
          "Saving the test for students",
        ],
      }
    : {
        title: "Building your score report",
        copy: "We are reading the sheet, checking each section, and preparing your results.",
        steps: [
          "Reading answer marks",
          "Scoring each section",
          "Preparing study recommendations",
        ],
      };

  useEffect(() => {
    loadPublicTests();
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (!results) {
      setIsAnswerReviewOpen(false);
      return undefined;
    }

    const scrollTimer = window.setTimeout(() => {
      handleViewResults();
    }, 250);

    return () => window.clearTimeout(scrollTimer);
  }, [results]);

  useEffect(() => {
    if (!isLoading && !isSavingTest) {
      setLoadingStepIndex(0);
      return undefined;
    }

    setLoadingStepIndex(0);
    const stepTimer = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % loadingModal.steps.length);
    }, 1250);

    return () => window.clearInterval(stepTimer);
  }, [isLoading, isSavingTest, loadingModal.steps.length]);

  useEffect(() => {
    if (!apiPreview || apiPreview.type !== "image") {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(apiPreview.data);
    };
  }, [apiPreview]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError("");
    setResults(null);
    setApiPreview(null);
    setUploadSuccess("");
  };

  const handleViewResults = () => {
    resultsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleBackToUpload = () => {
    uploadRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleReviewAnswers = () => {
    setIsAnswerReviewOpen(true);
    window.setTimeout(() => {
      answersRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  const handleStartOver = () => {
    setSelectedFile(null);
    setResults(null);
    setApiPreview(null);
    setError("");
    setUploadSuccess("");
    setIsAnswerReviewOpen(false);
    setFileInputResetKey((current) => current + 1);
    window.setTimeout(handleBackToUpload, 80);
  };

  const runEndpointAction = async (actionKey) => {
    if (!selectedFile) {
      setError("Please upload an answer sheet image first.");
      return;
    }

    if (actionKey === "parse" && !selectedTestId) {
      setError("Please select a test before getting results.");
      return;
    }

    const endpoint = API_ENDPOINTS[actionKey];
    setIsLoading(true);
    setError("");
    setUploadSuccess("");
    setResults(null);
    setApiPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      if (actionKey === "parse" && selectedTest) {
        formData.append("testId", String(selectedTest.id));
        formData.append("testName", selectedTest.name);
      }

      const response = await fetch(endpoint.url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          "We could not create the score report from this image. Please try a clearer photo or try again."
        );
      }

      const payload = await readApiResponse(response);
      const normalizedResults =
        payload.type === "json" ? normalizeAnswerKeyPayload(payload.data) : null;

      if (normalizedResults) {
        setResults(normalizedResults);
        setUploadSuccess(endpoint.successMessage);
      } else {
        setApiPreview({
          ...payload,
          endpointLabel: endpoint.label,
          endpointUrl: endpoint.url,
        });
        setError(
          "We received a response, but could not turn it into a score report yet."
        );
      }
    } catch (uploadError) {
      const friendlyMessage =
        uploadError.message &&
          !/failed to fetch|networkerror|load failed|request failed/i.test(uploadError.message)
          ? uploadError.message
          : "We could not reach the scoring service. Please check your connection and try again.";
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    await runEndpointAction("parse");
  };

  const handleAdminCredentialChange = (event) => {
    const { name, value } = event.target;
    setAdminCredentials((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleRecommendationFileChange = (sectionKey, file) => {
    setRecommendationFiles((current) => ({
      ...current,
      [sectionKey]: file,
    }));
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    try {
      await loadAdminTests(adminCredentials);
      setIsAdminAuthenticated(true);
      setIsAdminOpen(true);
      setIsLoginModalOpen(false);
      setAdminSuccess("You are signed in.");
    } catch (loginError) {
      setIsAdminAuthenticated(false);
      setSavedTests([]);
      setAdminError(
        loginError.message &&
          !/failed to fetch|networkerror|load failed|request failed/i.test(loginError.message)
          ? loginError.message
          : "We could not sign you in. Please check the details and try again."
      );
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setIsAdminOpen(false);
    setIsLoginModalOpen(false);
    setSavedTests([]);
    setAdminError("");
    setAdminSuccess("");
  };

  const handleSaveTest = async (event) => {
    event.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!testName.trim()) {
      setAdminError("Add a test name before saving.");
      return;
    }

    if (!scoringRubricFile) {
      setAdminError("Upload the scoring guide PDF before saving.");
      return;
    }

    const missingRecommendationSections = SECTION_CONFIG.filter(
      ({ key }) => !recommendationFiles[key]
    );
    if (missingRecommendationSections.length) {
      setAdminError(
        `Upload study-material PDFs for ${missingRecommendationSections
          .map(({ title }) => title)
          .join(", ")} before saving.`
      );
      return;
    }

    setIsSavingTest(true);

    try {
      const formData = new FormData();
      formData.append("name", testName.trim());
      formData.append("scoringRubricFile", scoringRubricFile);
      SECTION_CONFIG.forEach(({ key }) => {
        const fieldName = `${key}RecommendationFile`;
        if (recommendationFiles[key]) {
          formData.append(fieldName, recommendationFiles[key]);
        }
      });

      const authHeader = buildBasicAuthHeader(
        adminCredentials.username.trim(),
        adminCredentials.password.trim()
      );

      const payload = await fetchJson(ADMIN_IMPORT_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: authHeader,
        },
        body: formData,
      });

      const createdTest = payload.test || null;
      setTestName("");
      setScoringRubricFile(null);
      setRecommendationFiles({
        english: null,
        math: null,
        reading: null,
        science: null,
      });
      setAdminUploadResetKey((current) => current + 1);

      await loadPublicTests();
      await loadAdminTests(adminCredentials);

      if (createdTest?.id) {
        setSelectedTestId(String(createdTest.id));
      }

      setAdminSuccess(
        createdTest?.extractionSummary
          ? `Saved test. ${createdTest.extractionSummary}`
          : "Saved test and prepared the scoring and study materials."
      );
    } catch (saveError) {
      setAdminError(
        saveError.message &&
          !/failed to fetch|networkerror|load failed|request failed/i.test(saveError.message)
          ? saveError.message
          : "We could not save the test right now. Please try again."
      );
    } finally {
      setIsSavingTest(false);
    }
  };
  return (
    <div className="app-shell">
      <style>{styles}</style>

      <div className="app-container">
        <header className="app-header">
          <div className="brand-mark">
            <img className="brand-logo" src="/prepmedians-logo.jpg" alt="Prepmedians" />
            <div>
              <p className="brand-title">Prepmedians Score Report</p>
              <p className="brand-subtitle">ACT scoring and study guidance</p>
            </div>
          </div>

          <div className="header-actions">
            {isAdminAuthenticated ? (
              <>
                <div className="educator-profile">
                  <div className="profile-avatar" aria-hidden="true">
                    {adminCredentials.username.slice(0, 1).toUpperCase() || "E"}
                  </div>
                  <div>
                    <p className="profile-name">{adminCredentials.username}</p>
                    <p className="profile-role">Educator</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => setIsAdminOpen((current) => !current)}
                >
                  {isAdminOpen ? "Close Setup" : "Test Setup"}
                </button>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={handleAdminLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setAdminError("");
                  setAdminSuccess("");
                  setIsLoginModalOpen(true);
                }}
              >
                Educator Login
              </button>
            )}
          </div>
        </header>

        {(isLoading || isSavingTest) ? (
          <div className="loading-backdrop" role="dialog" aria-modal="true">
            <div className="loading-modal">
              <div className="loading-ring" aria-hidden="true" />
              <div>
                <h2 className="loading-title">{loadingModal.title}</h2>
                <p className="loading-copy">{loadingModal.copy}</p>
              </div>
              <div className="modal-steps">
                {loadingModal.steps.map((step, index) => (
                  <div
                    key={step}
                    className={`modal-step ${
                      index === loadingStepIndex
                        ? "active"
                        : index < loadingStepIndex
                          ? "complete"
                          : ""
                    }`}
                  >
                    <span className="modal-step-dot" aria-hidden="true" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {isLoginModalOpen && !isAdminAuthenticated ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="educator-login-title">
            <form className="login-modal" onSubmit={handleAdminLogin}>
              <div className="modal-head">
                <div>
                  <h2 id="educator-login-title" className="panel-title">
                    Educator Login
                  </h2>
                  <p className="panel-subtitle">
                    Sign in to manage tests and study materials.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close educator login"
                  onClick={() => setIsLoginModalOpen(false)}
                >
                  x
                </button>
              </div>

              <div className="field">
                <label htmlFor="admin-username">Username</label>
                <input
                  id="admin-username"
                  name="username"
                  className="text-input"
                  type="text"
                  value={adminCredentials.username}
                  onChange={handleAdminCredentialChange}
                  placeholder="Username"
                />
              </div>

              <div className="field">
                <label htmlFor="admin-password">Password</label>
                <input
                  id="admin-password"
                  name="password"
                  className="text-input"
                  type="password"
                  value={adminCredentials.password}
                  onChange={handleAdminCredentialChange}
                  placeholder="Password"
                />
              </div>

              {adminError ? <div className="message error">{adminError}</div> : null}

              <div className="button-row">
                <button type="submit" className="primary-button">
                  Sign In
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <section ref={uploadRef} className="hero-card">
          <div className="hero-top">
            <span className="eyebrow">Prepmedians ACT Results</span>
            <h1 className="hero-title">Upload your answer sheet and get your Prepmedians score report.</h1>
            <p className="hero-copy">
              Pick your test, upload a clear image of your answer sheet, and see
              your section scores, category breakdowns, and recommended study
              plan in one place.
            </p>
            <div className="hero-highlights" aria-label="Report highlights">
              <span className="hero-highlight">Fast score report</span>
              <span className="hero-highlight">Personalized study plan</span>
              <span className="hero-highlight">Built for ACT practice</span>
            </div>
          </div>

          <div className="hero-grid">
            <form className="panel-card upload-card stack" onSubmit={handleUpload}>
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Score Your Test</h2>
                  <p className="panel-subtitle">
                    Choose your test, upload your sheet, and we'll handle the
                    reading and scoring.
                  </p>
                </div>
                <span className="status-chip">
                  {isLoading ? "Scoring" : "Ready"}
                </span>
              </div>

              <div className="field">
                <label htmlFor="student-test-selector">Select test</label>
                <select
                  id="student-test-selector"
                  className="text-input"
                  value={selectedTestId}
                  onChange={(event) => setSelectedTestId(event.target.value)}
                  disabled={testsLoading || !availableTests.length}
                >
                  <option value="">
                    {testsLoading
                      ? "Loading tests..."
                      : availableTests.length
                        ? "Select a test"
                        : "No tests available yet"}
                  </option>
                  {availableTests.map((test) => (
                    <option key={test.id} value={String(test.id)}>
                      {test.name}
                    </option>
                  ))}
                </select>
              </div>

              {testsError ? <div className="message error">{testsError}</div> : null}

              <div className="field">
                <label htmlFor="omr-file">Upload answer sheet</label>
                <div className="file-pick">
                  <input
                    key={`student-upload-${fileInputResetKey}`}
                    id="omr-file"
                    className="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <div className="file-name">
                    {selectedFile ? selectedFile.name : "No image selected yet"}
                  </div>
                </div>
              </div>

              {selectedFilePreviewUrl ? (
                <div className="photo-preview-card">
                  <p className="photo-checklist-title">Preview your photo</p>
                  <img
                    className="photo-preview-image"
                    src={selectedFilePreviewUrl}
                    alt="Selected answer sheet preview"
                  />
                  <p className="helper-text">
                    If the page looks cut off, blurry, or tilted here, try
                    another photo before scoring.
                  </p>
                </div>
              ) : null}

              <div className="photo-checklist" aria-label="Photo checklist">
                <p className="photo-checklist-title">Before you upload, check the photo:</p>
                <div className="photo-checklist-grid">
                  {[
                    "Full page visible",
                    "Good lighting",
                    "No blur",
                    "Sheet not tilted",
                    "Bubbles filled darkly",
                  ].map((item) => (
                    <div key={item} className="photo-check-item">
                      <span className="photo-check-icon" aria-hidden="true">
                        OK
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="photo-guide" aria-hidden="true">
                  <div className="photo-example">
                    <div className="sample-photo">
                      <div className="sample-sheet" />
                    </div>
                    <p className="photo-example-label">Good photo</p>
                  </div>
                  <div className="photo-example">
                    <div className="sample-photo bad">
                      <div className="sample-sheet" />
                    </div>
                    <p className="photo-example-label">Avoid blurry or tilted photos</p>
                  </div>
                </div>
              </div>

              {error ? <div className="message error">{error}</div> : null}
              {uploadSuccess ? (
                <div className="message success">{uploadSuccess}</div>
              ) : null}

              <div className="button-row">
                {results ? (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleViewResults}
                    >
                      See My Results
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleStartOver}
                    >
                      Start a New Scan
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isLoading || !selectedFile || !selectedTestId}
                  >
                    {isLoading ? "Building Your Report..." : "Get My Results"}
                  </button>
                )}
              </div>

              <p className="helper-text">
                Use a straight, well-lit photo with the full page visible for
                the most accurate read.
              </p>
            </form>

            <div className="panel-card insight-card stack">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">What You'll Get</h2>
                  <p className="panel-subtitle">
                    Your report is designed to be easy to read and easy to act on.
                  </p>
                </div>
              </div>

              <div className="endpoint-list">
                <div className="endpoint-item">
                  <strong>Section Scores</strong>
                  <div className="endpoint-url">
                    English, Math, Reading, and Science scores in one report.
                  </div>
                </div>
                <div className="endpoint-item">
                  <strong>Category Breakdown</strong>
                  <div className="endpoint-url">
                    See exactly which question types need the most work.
                  </div>
                </div>
                <div className="endpoint-item">
                  <strong>Study Plan</strong>
                  <div className="endpoint-url">
                    Get targeted Prepmedians modules matched to your weak spots.
                  </div>
                </div>
                <div className="endpoint-item">
                  <strong>Ready-to-Score Tests</strong>
                  <div className="endpoint-url">
                    {testsLoading
                      ? "Loading tests..."
                      : availableTests.length
                        ? `${availableTests.length} tests ready to choose from`
                        : "No tests available yet"}
                  </div>
                </div>
              </div>

              <p className="helper-text">
                You can still review the answers we found if you want a
                question-by-question view.
              </p>
            </div>
          </div>
        </section>

        {results ? (
          <>
            <section ref={resultsRef} className="panel-card score-report-head">
              <div>
                <h2 className="panel-title">Score Report</h2>
                <p className="panel-subtitle">
                  {selectedTest?.name || "Selected test"} results are ready.
                </p>
                <div className="scan-summary">
                  <div className="scan-summary-card">
                    <div className="scan-summary-label">Answers found</div>
                    <div className="scan-summary-value">
                      {resultReadSummary.answered}
                    </div>
                  </div>
                  <div className="scan-summary-card">
                    <div className="scan-summary-label">Blanks</div>
                    <div className="scan-summary-value">
                      {resultReadSummary.blank}
                    </div>
                  </div>
                  <div className="scan-summary-card">
                    <div className="scan-summary-label">Read quality</div>
                    <div className="scan-summary-value">
                      {resultReadSummary.isLowConfidence
                        ? "Needs review"
                        : resultReadSummary.hasManyBlanks
                          ? "Some blanks"
                          : "Looks good"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="score-kpis">
                {scoreSummaryItems.map((item) => (
                  <div key={item.key} className="score-kpi">
                    <div className="score-kpi-label">{item.title}</div>
                    <div className="score-kpi-value">{item.primary}</div>
                    <div className="result-meta">
                      {item.label} | {item.meta}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="results-action-bar">
              <p className="results-action-copy">
                Want to double-check the scan? You can review the detected
                answers or start over with a clearer photo.
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleReviewAnswers}
                >
                  Review Answers
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleBackToUpload}
                >
                  Back to Upload
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleStartOver}
                >
                  Start a New Scan
                </button>
              </div>
            </section>

            {results._status === "partial" || results._warnings?.length ? (
              <section className="message warning">
                <strong>Some answers were hard to read.</strong> Review the
                answer grid before trusting the score.
                {results._warnings?.length ? (
                  <ul className="scan-warning-list">
                    {results._warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            {resultReadSummary.hasManyBlanks && !resultReadSummary.isLowConfidence ? (
              <section className="message warning">
                A lot of blanks were detected. If that does not match your
                sheet, try another photo before relying on the score.
              </section>
            ) : null}

            {resultReadSummary.isLowConfidence ? (
              <section className="low-confidence-card">
                <strong>We could not read enough of this sheet to score it confidently.</strong>
                <span>
                  Try a clearer photo with the full page visible, then scan it
                  again. You can still review the answers we found below.
                </span>
              </section>
            ) : null}

            <section ref={answersRef} className="results-grid">
              {practiceTest1ScoringState.error ? (
                <div className="message error results-banner">
                  {practiceTest1ScoringState.error}
                </div>
              ) : null}

              {SECTION_CONFIG.map(({ key, title, total }) => {
                const answers = Array.isArray(results[key]) ? results[key] : [];
                const counts = countAnswers(answers);
                const sectionScore = practiceTest1ScoringState.scores?.[key] || null;
                const categoryScores = getDisplayedCategoryScores(key, sectionScore);
                const sectionStatus = getSectionScanStatus(counts, total);

                return (
                  <article key={key} className="result-card">
                    <div className="result-head">
                      <div>
                        <h3 className="result-title">{title}</h3>
                        <div className="result-meta">
                          {counts.answered} answered / {counts.blank} blank
                        </div>
                      </div>
                      <span className={`section-status ${sectionStatus.className}`}>
                        {sectionStatus.label}
                      </span>
                    </div>

                    {sectionScore && !resultReadSummary.isLowConfidence ? (
                      <div className="score-summary">
                        <div className="score-overview">
                          <div className="score-pill">
                            <div className="score-label">Questions correct</div>
                            <div className="score-value">
                              {sectionScore.rawScore} / {sectionScore.totalPossible}
                            </div>
                          </div>

                          <div className="score-pill">
                            <div className="score-label">ACT score</div>
                            <div className="score-value">{sectionScore.scaleScore}</div>
                          </div>
                        </div>

                        <div className="score-category-grid">
                          {categoryScores.map((categoryScore) => (
                            <div
                              key={`${key}-${categoryScore.code}`}
                              className="score-category-card"
                            >
                              <div className="score-category-name">
                                {categoryScore.label}
                              </div>
                              <div className="score-category-value">
                                {categoryScore.correct} / {categoryScore.total}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <details
                      className="answer-review"
                      open={isAnswerReviewOpen}
                      onToggle={(event) =>
                        setIsAnswerReviewOpen(event.currentTarget.open)
                      }
                    >
                      <summary>Review answers we found</summary>
                      <p className="helper-text">
                        A dash means we could not detect a clear mark for that
                        question.
                      </p>
                      <div className="answers-grid">
                        {answers.map((value, index) => {
                          const questionNumber = index + 1;
                          const mappedAnswer = mapAnswer(value, questionNumber);
                          const isBlank = mappedAnswer === "-";

                          return (
                            <div
                              key={`${key}-${questionNumber}`}
                              className={`answer-card ${
                                isBlank ? "blank" : "filled"
                              }`}
                            >
                              <div className="answer-question">
                                Q{questionNumber}
                              </div>
                              <div className="answer-value">{mappedAnswer}</div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </article>
                );
              })}
            </section>

            {studyRecommendations && !resultReadSummary.isLowConfidence ? (
              <section className="study-plan-shell">
                <div className="panel-card">
                  <div className="study-plan-header">
                    <h2 className="panel-title">Recommended Study Plan</h2>
                    <p className="study-plan-copy">
                      Based on your category breakdown, these Prepmedians modules
                      start with the areas that can move your score the most.
                    </p>
                  </div>
                </div>

                <div className="study-plan-grid">
                  {SECTION_CONFIG.map(({ key, title }) => {
                    const sectionPlan = studyRecommendations[key];
                    if (!sectionPlan) {
                      return null;
                    }

                    return (
                      <article key={`study-${key}`} className="result-card study-plan-card">
                        <div className="result-head">
                          <div>
                            <h3 className="result-title">{title}</h3>
                            <div className="result-meta">
                              Your recommended modules
                            </div>
                          </div>
                        </div>

                        <div className="study-category-list">
                          {sectionPlan.categories.map((category) => (
                            <div
                              key={`${key}-${category.code}-recommendation`}
                              className="study-category-card"
                            >
                              <div className="study-category-head">
                                <div>
                                  <h4 className="study-category-title">
                                    {category.label}
                                  </h4>
                                  <div className="study-category-score">
                                    {category.score.correct} / {category.score.total}
                                  </div>
                                </div>

                                {category.isFocusArea ? (
                                  <span className="study-priority high">
                                    Focus Area
                                  </span>
                                ) : (
                                  <span className={`study-priority ${category.priority}`}>
                                    {category.priority} priority
                                  </span>
                                )}
                              </div>

                              <p className="study-category-reason">{category.reason}</p>

                              <div className="study-module-list">
                                {category.recommendations.map((item) => (
                                  <div key={item.id} className="study-module-card">
                                    <div className="study-module-head">
                                      <div>
                                        <h5 className="study-module-title">
                                          {item.title}
                                        </h5>
                                        {item.subtitle ? (
                                          <div className="study-module-subtitle">
                                            {item.subtitle}
                                          </div>
                                        ) : null}
                                      </div>
                                      <span
                                        className={`study-priority ${item.priority}`}
                                      >
                                        {item.priority}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="study-strategy-list">
                          <div className="score-category-name">Section strategy</div>
                          {sectionPlan.strategy.map((item) => (
                            <div key={item.id} className="study-strategy-card">
                              <h4 className="study-strategy-title">{item.title}</h4>
                              {item.subtitle ? (
                                <div className="study-module-subtitle">
                                  {item.subtitle}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {apiPreview && isAdminOpen && isAdminAuthenticated ? (
          <section className="preview-card">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Admin Review</h2>
                <p className="panel-subtitle">
                  {apiPreview.endpointLabel}
                </p>
              </div>
              <span className="status-chip">{apiPreview.contentType}</span>
            </div>

            {apiPreview.type === "image" ? (
              <img
                className="preview-image"
                src={apiPreview.data}
                alt={`${apiPreview.endpointLabel} response`}
              />
            ) : (
              <pre className="preview-code">
                {apiPreview.type === "json"
                  ? JSON.stringify(apiPreview.data, null, 2)
                  : apiPreview.data}
              </pre>
            )}
          </section>
        ) : null}

        {!results && (!apiPreview || !isAdminOpen || !isAdminAuthenticated) ? (
          <section className="panel-card">
            <div className="empty-state">
              Upload your answer sheet to get your score report and study plan.
            </div>
          </section>
        ) : null}

        {isAdminOpen && isAdminAuthenticated ? (
          <section className="admin-grid">
            <div className="panel-card stack">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Test Setup</h2>
                  <p className="panel-subtitle">
                    Add a new ACT test by uploading its scoring guide and the
                    four subject study-material PDFs.
                  </p>
                </div>
                <span className="status-chip">
                  Ready
                </span>
              </div>

              <form className="stack" onSubmit={handleSaveTest}>
                  <div className="field">
                    <label htmlFor="test-name">Test name</label>
                    <input
                      id="test-name"
                      className="text-input"
                      type="text"
                      value={testName}
                      onChange={(event) => setTestName(event.target.value)}
                      placeholder="ACT Practice Test 01"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="scoring-rubric-upload">Scoring guide PDF</label>
                    <input
                      key={`scoring-rubric-${adminUploadResetKey}`}
                      id="scoring-rubric-upload"
                      className="file-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(event) =>
                        setScoringRubricFile(event.target.files?.[0] || null)
                      }
                    />
                    <div className="file-name">
                      {scoringRubricFile
                        ? scoringRubricFile.name
                        : "No scoring guide selected yet"}
                    </div>
                  </div>

                  <div className="field">
                    <label>Study-material PDFs</label>
                    <div className="stack">
                      {SECTION_CONFIG.map(({ key, title }) => (
                        <div key={`recommendation-${key}`} className="field">
                          <label htmlFor={`${key}-recommendation-upload`}>
                            {title} study materials
                          </label>
                          <input
                            key={`${key}-recommendation-${adminUploadResetKey}`}
                            id={`${key}-recommendation-upload`}
                            className="file-input"
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(event) =>
                              handleRecommendationFileChange(
                                key,
                                event.target.files?.[0] || null
                              )
                            }
                          />
                          <div className="file-name">
                            {recommendationFiles[key]
                              ? recommendationFiles[key].name
                              : `No ${title.toLowerCase()} study-material PDF selected yet`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {adminError ? (
                    <div className="message error">{adminError}</div>
                  ) : null}
                  {adminSuccess ? (
                    <div className="message success">{adminSuccess}</div>
                  ) : null}

                  <div className="button-row">
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={isSavingTest}
                    >
                      {isSavingTest ? "Saving Test..." : "Save Test"}
                    </button>
                  </div>

                  <p className="helper-text">
                    Upload one scoring guide plus four subject study-material
                    PDFs. The app will prepare a shared test that students can
                    choose from.
                  </p>
              </form>
            </div>

            <div className="panel-card stack">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Test Library</h2>
                  <p className="panel-subtitle">
                    These tests are available to students from the test selector.
                  </p>
                </div>
                <span className="status-chip">
                  {savedTests.length} total
                </span>
              </div>

              {savedTests.length ? (
                <div className="saved-tests">
                  {savedTests.map((test) => (
                    <article key={test.id} className="saved-test-card">
                      <div>
                        <h3 className="saved-test-title">{test.name}</h3>
                        <div className="saved-test-date">
                          {formatSavedDate(test.createdAt)}
                        </div>
                      </div>

                      <div className="helper-text">
                        Scoring guide: {test.sourceFilename || "Manual setup"}
                        {test.extractionSummary ? ` | ${test.extractionSummary}` : ""}
                      </div>

                      {Object.keys(test.recommendationFilenames || {}).length ? (
                        <div className="helper-text">
                          Study-material PDFs:{" "}
                          {Object.entries(test.recommendationFilenames)
                            .map(([sectionKey, filename]) => `${sectionKey}: ${filename}`)
                            .join(" | ")}
                        </div>
                      ) : null}

                      <div className="saved-test-sections">
                        {SECTION_CONFIG.map(({ key, title }) => {
                          const counts = test.sectionCounts?.[key];

                          return (
                            <div key={`${test.id}-${key}`} className="saved-section-pill">
                              {title}: {counts?.total || 0} total / {counts?.blank || 0} blank
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              ) : availableTests.length ? (
                <div className="saved-tests">
                  {availableTests.map((test) => (
                    <article key={test.id} className="saved-test-card">
                      <div>
                        <h3 className="saved-test-title">{test.name}</h3>
                        <div className="saved-test-date">
                          {formatSavedDate(test.createdAt)}
                        </div>
                      </div>

                      <div className="saved-test-sections">
                        {SECTION_CONFIG.map(({ key, title }) => {
                          const counts = test.sectionCounts?.[key];

                          return (
                            <div key={`${test.id}-${key}`} className="saved-section-pill">
                              {title}: {counts?.total || 0} answers
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  No shared tests yet. Upload the first scoring guide to get started.
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
