# SmartFlow AI — Full System Flow Documentation

This document explains the complete flow of the application: from what the user does in the UI, through the tRPC layer, into the server services, what gets sent to Claude (Anthropic API), what comes back, and how it is rendered.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Tech Stack Summary](#2-tech-stack-summary)
3. [Entry Point — Dashboard (index.tsx)](#3-entry-point--dashboard-indextsx)
4. [Tool 1 — Service Blueprinting Tool](#4-tool-1--service-blueprinting-tool)
   - 4.1 [File Upload Flow](#41-file-upload-flow)
   - 4.2 [tRPC: extractText](#42-trpc-extracttext)
   - 4.3 [tRPC: analyzeBlueprint](#43-trpc-analyzeblueprint)
   - 4.4 [Claude Calls inside BlueprintAnalyzer](#44-claude-calls-inside-blueprintanalyzer)
   - 4.5 [UI Rendering of Blueprint Results](#45-ui-rendering-of-blueprint-results)
5. [Tool 2 — SmartFlow (Process Optimizer)](#5-tool-2--smartflow-process-optimizer)
   - 5.1 [Phase 1 — Diagnose (Upload + Extract + Diagnose)](#51-phase-1--diagnose-upload--extract--diagnose)
   - 5.2 [tRPC: extractAndDiagnose](#52-trpc-extractanddiagnose)
   - 5.3 [Claude Call 1 — PDF Extraction (Native Document Block)](#53-claude-call-1--pdf-extraction-native-document-block)
   - 5.4 [Claude Call 1b — Vision Fallback (Image Blocks)](#54-claude-call-1b--vision-fallback-image-blocks)
   - 5.5 [Claude Call 2 — Diagnose Process](#55-claude-call-2--diagnose-process)
   - 5.6 [UI After Diagnose](#56-ui-after-diagnose)
   - 5.7 [Phase 2 — Optimize](#57-phase-2--optimize)
   - 5.8 [tRPC: optimizeProcess](#58-trpc-optimizeprocess)
   - 5.9 [Claude Call 3 — Generate Optimized Graph](#59-claude-call-3--generate-optimized-graph)
   - 5.10 [UI After Optimize](#510-ui-after-optimize)
   - 5.11 [Phase 3 — SOP Generation](#511-phase-3--sop-generation)
   - 5.12 [tRPC: generateSOP](#512-trpc-generatesop)
   - 5.13 [Claude Call 4 — Generate SOP Document](#513-claude-call-4--generate-sop-document)
   - 5.14 [UI: SOP Rendering](#514-ui-sop-rendering)
6. [tRPC Architecture Deep Dive](#6-trpc-architecture-deep-dive)
7. [Mermaid Diagram Rendering](#7-mermaid-diagram-rendering)
8. [Environment and Configuration](#8-environment-and-configuration)
9. [Request/Response Full Examples](#9-requestresponse-full-examples)

---

## 1. High-Level Architecture

```
Browser (React / Next.js)
        │
        │  tRPC HTTP calls to /api/trpc
        │
Next.js API Route  (/pages/api/trpc/[trpc].ts)
        │
        │  routes to appRouter
        │
tRPC Routers
  ├── blueprintRouter       → BlueprintAnalyzer service
  └── processOptimizerRouter → ProcessOptimizer service
                                        │
                                        │  Anthropic SDK (@anthropic-ai/sdk)
                                        │
                                  Claude API (claude-sonnet-4-5-20250929)
```

The app has two tools:
- **Service Blueprinting Tool** — analyzes Dubai Government service blueprints
- **SmartFlow** — RTA (Roads & Transport Authority) process optimization with full SOP generation

Both tools follow the same pattern:
1. User uploads a file (PDF or TXT)
2. Browser sends a tRPC mutation with the file content
3. Server service calls Claude one or more times
4. Results are returned through tRPC
5. UI renders charts (Mermaid), tables, cards, and markdown

---

## 2. Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (Pages Router) |
| API Layer | tRPC v11 (type-safe RPC over HTTP) |
| State / Data fetching | TanStack React Query v5 (via tRPC) |
| Serialization | superjson (handles Date, Map, etc.) |
| AI Provider | Anthropic Claude (`claude-sonnet-4-5-20250929`) |
| PDF Parsing | `pdfjs-dist` (server-side text), `pdf2pic` / `node-canvas` (image fallback) |
| Diagrams | Mermaid.js (client-side SVG rendering) |
| Styling | Tailwind CSS v4 |
| Validation | Zod (request input + env vars) |

---

## 3. Entry Point — Dashboard (index.tsx)

The root page (`/`) renders a sidebar + two `AgentCard` components:

```
┌──────────────────────────────────────────────────┐
│  SIA Logo  │  Favorites nav                       │
│            │                                      │
│            │  ┌────────────────┐  ┌────────────┐  │
│            │  │ Service        │  │ SmartFlow  │  │
│            │  │ Blueprinting   │  │            │  │
│            │  │ Tool           │  │            │  │
│            │  └────────────────┘  └────────────┘  │
└──────────────────────────────────────────────────┘
```

Each `AgentCard` is a Next.js `<Link>` that navigates to `/blueprint` or `/process-optimizer`.

---

## 4. Tool 1 — Service Blueprinting Tool

### 4.1 File Upload Flow

**File:** `src/pages/blueprint.tsx`

1. User drags and drops a PDF or TXT file onto the dropzone (max 10 MB).
2. `onDrop` callback fires with a `File` object.
3. The file is read in the browser using the `FileReader` API as a `data:` URL (for PDFs) or plain text (for TXT).
4. The `fileContent` string, `fileName`, and `fileType` are stored in React state.
5. On the next render, a button appears: **"Extract Text"** → triggers `extractText` mutation.

### 4.2 tRPC: extractText

**Router:** `src/server/api/routers/blueprint.ts`  
**Procedure:** `extractText` (mutation)

**Input Zod schema:**
```ts
z.object({
  fileContent: z.string(),   // base64 data URL or plain text
  fileName:    z.string(),   // e.g. "service-blueprint.pdf"
  fileType:    z.string(),   // e.g. "application/pdf"
})
```

**Server logic:**
1. Reconstructs a `File` object from `fileContent` (decodes base64 if PDF).
2. Calls `BlueprintAnalyzer.extractText(file)`.
3. Inside `extractText`: uses `pdfjs-dist` server-side to iterate pages and extract text content.
4. Returns the full extracted text string.

**Response:**
```ts
{
  text: string   // full plain text extracted from the document
}
```

The extracted text is stored in `extractedText` state and shown in a preview panel.

---

### 4.3 tRPC: analyzeBlueprint

**Procedure:** `analyzeBlueprint` (mutation)

**Input Zod schema:**
```ts
z.object({
  content: z.string()   // the extractedText from the previous step
})
```

**Server logic (inside `BlueprintAnalyzer.generateAllOptions`):**

All these Claude calls fire in parallel via `Promise.all`:
1. `analyzeCurrentState(content)` → `BlueprintAnalysis`
2. `generateImprovementOption(analysis, "efficiency-focused")` → option 1 text
3. `generateImprovementOption(analysis, "citizen-experience-focused")` → option 2 text
4. `generateImprovementOption(analysis, "digital-transformation-focused")` → option 3 text
5. `createCurrentJourneyDiagram(analysis)` → Mermaid `journey` diagram for current state
6. `createFutureJourneyDiagram([opt1, opt2, opt3])` → 3 future-state diagrams

Then sequentially:  
7. `evaluateBestOption(opt1, opt2, opt3)` → returns "1", "2", or "3"

**Response type `AnalysisResults`:**
```ts
{
  currentAnalysis:     BlueprintAnalysis,
  options:             ImprovementOption[],   // 3 options
  currentDiagram:      string,                // Mermaid code
  futureDiagrams:      string[],              // 3 Mermaid codes
  bestOption:          number,                // 1 | 2 | 3
}
```

---

### 4.4 Claude Calls inside BlueprintAnalyzer

**Model used for all calls:** `claude-sonnet-4-5-20250929`

#### Call A — analyzeCurrentState

**What is sent to Claude:**
```
System: You are an expert in Dubai Government service design and blueprint analysis.

User:
Analyze this service blueprint and extract:
1. Current customer touchpoints
2. Pain points and inefficiencies
3. Key stakeholders
4. Process flow steps

Respond in this format:
TOUCHPOINTS: [comma-separated list]
PAIN_POINTS: [comma-separated list]
STAKEHOLDERS: [comma-separated list]
PROCESS_STEPS: [comma-separated list]

Blueprint content:
<content passed in>
```

**`max_tokens`:** 1000  
**What Claude returns:** Free-text with the labeled sections.  
**How it is parsed:** Regex/string split on `TOUCHPOINTS:`, `PAIN_POINTS:`, etc. → stored in `BlueprintAnalysis` object.

---

#### Call B — generateImprovementOption (×3 in parallel)

**What is sent to Claude (example for efficiency-focused):**
```
System: You are a Dubai Government service improvement specialist.

User:
Based on this blueprint analysis, generate an efficiency-focused improvement option.
Focus on: reducing processing time, eliminating waste, streamlining approvals.
Consider: Arabic language support, Policy 360 alignment, UAE Vision 2031.

Current analysis:
- Touchpoints: [...]
- Pain points: [...]
- Stakeholders: [...]
- Steps: [...]

Provide specific, actionable improvements in 3-5 sentences.
```

**`max_tokens`:** 800  
**What Claude returns:** A paragraph of recommendations.  
**Stored as:** `option.content` (plain text displayed in a card)

---

#### Call C — createCurrentJourneyDiagram

**What is sent to Claude:**
```
User:
Create a Mermaid journey diagram for the current state of this service.
Rules:
- Use "journey" diagram type
- Score tasks 1-5 (current state should show low scores 1-3)
- Keep section names under 20 characters
- Include: Customer, Staff, System actors
- Return ONLY the mermaid code, no explanation

Analysis:
[touchpoints, steps, pain points]
```

**`max_tokens`:** 400  
**What Claude returns:** Raw Mermaid code (possibly wrapped in ` ```mermaid ``` ` fences).  
**Post-processing:** Strip the fences, keep pure Mermaid syntax.

---

#### Call D — createFutureJourneyDiagram (×3 in parallel)

Same structure as Call C but:
- Scores are 3–5 (showing improvement)
- Incorporates the specific improvement option text

---

#### Call E — evaluateBestOption

**What is sent to Claude:**
```
User:
You are evaluating three service improvement options for a Dubai Government context.

Option 1: [text]
Option 2: [text]
Option 3: [text]

Which option best fits Dubai Government's priorities (efficiency, citizen experience, digital transformation)?
Respond with ONLY the number: 1, 2, or 3
```

**`max_tokens`:** 50  
**What Claude returns:** `"1"`, `"2"`, or `"3"`  
**Used for:** Highlighting the recommended option with a badge in the UI.

---

### 4.5 UI Rendering of Blueprint Results

After `analyzeBlueprint` returns, the UI shows:

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT STATE DIAGRAM                                       │
│  [MermaidDiagram component — journey chart]                  │
├───────────────┬───────────────┬─────────────────────────────┤
│  Option 1     │  Option 2     │  Option 3  ★ RECOMMENDED    │
│  Efficiency   │  Citizen UX   │  Digital Transform          │
│               │               │                             │
│  [Future      │  [Future      │  [Future                    │
│   Mermaid]    │   Mermaid]    │   Mermaid]                  │
│               │               │                             │
│  [Details ▼]  │  [Details ▼]  │  [Details ▼]               │
└───────────────┴───────────────┴─────────────────────────────┘
```

Each card:
- Shows its focus type label
- Renders the future-state journey diagram via `<MermaidDiagram>`
- Has a collapsible section with the full recommendation text
- The `bestOption` card gets an amber `★ RECOMMENDED` badge

---

## 5. Tool 2 — SmartFlow (Process Optimizer)

This is the main tool. It has a 3-phase workflow.

### 5.1 Phase 1 — Diagnose (Upload + Extract + Diagnose)

**File:** `src/pages/process-optimizer.tsx`

1. User drags a PDF (or TXT) onto the dropzone.
2. For **PDF files**, the browser converts the file to base64 using a chunked approach:
   ```ts
   // Reads ArrayBuffer, then chunks to avoid stack overflow on large files
   const CHUNK = 8192;
   let binary = "";
   for (let i = 0; i < bytes.length; i += CHUNK) {
     binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
   }
   const base64 = btoa(binary);
   ```
3. Calls `processOptimizer.extractAndDiagnose` — a **single combined tRPC mutation** that does extraction + analysis + diagnosis in one round trip (3–4× faster than separate calls).

---

### 5.2 tRPC: extractAndDiagnose

**Router:** `src/server/api/routers/processOptimizer.ts`  
**Procedure:** `extractAndDiagnose` (mutation)

**Input Zod schema:**
```ts
z.object({
  fileContent: z.string(),   // base64 encoded PDF
  fileName:    z.string(),
  fileType:    z.string(),   // "application/pdf" | "text/plain"
})
```

**Server logic:**
1. Calls `optimizer.extractTextFromBase64(fileContent, fileType)` → `ProcessAnalysis`
2. Calls `optimizer.diagnoseProcess(analysis)` → `ProcessDiagnosis`
3. Calls `optimizer.createCurrentProcessDiagram(analysis)` → Mermaid string
4. Returns combined result

**Response:**
```ts
{
  extractedText:  string,           // raw text (for debug)
  analysis:       ProcessAnalysis,  // structured process data
  diagnosis:      ProcessDiagnosis, // bottlenecks, quick wins, etc.
  currentMermaid: string,           // Mermaid flowchart LR code
}
```

---

### 5.3 Claude Call 1 — PDF Extraction (Native Document Block)

This is the most important call. Claude is sent the raw PDF file directly.

**What is sent to Claude:**
```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 8192,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "document",
          "source": {
            "type": "base64",
            "media_type": "application/pdf",
            "data": "<base64 encoded PDF bytes>"
          }
        },
        {
          "type": "text",
          "text": "Extract all process information from this document and return ONLY valid JSON..."
        }
      ]
    }
  ]
}
```

**The text prompt instructs Claude to extract:**
```
Return ONLY valid JSON matching this exact structure:
{
  "processName": "string",
  "department": "string",
  "processOwner": "string",
  "nodes": [
    { "id": "string", "label": "string", "type": "start|end|process|decision|io" }
  ],
  "edges": [
    { "from": "string", "to": "string", "label": "string (optional)" }
  ],
  "activitiesTable": [
    {
      "stepId":        "CS.H.3.1.01",
      "stepName":      "string",
      "performedBy":   "string",
      "actualTime":    "string",   // e.g. "2 Working Days"
      "availableTime": "string"
    }
  ],
  "sipoc": {
    "suppliers":  ["string"],
    "inputs":     ["string"],
    "process":    ["string"],
    "outputs":    ["string"],
    "customers":  ["string"]
  },
  "kpis": [
    { "name": "string", "target": "string", "actual": "string" }
  ],
  "internalControls":  ["string"],
  "relatedDocuments":  ["string"],
  "approvals":         ["string"],
  "flowchartBoxCount":       number,
  "activitiesTableCount":    number,
  "stepCountDiscrepancy":    boolean
}
```

**What Claude returns:** A JSON object (may be wrapped in ` ```json ``` ` fences).

**Post-processing:** `tryParseStructuredJSON` strips fences and parses. Then `mergeStructuredIntoProcessAnalysis` normalizes it into the internal `ProcessAnalysis` type (handles missing fields, normalizes time strings, etc.).

---

### 5.4 Claude Call 1b — Vision Fallback (Image Blocks)

If any page has fewer than 200 characters of text (e.g. a full-page flowchart rendered as a vector image), the service falls back to rendering those pages as images and sending them to Claude as `image` blocks.

**Rendering pipeline:**
1. **First attempt:** `pdf2pic` renders the PDF page to a PNG file.
2. **Second attempt (if pdf2pic fails):** `node-canvas` + `pdfjs-dist` renders directly.
3. The PNG is base64-encoded and sent as:

```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/png",
    "data": "<base64 PNG>"
  }
}
```

Multiple image blocks (one per page) are included in a single Claude message, along with the same structured JSON extraction prompt.

---

### 5.5 Claude Call 2 — Diagnose Process

**Method:** `diagnoseProcess(analysis)`  
**`max_tokens`:** 4000

**What is sent to Claude:**
```
System: You are a process improvement expert specializing in government services.

User:
Analyze this process and identify improvement opportunities.

Process: <processName>
Steps: <total count>
Departments: <comma-separated list>
Process Owner: <name>

KPIs:
| KPI Name | Target | Actual |
|----------|--------|--------|
| ...      | ...    | ...    |

SIPOC:
Suppliers: ...
Inputs:    ...
Process:   ...
Outputs:   ...
Customers: ...

Internal Controls: ...
Related Documents: ...

Activities:
| StepId        | Step Name | Department | Performed By | Actual Time | Available Time |
|---------------|-----------|------------|--------------|-------------|----------------|
| CS.H.3.1.01   | ...       | ...        | ...          | 2 Days      | 5 Days         |
| ...

Dependencies (edges):
<from> → <to>

Return ONLY valid JSON:
{
  "bottlenecks": [
    {
      "stepId":      "string",
      "stepName":    "string",
      "reason":      "string",    // e.g. "Utilization 85%"
      "utilization": number,
      "fanIn":       number
    }
  ],
  "redundancies": [
    {
      "steps":       ["string"],
      "reason":      "string"     // e.g. "Sequential duplicate approval"
    }
  ],
  "quickWins": [
    {
      "stepId":              "string",
      "stepName":            "string",
      "suggestion":          "string",
      "effort":              "Low|Medium|High",
      "impact":              "Low|Medium|High",
      "estimatedTimeSaving": "string",   // e.g. "2 Working Days"
      "category":            "Automation|Consolidation|Removal|Parallelization|Simplification",
      "performedBy":         "string",
      "bestPractice":        "string"    // Lean waste name or ISO standard, only if certain
    }
  ],
  "priorityActions": ["string"],
  "processMetrics": {
    "totalSteps":          number,
    "totalDepartments":    number,
    "estimatedDuration":   "string",
    "automationPotential": "Low|Medium|High"
  }
}
```

**What Claude returns:** A JSON object following the schema above.

**Fallback:** If Claude fails, is overloaded, or returns invalid JSON, `buildDeterministicDiagnosis` runs instead — a pure TypeScript function that:
- Detects bottlenecks by checking if utilization > 80% (actualTime / availableTime) or if a node has 3+ incoming edges (fan-in)
- Generates generic quick-win suggestions based on step types and names
- This ensures the UI never shows an empty diagnosis

---

### 5.6 UI After Diagnose

After `extractAndDiagnose` returns, the UI renders:

```
┌──────────────────────────────────────────────────────────────┐
│  Process Summary                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Process  │ │  Steps   │ │Duration  │ │  Owner   │        │
│  │  Name    │ │   12     │ │ 24 Days  │ │  Name    │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├──────────────────────────────────────────────────────────────┤
│  KPIs                                                        │
│  [KPI Card 1]  [KPI Card 2]  [KPI Card 3]                    │
├──────────────────────────────────────────────────────────────┤
│  Current Process Diagram                                     │
│  [MermaidDiagram — flowchart LR with swimlane subgraphs]     │
├──────────────────────────────────────────────────────────────┤
│  Bottlenecks          │  Quick Wins Table                    │
│  • Step X (85%)       │  ☑ Remove Step Y  | Low  | High      │
│  • Step Z (fan-in:4)  │  ☑ Merge A+B      | Med  | High      │
│                       │  ☐ Automate C     | High | Med       │
└──────────────────────────────────────────────────────────────┘
```

The **Quick Wins table** has checkboxes. Each row shows:
- Suggestion text
- Step ID and Step Name
- Who performs it (`performedBy`)
- Effort (Low/Medium/High, color-coded)
- Impact (Low/Medium/High, color-coded)
- Estimated Time Saving
- Category (Automation/Consolidation/Removal/Parallelization/Simplification)
- Methodology / Best Practice citation

Users check/uncheck rows to select which improvements to apply.

There are also collapsible **Debug** sections showing:
- Raw diagnosis JSON
- Raw Mermaid code

---

### 5.7 Phase 2 — Optimize

The user selects quick wins (checkboxes) and clicks **"Optimize"**.

**Two modes available (radio buttons):**

- **Guided Mode** (default): Uses the checked quick wins.  
  `buildInstructionsFromQuickWins` converts them into surgical instructions:
  ```
  - Remove "Verify Document Manually"
  - Merge "Initial Review" and "Secondary Review"
  - Automate "Status Notification"
  ```

- **Custom Mode**: User types freeform instructions in a textarea.

Before the API call, `simulateImpact` runs **purely on the client** (no API call):
- Calculates estimated step reduction (count of Removal + Consolidation wins)
- Calculates percentage time saved based on `estimatedTimeSaving` fields
- Counts department handoff reduction

---

### 5.8 tRPC: optimizeProcess

**Procedure:** `optimizeProcess` (mutation)

**Input Zod schema:**
```ts
z.object({
  content:               z.string(),   // original extracted text
  optimizationCriteria:  z.string(),   // the surgical instructions string
})
```

**Server logic:**
1. Checks if `applyDeterministicChange` can handle it (pure regex-based step removal — fast, no API call). If yes, applies it and returns.
2. If not, calls `optimizer.generateOptimizationResults(currentAnalysis, criteria)`.

**Response:**
```ts
{
  optimizedAnalysis:  ProcessAnalysis,    // modified graph
  optimizedMermaid:   string,             // new flowchart LR Mermaid code
  changes:            string[],           // list of what changed
  impactAnalysis:     { ... }
}
```

---

### 5.9 Claude Call 3 — Generate Optimized Graph

**Method:** Called inside `generateOptimizationResults`  
**`max_tokens`:** 4000

**What is sent to Claude:**
```
User:
You are a process optimization expert. Modify this process graph based on the instructions.

Current process graph:
Nodes: [{ id, label, type }, ...]
Edges: [{ from, to, label }, ...]

Apply these specific changes:
- Remove "Verify Document Manually"
- Merge "Initial Review" and "Secondary Review" into one step
- Automate "Status Notification"

Rules:
1. Only make the changes listed above. Do not add new steps.
2. When removing a step, reconnect its incoming and outgoing edges.
3. When merging two steps, keep the name of the first step, remove the second, redirect edges.
4. Return ONLY valid JSON with the same structure:
{
  "nodes": [...],
  "edges": [...],
  "changes": ["description of what was done"]
}
```

**What Claude returns:** Modified JSON graph with the `changes` array.

**Post-processing:** `buildMermaidFromStructured` converts the modified `nodes` + `edges` into a `flowchart LR` Mermaid diagram with department-based subgraphs:
```
flowchart LR
  subgraph Dept1["Department Name"]
    A["Step Label"]
    B["Step Label"]
  end
  subgraph Dept2["Department Name"]
    C["Step Label"]
  end
  A --> B
  B --> C
```

---

### 5.10 UI After Optimize

```
┌─────────────────────────────────┬─────────────────────────────┐
│  AS-IS Process                  │  TO-BE Process               │
│  [MermaidDiagram — current]     │  [MermaidDiagram — optimized]│
└─────────────────────────────────┴─────────────────────────────┘

Impact Analysis
┌────────────────┐ ┌──────────────────┐ ┌─────────────────────┐
│ Time Saved     │ │ Steps Reduced    │ │ Dept. Handoffs      │
│ 6 Days (25%)   │ │ 12 → 9 (-3)      │ │ 8 → 6 (-2)          │
└────────────────┘ └──────────────────┘ └─────────────────────┘

Applied Changes:
• Removed "Verify Document Manually"
• Merged "Initial Review" + "Secondary Review"

[  Generate Updated SOP Document  ]
```

---

### 5.11 Phase 3 — SOP Generation

User clicks **"Generate Updated SOP Document"**.

---

### 5.12 tRPC: generateSOP

**Procedure:** `generateSOP` (mutation)

**Input Zod schema:**
```ts
z.object({
  content:              z.string(),    // original extracted text
  optimizationCriteria: z.string(),    // the instructions used
  appliedChanges:       z.array(z.string()),   // e.g. ["Removed X", "Merged A+B"]
  documentMetadata:     z.object({
    processName:    z.string(),
    department:     z.string(),
    processOwner:   z.string(),
    version:        z.string(),
    effectiveDate:  z.string(),
  }),
  diagnosis: z.object({
    bottlenecks:     z.array(...),
    quickWins:       z.array(...),
    priorityActions: z.array(...),
    processMetrics:  z.object(...),
  }),
})
```

**Server logic:** Calls `optimizer.generateSOPDocument(params)` → returns markdown string.

---

### 5.13 Claude Call 4 — Generate SOP Document

**`max_tokens`:** 6000

**What is sent to Claude:**
```
System: You are a business process documentation expert creating formal SOP documents.

User:
Generate a comprehensive Standard Operating Procedure (SOP) document.

Process Information:
- Name:    <processName>
- Dept:    <department>
- Owner:   <processOwner>
- Version: <version>
- Date:    <effectiveDate>

SIPOC Table:
Suppliers | Inputs | Process | Outputs | Customers
...       | ...    | ...     | ...     | ...

KPIs:
| KPI Name | Target | Actual |
...

Optimization Changes Applied:
• Removed "X" (performed by: Role Name, saves: 2 Working Days)
• Merged "A" and "B" (performed by: Role Name)

Optimized Process Diagram (Mermaid):
```flowchart LR
  ...
```

Impact Analysis:
- Steps: 12 → 9 (−3 steps)
- Time saved: 6 Working Days (25%)

Internal Controls: ...
Related Documents: ...
Approvals: ...

Generate a formal SOP document in Markdown format with these sections:
1. Issue Details (document number, version, effective date, author)
2. Process Information (name, department, owner, scope)
3. Description / Purpose / Scope
4. SIPOC Table
5. KPIs Table
6. Process Model (embed the Mermaid diagram in a code block)
7. Optimization Change Log (table: Step | Change Type | Performed By | Time Saved | Impact)
8. Impact Analysis
9. Internal Controls
10. Related Documents
11. Revision History
```

**What Claude returns:** A full markdown document (~3,000–5,000 words).

---

### 5.14 UI: SOP Rendering

The markdown string is rendered using `react-markdown` with custom component overrides and `remark-gfm` (GitHub Flavored Markdown for tables):

| Markdown Element | Rendered As |
|---|---|
| `# h1` | Large bold header with bottom border |
| `## h2` | Section header with gray background |
| `### h3` | Cyan accent bar on left |
| `#### h4` | Bold italic subheading |
| `table` | Full-width striped table with borders |
| ` ```mermaid ``` ` | `<MermaidDiagram>` component (live SVG render) |
| ` ```other ``` ` | Styled code block |
| `> blockquote` | Left cyan border, gray background |

**Action buttons:**
- **Copy to Clipboard** — copies raw markdown to clipboard
- **Download as .md** — creates a Blob and triggers browser download as `<processName>-SOP.md`
- **Back to Optimization** — returns to Phase 2 view

---

## 6. tRPC Architecture Deep Dive

### Request lifecycle

```
Browser
  │
  │  api.blueprint.analyzeBlueprint.useMutation()
  │  or
  │  api.processOptimizer.extractAndDiagnose.useMutation()
  │
  ▼
TanStack React Query (manages loading/error/data state)
  │
  ▼
tRPC client → HTTP POST to /api/trpc/blueprint.analyzeBlueprint
              (batching: multiple calls merge into one HTTP request)
  │
  ▼
/pages/api/trpc/[trpc].ts
  - bodyParser limit: 15MB (for base64 PDFs)
  - Creates context (empty {})
  - Routes to appRouter
  │
  ▼
timingMiddleware
  - Records start time
  - In dev: adds 100–500ms artificial delay (simulates production latency)
  - Logs: "🕐 blueprint.analyzeBlueprint — 3421ms"
  │
  ▼
Zod input validation
  - Throws TRPCError(BAD_REQUEST) if invalid
  │
  ▼
Procedure handler
  - Calls service method(s)
  │
  ▼
Serialized with superjson → HTTP response
  │
  ▼
Browser: React Query updates .data / .isLoading / .error
```

### Error handling

- If the Zod schema fails → tRPC returns a `400 BAD_REQUEST` with field-level error messages
- If Claude API fails → Service catches the error and either falls back to deterministic logic or re-throws
- If re-thrown → tRPC returns `500 INTERNAL_SERVER_ERROR`
- React Query surfaces the error in `.error` state → UI shows an error toast/message

---

## 7. Mermaid Diagram Rendering

**Component:** `src/components/MermaidDiagram.tsx`

```
Parent component passes: diagramCode (string), fitContent (boolean)
        │
        ▼
useEffect runs when diagramCode changes
        │
        ▼
Generate unique render ID:
  id = "mermaid-" + hash(diagramCode) + "-" + Date.now()
  (prevents conflicts when multiple diagrams on same page)
        │
        ▼
mermaid.render(id, diagramCode)
  → returns { svg: string }
        │
        ▼
contentRef.innerHTML = svg
  (injects SVG directly into DOM)
        │
        ▼
Zoom controls (React state: scale, default 1.0):
  + → scale += 0.2
  − → scale -= 0.2 (min 0.2)
  Reset → scale = 1.0
  Applied via: style={{ width: `${scale * 100}%` }}
        │
        ▼
If render fails:
  contentRef shows: "Failed to render diagram: <error message>"
  (red text, monospace font)
```

**Mermaid initialization (once per page load):**
```ts
mermaid.initialize({
  theme: "neutral",
  securityLevel: "loose",   // allows HTML labels in nodes
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true
  }
})
```

---

## 8. Environment and Configuration

**Required environment variable:**

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Validated at build time by `src/env.js` using `@t3-oss/env-nextjs` + Zod. If missing, the Next.js build fails immediately with a clear error message.

**Body size limit:** The tRPC API route sets `bodyParser: { sizeLimit: "15mb" }` to handle large base64-encoded PDFs.

**Turbo mode:** `npm run dev` uses `next dev --turbo` for fast refresh.

---

## 9. Request/Response Full Examples

### Example: extractAndDiagnose for a 12-step RTA process

**tRPC request (HTTP POST to /api/trpc/processOptimizer.extractAndDiagnose):**
```json
{
  "0": {
    "fileContent": "JVBERi0xLjQKJeLjz9MKNiAwIG9iago...",  // base64 PDF
    "fileName": "CS-H-3-1-Customer-Service-Process.pdf",
    "fileType": "application/pdf"
  }
}
```

**Claude API call (document block):**
```json
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 8192,
  "messages": [{
    "role": "user",
    "content": [
      {
        "type": "document",
        "source": {
          "type": "base64",
          "media_type": "application/pdf",
          "data": "JVBERi0xLjQK..."
        }
      },
      {
        "type": "text",
        "text": "Extract all process information from this document and return ONLY valid JSON..."
      }
    ]
  }]
}
```

**Claude response (text content):**
```json
{
  "processName": "Customer Service Request Handling",
  "department": "Customer Service",
  "processOwner": "Head of Customer Service",
  "nodes": [
    { "id": "start", "label": "Start", "type": "start" },
    { "id": "CS_H_3_1_01", "label": "Receive Customer Request", "type": "process" },
    { "id": "CS_H_3_1_02", "label": "Verify Documents", "type": "process" },
    ...
  ],
  "edges": [
    { "from": "start", "to": "CS_H_3_1_01" },
    { "from": "CS_H_3_1_01", "to": "CS_H_3_1_02" },
    ...
  ],
  "activitiesTable": [
    {
      "stepId": "CS.H.3.1.01",
      "stepName": "Receive Customer Request",
      "performedBy": "Customer Service Officer",
      "actualTime": "1 Working Day",
      "availableTime": "3 Working Days"
    },
    ...
  ],
  "sipoc": {
    "suppliers": ["Customer", "External Agencies"],
    "inputs": ["Customer Application", "Supporting Documents"],
    "process": ["Receive", "Verify", "Process", "Approve", "Notify"],
    "outputs": ["Approved Request", "Rejection Notice"],
    "customers": ["Internal Departments", "End Customer"]
  },
  "kpis": [
    { "name": "Processing Time", "target": "5 Working Days", "actual": "8 Working Days" }
  ],
  "internalControls": ["All requests must be logged in CRM"],
  "relatedDocuments": ["Customer Service Charter"],
  "approvals": ["Department Manager approval required for exceptions"]
}
```

**tRPC response sent to browser:**
```json
{
  "result": {
    "data": {
      "extractedText": "...",
      "analysis": { "processName": "Customer Service Request Handling", ... },
      "diagnosis": {
        "bottlenecks": [
          { "stepId": "CS.H.3.1.02", "stepName": "Verify Documents", "reason": "Utilization 83%", "utilization": 83 }
        ],
        "quickWins": [
          {
            "stepId": "CS.H.3.1.02",
            "stepName": "Verify Documents",
            "suggestion": "Automate document verification using AI OCR",
            "effort": "Medium",
            "impact": "High",
            "estimatedTimeSaving": "2 Working Days",
            "category": "Automation",
            "performedBy": "Customer Service Officer",
            "bestPractice": "Lean: Over-processing waste"
          }
        ],
        "processMetrics": {
          "totalSteps": 12,
          "totalDepartments": 3,
          "estimatedDuration": "24 Working Days",
          "automationPotential": "High"
        }
      },
      "currentMermaid": "flowchart LR\n  subgraph CS[\"Customer Service\"]\n    CS_H_3_1_01[\"Receive Customer Request\"]\n    CS_H_3_1_02[\"Verify Documents\"]\n  end\n  ..."
    }
  }
}
```

---

## Summary Flow Diagram

```
USER UPLOADS PDF
       │
       ▼
Browser: base64 encode PDF
       │
       ▼
tRPC mutation: extractAndDiagnose
       │
       ▼
Server: ProcessOptimizer.extractTextFromBase64()
       │
       ├─► Claude Call 1: PDF as document block
       │   → returns structured JSON (nodes, edges, activities, SIPOC, KPIs)
       │
       ├─► [If flowchart page has < 200 chars]
       │   Claude Call 1b: render page to PNG → send as image block
       │   → returns same JSON schema
       │
       ▼
Server: ProcessOptimizer.diagnoseProcess()
       │
       ├─► Claude Call 2: activities table + dependencies → diagnosis JSON
       │   (bottlenecks, quick wins, process metrics)
       │
       ├─► [If Claude fails] deterministic fallback (pure TypeScript)
       │
       ▼
Server: buildMermaidFromStructured()  [no Claude call]
       → flowchart LR with department swimlanes
       │
       ▼
tRPC response → Browser
       │
       ▼
UI: summary cards + KPIs + Mermaid diagram + Quick Wins table
       │
       ▼ (user selects quick wins, clicks Optimize)
       │
tRPC mutation: optimizeProcess
       │
       ▼
Server: generateOptimizationResults()
       │
       ├─► [if deterministic change applies] applyDeterministicChange()
       │   no API call, pure regex
       │
       └─► Claude Call 3: current graph + instructions → modified graph JSON
           → buildMermaidFromStructured() → optimized Mermaid
       │
       ▼
UI: AS-IS vs TO-BE diagrams side by side + impact analysis
       │
       ▼ (user clicks Generate SOP)
       │
tRPC mutation: generateSOP
       │
       ▼
Server: generateSOPDocument()
       │
       └─► Claude Call 4: full metadata + changes + Mermaid → markdown SOP
       │
       ▼
UI: react-markdown renders SOP
    ├── Mermaid code blocks → live MermaidDiagram components
    ├── Tables → styled HTML tables
    └── Headers → styled typography
       │
       ▼
User: Copy / Download as .md
```
