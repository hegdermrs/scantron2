import React, { useEffect, useMemo, useRef, useState } from "react";

const BACKEND_BASE_URL = (
  import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5000"
).replace(/\/$/, "");
const PARSE_API_URL =
  import.meta.env.VITE_PARSE_API_URL ||
  "https://rmrs.app.n8n.cloud/webhook/omr-upload";
const TESTS_ENDPOINT = `${BACKEND_BASE_URL}/tests`;
const ADMIN_TESTS_ENDPOINT = `${BACKEND_BASE_URL}/admin/tests`;
const ADMIN_IMPORT_ENDPOINT = `${BACKEND_BASE_URL}/admin/tests/import-pdf`;

const API_ENDPOINTS = {
  preprocess: {
    label: "Preprocess OMR",
    url: `${BACKEND_BASE_URL}/preprocess-omr`,
    successMessage: "Preprocess request completed.",
  },
  split: {
    label: "Split OMR",
    url: `${BACKEND_BASE_URL}/split-omr`,
    successMessage: "Split request completed.",
  },
  parse: {
    label: "Parse Answers",
    url: PARSE_API_URL,
    successMessage: "Answer parsing completed.",
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
    --bg: #f4efe7;
    --bg-accent: #e5ddd1;
    --surface: rgba(255, 255, 255, 0.78);
    --surface-strong: rgba(255, 255, 255, 0.92);
    --line: rgba(59, 48, 36, 0.12);
    --text: #211b15;
    --muted: #766657;
    --shadow: 0 24px 80px rgba(41, 27, 15, 0.12);
    --shadow-soft: 0 16px 40px rgba(41, 27, 15, 0.08);
    --accent: #1f6f5f;
    --accent-soft: #d8eee9;
    --danger: #b64747;
    --danger-soft: #f8e0e0;
    --blank: #c4b8aa;
    --filled: #201c17;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    background:
      radial-gradient(circle at top left, rgba(255, 255, 255, 0.95), transparent 30%),
      radial-gradient(circle at bottom right, rgba(31, 111, 95, 0.18), transparent 28%),
      linear-gradient(135deg, var(--bg) 0%, #f8f5ef 44%, var(--bg-accent) 100%);
    color: var(--text);
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  .app-shell {
    min-height: 100vh;
    padding: 32px 20px 56px;
    position: relative;
    overflow: hidden;
  }

  .app-shell::before,
  .app-shell::after {
    content: "";
    position: absolute;
    border-radius: 999px;
    filter: blur(4px);
    opacity: 0.65;
    pointer-events: none;
  }

  .app-shell::before {
    width: 280px;
    height: 280px;
    top: -70px;
    right: -80px;
    background: rgba(31, 111, 95, 0.12);
    animation: float 8s ease-in-out infinite;
  }

  .app-shell::after {
    width: 220px;
    height: 220px;
    bottom: 80px;
    left: -70px;
    background: rgba(158, 113, 54, 0.08);
    animation: float 10s ease-in-out infinite reverse;
  }

  .app-container {
    width: min(1200px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 24px;
    position: relative;
    z-index: 1;
  }

  .hero-card,
  .panel-card,
  .result-card,
  .answer-card,
  .saved-test-card {
    background: var(--surface);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255, 255, 255, 0.58);
    box-shadow: var(--shadow-soft);
  }

  .hero-card {
    border-radius: 28px;
    padding: 28px;
    display: grid;
    gap: 24px;
    animation: rise 0.7s ease both;
  }

  .hero-top {
    display: grid;
    gap: 12px;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(31, 111, 95, 0.1);
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero-title {
    margin: 0;
    font-size: clamp(2rem, 4vw, 3.6rem);
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  .hero-copy {
    margin: 0;
    max-width: 720px;
    color: var(--muted);
    font-size: 1.02rem;
    line-height: 1.6;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
    gap: 20px;
  }

  .panel-card {
    border-radius: 24px;
    padding: 22px;
    animation: rise 0.85s ease both;
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 18px;
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
    background: rgba(31, 111, 95, 0.1);
    color: var(--accent);
    font-weight: 700;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  .stack {
    display: grid;
    gap: 14px;
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
    border-radius: 16px;
    border: 1px solid var(--line);
    padding: 14px 16px;
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

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .primary-button,
  .secondary-button {
    border: 0;
    border-radius: 16px;
    padding: 14px 18px;
    cursor: pointer;
    transition: transform 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
    font-weight: 700;
  }

  .primary-button {
    background: linear-gradient(135deg, #1f6f5f 0%, #164e42 100%);
    color: white;
    box-shadow: 0 12px 26px rgba(31, 111, 95, 0.22);
  }

  .secondary-button {
    background: rgba(32, 28, 23, 0.08);
    color: var(--text);
  }

  .primary-button:hover,
  .secondary-button:hover {
    transform: translateY(-1px);
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

  .message {
    border-radius: 18px;
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

  .results-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .result-card {
    border-radius: 22px;
    padding: 20px;
    display: grid;
    gap: 18px;
    animation: rise 0.75s ease both;
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
    grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
    gap: 10px;
  }

  .answer-card {
    border-radius: 18px;
    padding: 12px;
    min-height: 72px;
    display: grid;
    align-content: center;
    gap: 6px;
    border: 1px solid rgba(59, 48, 36, 0.08);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }

  .answer-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(41, 27, 15, 0.08);
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
    border-radius: 24px;
    padding: 22px;
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
    border-radius: 20px;
    border: 1px solid rgba(59, 48, 36, 0.08);
    background: rgba(255, 255, 255, 0.72);
  }

  .preview-code {
    margin: 0;
    border-radius: 18px;
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
    padding: 14px 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid rgba(59, 48, 36, 0.08);
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
    border-radius: 20px;
    padding: 18px;
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
    border-radius: 14px;
    padding: 10px 12px;
    background: rgba(32, 28, 23, 0.05);
    font-size: 0.88rem;
    color: var(--muted);
  }

  .empty-state {
    padding: 26px 18px;
    border-radius: 20px;
    border: 1px dashed rgba(59, 48, 36, 0.18);
    color: var(--muted);
    text-align: center;
    background: rgba(255, 255, 255, 0.42);
  }

  .loader-row {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .loader-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: currentColor;
    animation: pulse 1s ease-in-out infinite;
  }

  .loader-dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .loader-dot:nth-child(3) {
    animation-delay: 0.3s;
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

  @keyframes float {
    0%, 100% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(0, 14px, 0);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (max-width: 980px) {
    .hero-grid,
    .results-grid,
    .admin-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .app-shell {
      padding: 18px 14px 40px;
    }

    .hero-card,
    .panel-card,
    .result-card {
      padding: 18px;
      border-radius: 22px;
    }

    .panel-head,
    .result-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .answers-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .saved-test-sections {
      grid-template-columns: 1fr;
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

function validateAnswerKeyPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return SECTION_CONFIG.every(({ key }) => Array.isArray(payload[key]));
}

function formatSavedDate(isoDate) {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [availableTests, setAvailableTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState("");
  const [results, setResults] = useState(null);
  const [apiPreview, setApiPreview] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [testName, setTestName] = useState("");
  const [answerKeyFile, setAnswerKeyFile] = useState(null);
  const [savedTests, setSavedTests] = useState([]);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const answerKeyInputRef = useRef(null);

  const selectedTest = useMemo(
    () =>
      availableTests.find((test) => String(test.id) === String(selectedTestId)) ||
      null,
    [availableTests, selectedTestId]
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
      setTestsError(loadError.message || "Could not load tests from the server.");
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

  useEffect(() => {
    loadPublicTests();
  }, []);

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

  const runEndpointAction = async (actionKey) => {
    if (!selectedFile) {
      setError("Please select an image before submitting.");
      return;
    }

    if (actionKey === "parse" && !selectedTestId) {
      setError("Please choose a test before parsing student answers.");
      return;
    }

    const endpoint = API_ENDPOINTS[actionKey];
    setIsLoading(true);
    setActiveAction(endpoint.label);
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
          `${endpoint.label} failed with status ${response.status}`
        );
      }

      const payload = await readApiResponse(response);

      if (payload.type === "json" && validateAnswerKeyPayload(payload.data)) {
        setResults(payload.data);
      } else {
        setApiPreview({
          ...payload,
          endpointLabel: endpoint.label,
          endpointUrl: endpoint.url,
        });
      }

      setUploadSuccess(endpoint.successMessage);
    } catch (uploadError) {
      setError(uploadError.message || "Something went wrong while uploading.");
    } finally {
      setIsLoading(false);
      setActiveAction("");
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

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    try {
      await loadAdminTests(adminCredentials);
      setIsAdminAuthenticated(true);
      setAdminSuccess("Admin access unlocked.");
    } catch (loginError) {
      setIsAdminAuthenticated(false);
      setSavedTests([]);
      setAdminError(loginError.message || "Invalid admin credentials.");
    }
  };

  const handleSaveTest = async (event) => {
    event.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!testName.trim()) {
      setAdminError("Add a test name before saving.");
      return;
    }

    if (!answerKeyFile) {
      setAdminError("Upload a PDF that contains the answer key.");
      return;
    }

    setIsSavingTest(true);

    try {
      const formData = new FormData();
      formData.append("name", testName.trim());
      formData.append("file", answerKeyFile);

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
      setAnswerKeyFile(null);

      if (answerKeyInputRef.current) {
        answerKeyInputRef.current.value = "";
      }

      await loadPublicTests();
      await loadAdminTests(adminCredentials);

      if (createdTest?.id) {
        setSelectedTestId(String(createdTest.id));
      }

      setAdminSuccess(
        createdTest?.extractionSummary
          ? `Saved test. ${createdTest.extractionSummary}`
          : "Saved test and extracted answer keys."
      );
    } catch (saveError) {
      setAdminError(saveError.message || "Could not import the answer key PDF.");
    } finally {
      setIsSavingTest(false);
    }
  };

  return (
    <div className="app-shell">
      <style>{styles}</style>

      <div className="app-container">
        <section className="hero-card">
          <div className="hero-top">
            <span className="eyebrow">OMR Workflow</span>
            <h1 className="hero-title">Shared tests, clean uploads, faster review.</h1>
            <p className="hero-copy">
              Students pick from server-backed tests before uploading. Admins
              import answer-key PDFs, let AI extract the answers, and publish
              tests everyone can access.
            </p>
          </div>

          <div className="hero-grid">
            <form className="panel-card stack" onSubmit={handleUpload}>
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Student Upload</h2>
                  <p className="panel-subtitle">
                    Choose a test, upload an image, then preprocess, split, or
                    parse the student responses.
                  </p>
                </div>
                <span className="status-chip">
                  {isLoading ? activeAction || "Processing" : "Ready"}
                </span>
              </div>

              <div className="field">
                <label htmlFor="student-test-selector">Test selector</label>
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
                        ? "Choose a test"
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
                <label htmlFor="omr-file">OMR sheet image</label>
                <div className="file-pick">
                  <input
                    id="omr-file"
                    className="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <div className="file-name">
                    {selectedFile ? selectedFile.name : "No file selected"}
                  </div>
                </div>
              </div>

              {selectedTest ? (
                <div className="saved-test-sections">
                  {SECTION_CONFIG.map(({ key, title }) => {
                    const counts = selectedTest.sectionCounts?.[key];
                    return (
                      <div key={key} className="saved-section-pill">
                        {title}: {counts?.total || 0} answers
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {error ? <div className="message error">{error}</div> : null}
              {uploadSuccess ? (
                <div className="message success">{uploadSuccess}</div>
              ) : null}

              <div className="button-row">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isLoading || !selectedFile || !selectedTestId}
                >
                  {isLoading && activeAction === API_ENDPOINTS.parse.label
                    ? "Parsing Sheet..."
                    : "Parse Answers"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={isLoading || !selectedFile}
                  onClick={() => runEndpointAction("preprocess")}
                >
                  {isLoading && activeAction === API_ENDPOINTS.preprocess.label
                    ? "Preprocessing..."
                    : "Preprocess OMR"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={isLoading || !selectedFile}
                  onClick={() => runEndpointAction("split")}
                >
                  {isLoading && activeAction === API_ENDPOINTS.split.label
                    ? "Splitting..."
                    : "Split OMR"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsAdminOpen((current) => !current)}
                >
                  {isAdminOpen ? "Hide Admin" : "Open Admin Panel"}
                </button>
              </div>

              {isLoading ? (
                <div className="message success">
                  <span className="loader-row">
                    <span className="loader-dot" />
                    <span className="loader-dot" />
                    <span className="loader-dot" />
                  </span>{" "}
                  {activeAction || "Processing your OMR sheet"} now.
                </div>
              ) : (
                <p className="helper-text">
                  Parse uses the published n8n webhook. Preprocess and split use
                  your FastAPI backend. Test metadata is loaded from the server.
                </p>
              )}
            </form>

            <div className="panel-card stack">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Current Setup</h2>
                  <p className="panel-subtitle">
                    The upload UI is now connected to shared tests and backend
                    services.
                  </p>
                </div>
              </div>

              <div className="endpoint-list">
                <div className="endpoint-item">
                  <strong>Published Tests</strong>
                  <div className="endpoint-url">
                    {testsLoading
                      ? "Loading from server..."
                      : `${availableTests.length} available`}
                  </div>
                </div>
                <div className="endpoint-item">
                  <strong>Preprocess OMR</strong>
                  <div className="endpoint-url">
                    {API_ENDPOINTS.preprocess.url}
                  </div>
                </div>
                <div className="endpoint-item">
                  <strong>Split OMR</strong>
                  <div className="endpoint-url">{API_ENDPOINTS.split.url}</div>
                </div>
                <div className="endpoint-item">
                  <strong>Parse Answers</strong>
                  <div className="endpoint-url">{API_ENDPOINTS.parse.url}</div>
                </div>
              </div>

              <p className="helper-text">
                Odd questions map to A-D. Even questions map to F-J. Blank or
                missing answers render as a hyphen.
              </p>
            </div>
          </div>
        </section>

        {results ? (
          <section className="results-grid">
            {SECTION_CONFIG.map(({ key, title, total }) => {
              const answers = Array.isArray(results[key]) ? results[key] : [];
              const counts = countAnswers(answers);

              return (
                <article key={key} className="result-card">
                  <div className="result-head">
                    <div>
                      <h3 className="result-title">{title}</h3>
                      <div className="result-meta">
                        {counts.answered} answered / {counts.blank} blank
                      </div>
                    </div>
                    <span className="status-chip">
                      {answers.length || total} questions
                    </span>
                  </div>

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
                </article>
              );
            })}
          </section>
        ) : null}

        {apiPreview ? (
          <section className="preview-card">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">{apiPreview.endpointLabel} Output</h2>
                <p className="panel-subtitle">
                  {apiPreview.endpointUrl}
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

        {!results && !apiPreview ? (
          <section className="panel-card">
            <div className="empty-state">
              Upload an OMR image to parse answers or inspect preprocess and
              split outputs here.
            </div>
          </section>
        ) : null}

        {isAdminOpen ? (
          <section className="admin-grid">
            <div className="panel-card stack">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Admin Panel</h2>
                  <p className="panel-subtitle">
                    Upload a PDF answer key, let AI extract the answers, and
                    publish the test to the server.
                  </p>
                </div>
                <span className="status-chip">
                  {isAdminAuthenticated ? "Unlocked" : "Locked"}
                </span>
              </div>

              {!isAdminAuthenticated ? (
                <form className="stack" onSubmit={handleAdminLogin}>
                  <div className="field">
                    <label htmlFor="admin-username">Username</label>
                    <input
                      id="admin-username"
                      name="username"
                      className="text-input"
                      type="text"
                      value={adminCredentials.username}
                      onChange={handleAdminCredentialChange}
                      placeholder="admin"
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
                      placeholder="omr123"
                    />
                  </div>

                  {adminError ? (
                    <div className="message error">{adminError}</div>
                  ) : null}
                  {adminSuccess ? (
                    <div className="message success">{adminSuccess}</div>
                  ) : null}

                  <div className="button-row">
                    <button type="submit" className="primary-button">
                      Login
                    </button>
                  </div>

                  <p className="helper-text">
                    Default demo access matches the backend env defaults:
                    admin / omr123
                  </p>
                </form>
              ) : (
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
                    <label htmlFor="answer-key-upload">Answer key PDF</label>
                    <input
                      ref={answerKeyInputRef}
                      id="answer-key-upload"
                      className="file-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(event) =>
                        setAnswerKeyFile(event.target.files?.[0] || null)
                      }
                    />
                    <div className="file-name">
                      {answerKeyFile
                        ? answerKeyFile.name
                        : "No answer key PDF selected"}
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
                      {isSavingTest ? "Extracting + Saving..." : "Import PDF Test"}
                    </button>
                  </div>

                  <p className="helper-text">
                    The backend stores tests on the server so every student can
                    see them in the shared selector.
                  </p>
                </form>
              )}
            </div>

            <div className="panel-card stack">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Server Tests</h2>
                  <p className="panel-subtitle">
                    Loaded from the backend, not browser local storage.
                  </p>
                </div>
                <span className="status-chip">
                  {isAdminAuthenticated ? savedTests.length : availableTests.length} total
                </span>
              </div>

              {isAdminAuthenticated && savedTests.length ? (
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
                        Source: {test.sourceFilename || "Manual import"}
                        {test.extractionSummary ? ` | ${test.extractionSummary}` : ""}
                      </div>

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
                  No server-backed tests yet. Import the first answer-key PDF.
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
