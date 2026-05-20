import Anthropic from "@anthropic-ai/sdk";

// Extend Promise interface to include withResolvers
declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

// Mock DOMMatrix for server-side environment
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(
      init?:
        | string
        | number[]
        | {
            a?: number;
            b?: number;
            c?: number;
            d?: number;
            e?: number;
            f?: number;
          },
    ) {
      if (init && typeof init === "string") {
        // Parse matrix string (e.g., "matrix(1, 0, 0, 1, 0, 0)")
        const regex = /matrix\(([^)]+)\)/;
        const match = regex.exec(init);
        if (match) {
          const values =
            match[1]?.split(",").map((v) => parseFloat(v.trim())) ?? [];
          if (values.length >= 6) {
            this.a = values[0] ?? 1;
            this.b = values[1] ?? 0;
            this.c = values[2] ?? 0;
            this.d = values[3] ?? 1;
            this.e = values[4] ?? 0;
            this.f = values[5] ?? 0;
            return;
          }
        }
      } else if (init && Array.isArray(init)) {
        // Accept array [a, b, c, d, e, f] or 16-element array
        if (init.length >= 6) {
          this.a = init[0] ?? 1;
          this.b = init[1] ?? 0;
          this.c = init[2] ?? 0;
          this.d = init[3] ?? 1;
          this.e = init[4] ?? 0;
          this.f = init[5] ?? 0;
          return;
        }
      } else if (init && typeof init === "object") {
        // Accept another DOMMatrix-like object
        const m = init;
        this.a = m.a ?? 1;
        this.b = m.b ?? 0;
        this.c = m.c ?? 0;
        this.d = m.d ?? 1;
        this.e = m.e ?? 0;
        this.f = m.f ?? 0;
        return;
      }
      // Default identity matrix
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
    }
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    multiply(other: DOMMatrix): DOMMatrix {
      const result = new DOMMatrix();
      result.a = this.a * other.a + this.c * other.b;
      result.b = this.b * other.a + this.d * other.b;
      result.c = this.a * other.c + this.c * other.d;
      result.d = this.b * other.c + this.d * other.d;
      result.e = this.a * other.e + this.c * other.f + this.e;
      result.f = this.b * other.e + this.d * other.f + this.f;
      return result;
    }
    inverse(): DOMMatrix {
      const det = this.a * this.d - this.b * this.c;
      if (Math.abs(det) < 1e-10) {
        return new DOMMatrix();
      }
      const result = new DOMMatrix();
      result.a = this.d / det;
      result.b = -this.b / det;
      result.c = -this.c / det;
      result.d = this.a / det;
      result.e = (this.c * this.f - this.d * this.e) / det;
      result.f = (this.b * this.e - this.a * this.f) / det;
      return result;
    }
    translate(x: number, y: number): DOMMatrix {
      const result = new DOMMatrix({
        a: this.a,
        b: this.b,
        c: this.c,
        d: this.d,
        e: this.e,
        f: this.f,
      });
      result.e = this.a * x + this.c * y + this.e;
      result.f = this.b * x + this.d * y + this.f;
      return result;
    }
    scale(x: number, y?: number): DOMMatrix {
      const result = new DOMMatrix({
        a: this.a,
        b: this.b,
        c: this.c,
        d: this.d,
        e: this.e,
        f: this.f,
      });
      const scaleY = y ?? x;
      result.a = this.a * x;
      result.b = this.b * x;
      result.c = this.c * scaleY;
      result.d = this.d * scaleY;
      return result;
    }
    rotate(angle: number): DOMMatrix {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const result = new DOMMatrix({
        a: this.a,
        b: this.b,
        c: this.c,
        d: this.d,
        e: this.e,
        f: this.f,
      });
      const newA = this.a * cos + this.c * sin;
      const newB = this.b * cos + this.d * sin;
      result.c = this.c * cos - this.a * sin;
      result.d = this.d * cos - this.b * sin;
      result.a = newA;
      result.b = newB;
      return result;
    }
  } as typeof DOMMatrix;
}

export interface ProcessStep {
  id: string;
  name: string;
  department: string;
  role: string;
  leadTime?: number;
  dependencies: string[];
  systemUsed?: boolean;
}

// Optional structured graph representation for high-fidelity diagrams
export type ProcessNodeType =
  | "start"
  | "end"
  | "task"
  | "gateway"
  | "data"
  | "annotation";

export interface ProcessNode {
  id: string;
  name: string;
  type: ProcessNodeType;
  department: string;
  role?: string;
  systemUsed?: boolean;
}

export interface ProcessEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ProcessOwner {
  department: string;
  role: string;
  responsibilities: string[];
}

// SIPOC model for process context
export interface SIPOCEntry {
  suppliers: string[];
  inputs: string[];
  process: string;
  outputs: string[];
  customers: string[];
}

// Process KPI definition
export interface ProcessKPI {
  name: string;
  nameArabic?: string;
  formula?: string;
  target: string;
  measurementFrequency?: string;
  dataSource?: string;
}

// Internal control entry
export interface InternalControl {
  controlId?: string;
  description: string;
  riskMitigated?: string;
  controlType?: string; // e.g., "Preventive", "Detective"
}

// Related document/policy reference
export interface RelatedDocument {
  name: string;
  reference?: string; // e.g., "BS EN 12973:2020"
  type?: string; // e.g., "Policy", "Standard", "Template"
}

// Approval entry
export interface ApprovalEntry {
  role: string;
  name?: string;
  date?: string;
  signature?: string;
}

// Activity from the activities table (source of truth for step enumeration)
export interface ActivityTableEntry {
  id: string; // e.g., "CS.H.3.1.01"
  name: string;
  nameArabic?: string;
  performedBy: string; // Role/department responsible
  actualTime: number; // in working days
  actualTimeUnit: string;
  availableTime: number;
  availableTimeUnit: string;
  systemUsed?: string;
  department?: string;
}

// Comprehensive document metadata extracted from RTA process documents
export interface ProcessDocumentMetadata {
  // Process Information section
  processId?: string;
  processName: string;
  processNameArabic?: string;
  processOwner?: string;
  department?: string;
  section?: string;

  // Description and Purpose
  description?: string;
  descriptionArabic?: string;
  purpose?: string;
  purposeArabic?: string;
  scope?: string;

  // SIPOC
  sipoc?: SIPOCEntry;

  // KPIs
  kpis: ProcessKPI[];

  // Related Documents and Policies
  relatedDocuments: RelatedDocument[];

  // Internal Controls
  internalControls: InternalControl[];

  // Approvals
  approvals: ApprovalEntry[];

  // Activities Table (source of truth for step enumeration)
  activitiesTable: ActivityTableEntry[];

  // Step count validation
  flowchartBoxCount?: number;
  activitiesTableCount?: number;
  stepCountDiscrepancy?: boolean;
}

export interface ProcessAnalysis {
  processName: string;
  departments: string[];
  processOwners: ProcessOwner[];
  processSteps: ProcessStep[];
  dependencies: Record<string, string[]>;
  leadTimes: Record<string, number>;
  analysis: string;
  // Optional, populated when high-fidelity graph is extracted from the PDF
  nodes?: ProcessNode[];
  edges?: ProcessEdge[];
  // Comprehensive document metadata
  documentMetadata?: ProcessDocumentMetadata;
}

export interface ProcessOptimization {
  originalProcess: ProcessAnalysis;
  optimizationCriteria: string;
  optimizedProcess: ProcessAnalysis;
}

export interface OptimizationResults {
  currentAnalysis: ProcessAnalysis;
  currentMermaid: string;
  optimization: ProcessOptimization;
  optimizedMermaid: string;
}

// Phase 1: Diagnosis result types
export interface DiagnosisBottleneck {
  stepId: string;
  stepName: string;
  reason: string;
  impact: "High" | "Medium" | "Low";
  timingIssue: {
    actualTime: number;
    availableTime: number;
    utilizationPercent: number;
  };
}

export interface DiagnosisRedundancy {
  steps: string[];
  reason: string;
  consolidationSuggestion: string;
}

export type QuickWinCategory =
  | "Automation"
  | "Consolidation"
  | "Removal"
  | "Parallelization"
  | "Simplification";

export interface DiagnosisQuickWin {
  stepId: string;
  stepName: string;
  suggestion: string;
  effort: "Low" | "Medium" | "High";
  impact: "High" | "Medium" | "Low";
  estimatedTimeSaving: string;
  category: QuickWinCategory;
  performedBy: string; // Who performs the step(s) affected by this quick win
  bestPractice?: string; // Reference to methodology (e.g., "Lean - Eliminate Waiting Waste", "Six Sigma - Reduce Variation")
  // Optional fields that may assist downstream deterministic logic
  steps?: string[]; // for consolidation quick wins
  consolidationSuggestion?: string;
}

export interface DiagnosisPriorityAction {
  action: string;
  rationale: string;
  order: number;
}

export interface DiagnosisProcessMetrics {
  totalDuration: string;
  criticalPathSteps: string[];
  departmentHandoffs: number;
  approvalLayers: number;
}

export type AutomationPathway =
  | "AI Agent"
  | "Classical RPA"
  | "Manual Optimization";

export interface ProcessAutomationClassification {
  primaryClassification: AutomationPathway;
  confidenceScore: number; // 0-100
  keyFactors: string[];
  hybridFlags: {
    aiAgent: boolean;
    classicalRpa: boolean;
    manualOptimization: boolean;
  };
  pathwayScores: {
    aiAgent: number;
    classicalRpa: number;
    manualOptimization: number;
  };
}

export interface ProcessDiagnosis {
  bottlenecks: DiagnosisBottleneck[];
  redundancies: DiagnosisRedundancy[];
  quickWins: DiagnosisQuickWin[];
  priorityActions: DiagnosisPriorityAction[];
  processMetrics: DiagnosisProcessMetrics;
  automationClassification: ProcessAutomationClassification;
}

// Multi-process support
export interface ProcessWithDiagnosis {
  processIndex: number;
  analysis: ProcessAnalysis;
  diagnosis: ProcessDiagnosis;
  currentMermaid: string;
}

export interface MultiProcessResult {
  processes: ProcessWithDiagnosis[];
}

export class ProcessOptimizer {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  async extractText(file: File): Promise<string> {
    if (file.type === "application/pdf") {
      return await this.extractTextFromPDF(file);
    } else if (file.type === "text/plain") {
      return await this.extractTextFromTxt(file);
    } else {
      throw new Error(
        "Unsupported file type. Please upload a PDF or TXT file.",
      );
    }
  }

  async extractTextFromBase64(
    base64Content: string,
    fileName: string,
    fileType: string,
  ): Promise<string> {
    if (fileType === "application/pdf") {
      return await this.extractTextFromPDFBase64(base64Content);
    } else if (fileType === "text/plain") {
      return await this.extractTextFromTxtBase64(base64Content);
    } else {
      throw new Error(
        "Unsupported file type. Please upload a PDF or TXT file.",
      );
    }
  }

  // Combined extraction + analysis + diagnosis endpoint
  // Uses the original extraction method (no native PDF) + combined processing
  async extractAndDiagnosePDF(
    base64Content: string,
    fileName: string,
    fileType: string,
  ): Promise<{
    extractedText: string;
    analysis: ProcessAnalysis;
    diagnosis: ProcessDiagnosis;
    currentMermaid: string;
  }> {
    console.log("[extractAndDiagnose] Starting extraction...");
    const startTime = Date.now();

    // Use the original extraction method
    const text = await this.extractTextFromBase64(
      base64Content,
      fileName,
      fileType,
    );
    console.log(
      `[extractAndDiagnose] Extraction took ${Date.now() - startTime}ms`,
    );

    const analysisStart = Date.now();
    const analysis = await this.analyzeProcess(text);
    console.log(
      `[extractAndDiagnose] Analysis took ${Date.now() - analysisStart}ms`,
    );

    const diagnosisStart = Date.now();
    const diagnosis = await this.diagnoseProcess(analysis);
    console.log(
      `[extractAndDiagnose] Diagnosis took ${Date.now() - diagnosisStart}ms`,
    );

    const mermaidStart = Date.now();
    const currentMermaid = await this.createCurrentProcessDiagram(analysis);
    console.log(
      `[extractAndDiagnose] Mermaid took ${Date.now() - mermaidStart}ms`,
    );

    console.log(`[extractAndDiagnose] TOTAL took ${Date.now() - startTime}ms`);

    // Debug: Log node/edge counts to help diagnose diagram issues
    console.log(
      `[extractAndDiagnose] DIAGRAM DEBUG - Nodes: ${analysis.nodes?.length ?? 0}, Edges: ${analysis.edges?.length ?? 0}, ProcessSteps: ${analysis.processSteps?.length ?? 0}`,
    );
    if (analysis.nodes && analysis.nodes.length > 0) {
      console.log(
        `[extractAndDiagnose] First 5 nodes:`,
        JSON.stringify(analysis.nodes.slice(0, 5), null, 2),
      );
    }
    if (analysis.edges && analysis.edges.length > 0) {
      console.log(
        `[extractAndDiagnose] First 5 edges:`,
        JSON.stringify(analysis.edges.slice(0, 5), null, 2),
      );
    }
    console.log(
      `[extractAndDiagnose] Mermaid length: ${currentMermaid.length} chars`,
    );

    // Debug: Log SIPOC extraction
    if (analysis.documentMetadata?.sipoc) {
      console.log("[extractAndDiagnose] SIPOC extracted:");
      console.log("  Suppliers:", analysis.documentMetadata.sipoc.suppliers);
      console.log("  Inputs:", analysis.documentMetadata.sipoc.inputs);
      console.log("  Process:", analysis.documentMetadata.sipoc.process);
      console.log("  Outputs:", analysis.documentMetadata.sipoc.outputs);
      console.log("  Customers:", analysis.documentMetadata.sipoc.customers);
    } else {
      console.log(
        "[extractAndDiagnose] WARNING: No SIPOC data found in extraction!",
      );
    }

    // Log raw structured response to see what Claude actually returned
    console.log(
      "[extractAndDiagnose] Raw JSON keys:",
      Object.keys(analysis.documentMetadata ?? {}),
    );

    return { extractedText: text, analysis, diagnosis, currentMermaid };
  }

  private async extractTextFromPDF(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Clone the ArrayBuffer immediately to avoid detached buffer issues
      const bufferCopy1 = new Uint8Array(arrayBuffer);
      const bufferCopy2 = new Uint8Array(arrayBuffer);
      const clonedArrayBufferForText = new ArrayBuffer(bufferCopy1.length);
      const clonedArrayBufferForVision = new ArrayBuffer(bufferCopy2.length);
      new Uint8Array(clonedArrayBufferForText).set(bufferCopy1);
      new Uint8Array(clonedArrayBufferForVision).set(bufferCopy2);

      // Extract text from all pages
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      const pdf = await pdfjsLib.getDocument({ data: clonedArrayBufferForText })
        .promise;

      // Extract text from all pages in parallel
      const textExtractionPromises = Array.from(
        { length: pdf.numPages },
        async (_, index) => {
          const pageNum = index + 1;
          try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item) => {
                if ("str" in item && typeof item.str === "string") {
                  return item.str;
                }
                return "";
              })
              .filter((str) => str.length > 0)
              .join(" ");
            return { pageNum, text: pageText };
          } catch {
            return { pageNum, text: "" };
          }
        },
      );

      const pageTextResults = await Promise.all(textExtractionPromises);

      // RTA process documents typically have flowchart on a specific page
      // Always use Vision API for known flowchart pages + pages with very little text
      const FLOWCHART_PAGES = [11]; // Page 11 contains the flowchart
      const DIAGRAM_THRESHOLD = 200; // Very low - only truly empty pages
      const textPages: Array<{ pageNum: number; text: string }> = [];
      const diagramPages: number[] = [];

      pageTextResults.forEach((result) => {
        const textLen = result.text.trim().length;
        const isFlowchartPage = FLOWCHART_PAGES.includes(result.pageNum);
        if (isFlowchartPage || textLen < DIAGRAM_THRESHOLD) {
          diagramPages.push(result.pageNum);
        } else {
          textPages.push(result);
        }
      });

      // Use Vision API for flowchart and diagram pages
      let visionText = "";
      if (diagramPages.length > 0) {
        console.log(
          `[extractTextFromPDF] Using Vision API for pages: ${diagramPages.join(", ")}`,
        );
        visionText = await this.extractTextFromPDFImagesForPages(
          clonedArrayBufferForVision,
          diagramPages,
        );
        console.log(
          `[extractTextFromPDF] Vision API returned ${visionText.length} characters`,
        );
      }

      // Combine text from text-heavy pages
      const extractedText = textPages
        .map((p) => `Page ${p.pageNum}:\n${p.text}`)
        .join("\n\n");

      // Combine vision + text results
      const combinedText = [visionText.trim(), extractedText.trim()]
        .filter((t) => t.length > 0)
        .join("\n\n");

      if (!combinedText || combinedText.trim().length === 0) {
        throw new Error(
          "Failed to extract content from PDF. No readable text or diagrams found.",
        );
      }

      return combinedText;
    } catch (error) {
      throw new Error(
        `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async extractTextFromTxt(file: File): Promise<string> {
    try {
      const text = await file.text();
      if (!text || text.trim().length === 0) {
        throw new Error(
          "The uploaded text file appears to be empty or contains no readable content",
        );
      }
      return text;
    } catch (error) {
      throw new Error(
        `Failed to read text file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async extractTextFromPDFBase64(
    base64Content: string,
  ): Promise<string> {
    // Use Claude's native PDF support - sends PDF directly to Claude
    // This is faster and more accurate than converting to images
    // See: https://platform.claude.com/docs/en/build-with-claude/pdf-support
    const prompt = `You are analyzing an RTA (Roads and Transport Authority) process document in Arabic/English bilingual format.

Extract ALL content from this PDF and return it as structured JSON. The document contains:
1. A process flowchart/swimlane diagram (usually on one of the middle pages)
2. A detailed "Activities and Responsibilities" table (الأنشطة و المسؤوليات)
3. Process metadata including SIPOC, KPIs, controls, and approvals

CRITICAL LANGUAGE RULES:
- This is a BILINGUAL document (English and Arabic)
- ALWAYS use ENGLISH text for all fields (node names, step names, departments, etc.)
- Only use Arabic if English is NOT available
- For flowchart nodes: extract the English label/text, ignore Arabic
- For activities table: use English column headers and English step names
- Store Arabic versions ONLY in dedicated Arabic fields (processNameArabic, nameArabic, etc.)

CRITICAL STEP COUNTING RULES:
- Each RECTANGULAR BOX in the flowchart = ONE process step
- Decision DIAMONDS (gateways) are NOT steps
- Start/End OVALS are NOT steps  
- The Activities Table is the SOURCE OF TRUTH for step enumeration

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "processName": "",
  "processNameArabic": "",
  "departments": [],
  "nodes": [
    { "id": "", "name": "", "type": "start|end|task|gateway", "department": "", "performedBy": "" }
  ],
  "edges": [
    { "from": "", "to": "", "label": "" }
  ],
  "activitiesTable": [
    { "id": "CS.H.3.1.01", "name": "", "performedBy": "", "actualTime": 0, "availableTime": 0 }
  ],
  "flowchartBoxCount": 0,
  "activitiesTableCount": 0,
  "processOwner": "",
  "department": "",
  "kpis": [{ "name": "", "target": "" }]
}`;

    try {
      console.log(
        "[extractTextFromPDFBase64] Using Claude native PDF support...",
      );
      const startTime = Date.now();

      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Content,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      });

      console.log(
        `[extractTextFromPDFBase64] Claude API took ${Date.now() - startTime}ms`,
      );

      const responseText =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      if (!responseText || responseText.trim().length === 0) {
        throw new Error("Claude returned empty response for PDF");
      }

      console.log(
        `[extractTextFromPDFBase64] Got ${responseText.length} chars response`,
      );

      // Debug: Check if SIPOC data is in the response
      if (responseText.includes('"sipoc"')) {
        const sipocRegex = /"sipoc"\s*:\s*\{[^}]+\}/s;
        const sipocMatch = sipocRegex.exec(responseText);
        if (sipocMatch) {
          console.log(
            "[extractTextFromPDFBase64] SIPOC in response:",
            sipocMatch[0].substring(0, 500),
          );
        }
      } else {
        console.log(
          "[extractTextFromPDFBase64] WARNING: No sipoc field found in Claude response",
        );
      }

      return responseText;
    } catch (error) {
      console.error(
        "[extractTextFromPDFBase64] Native PDF failed:",
        error instanceof Error ? error.message : error,
      );

      // Check for Anthropic API overload error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("overloaded_error") ||
        errorMessage.includes("Overloaded")
      ) {
        throw new Error(
          "Claude AI service is currently experiencing high demand. Please wait a moment and try again.",
        );
      }

      // Check for rate limit errors
      if (errorMessage.includes("rate_limit")) {
        throw new Error(
          "API rate limit reached. Please wait a few minutes before trying again.",
        );
      }

      // Generic error
      throw new Error(
        `Failed to analyze PDF document. Please try again or contact support if the issue persists.`,
      );
    }
  }

  private async extractTextFromTxtBase64(
    base64Content: string,
  ): Promise<string> {
    try {
      const text = atob(base64Content);
      if (!text || text.trim().length === 0) {
        throw new Error(
          "The uploaded text file appears to be empty or contains no readable content",
        );
      }
      return text;
    } catch (error) {
      throw new Error(
        `Failed to read text file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async extractTextFromPDFImagesForPages(
    arrayBuffer: ArrayBuffer,
    pageNumbers: number[],
  ): Promise<string> {
    // Clone the ArrayBuffer immediately to avoid detached buffer issues
    // This must be done synchronously before any async operations
    // Check if buffer is already detached and create a safe clone
    let clonedArrayBuffer: ArrayBuffer;
    try {
      const bufferCopy = new Uint8Array(arrayBuffer);
      clonedArrayBuffer = new ArrayBuffer(bufferCopy.length);
      const clonedView = new Uint8Array(clonedArrayBuffer);
      clonedView.set(bufferCopy);
    } catch (error) {
      // Buffer is already detached - this shouldn't happen if we cloned earlier
      // but if it does, rethrow with clearer message
      throw new Error(
        `ArrayBuffer is detached and cannot be cloned: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Try using pdf2pic first (simpler and more reliable)
    try {
      return await this.extractTextFromPDFImagesUsingPdf2Pic(
        clonedArrayBuffer,
        pageNumbers,
      );
    } catch (pdf2picError) {
      // If pdf2pic fails (expected if ImageMagick/GraphicsMagick not installed), try canvas approach
      try {
        // Dynamically import PDF.js and canvas
        const pdfjsLib = await import("pdfjs-dist");
        let createCanvas;
        try {
          const canvasModule = await import("canvas");
          createCanvas = canvasModule.createCanvas;
        } catch (canvasImportError) {
          throw new Error(
            `Failed to import canvas module: ${canvasImportError instanceof Error ? canvasImportError.message : "Unknown error"}. Canvas package may not be installed or may require system dependencies.`,
          );
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = "";
        const pdf = await pdfjsLib.getDocument({ data: clonedArrayBuffer })
          .promise;

        // Render pages in parallel for better performance
        const renderPromises = pageNumbers.map(async (pageNum) => {
          try {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

            // Create canvas
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext("2d");

            // Render PDF page to canvas (using type assertion for compatibility)
            const renderContext = {
              canvas: canvas as unknown as HTMLCanvasElement,
              canvasContext: context,
              viewport: viewport,
            };

            // @ts-expect-error - node-canvas Canvas type is incompatible with pdfjs-dist's HTMLCanvasElement type
            await page.render(renderContext).promise;

            // Convert canvas to base64 image
            const imageBuffer = canvas.toBuffer("image/png");
            const base64Image = imageBuffer.toString("base64");
            return { pageNum, image: base64Image, success: true };
          } catch (pageError) {
            // Log the error but continue with other pages
            console.error(
              `Failed to render page ${pageNum} using canvas (skipping this page):`,
              pageError instanceof Error ? pageError.message : "Unknown error",
            );
            return { pageNum, image: undefined, success: false };
          }
        });

        const renderResults = await Promise.all(renderPromises);

        // Filter out failed renders and sort by page number to maintain order
        const pageImages = renderResults
          .filter((result) => result.success && result.image)
          .sort((a, b) => a.pageNum - b.pageNum)
          .map((result) => result.image!);

        // Use Claude vision API to extract text from images
        if (pageImages.length === 0) {
          throw new Error("Failed to render PDF pages as images");
        }

        // Send all page images to Claude vision API
        const visionContent = pageImages.map((image) => ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: image,
          },
        }));

        const prompt = `You are analyzing RTA (Roads and Transport Authority) process documents in Arabic/English bilingual format. The documents contain:
1. A process flowchart/swimlane diagram
2. A detailed "Activities and Responsibilities" table (الأنشطة و المسؤوليات) listing ALL process steps with IDs like CS.H.3.1.01
3. Process metadata including SIPOC, KPIs, controls, and approvals

CRITICAL LANGUAGE RULES:
- This is a BILINGUAL document (English and Arabic)
- ALWAYS extract and use ENGLISH text for all primary fields
- Only use Arabic if English is NOT available for that field
- For flowchart boxes: use the English label (top/left text typically)
- For activities table: use English step names from the "Activity Name" column
- For departments/roles: use English names
- Store Arabic text ONLY in dedicated Arabic fields (nameArabic, processNameArabic, etc.)

CRITICAL STEP COUNTING RULES:
- Each RECTANGULAR BOX in the flowchart represents ONE process step
- Decision DIAMONDS (gateways) are NOT counted as steps - they are decision points
- Start/End OVALS are NOT counted as steps
- The Activities Table is the SOURCE OF TRUTH for step enumeration
- Cross-validate: flowchart box count MUST match activities table row count

Return ONLY a single JSON document inside a code fence like this:
\n\`\`\`json
{
  "processName": "",
  "processNameArabic": "",
  "departments": [],
  "nodes": [
    { "id": "", "name": "", "type": "start"|"end"|"task"|"gateway"|"data"|"annotation", "department": "", "role": "", "performedBy": "", "systemUsed": false }
  ],
  "edges": [
    { "from": "", "to": "", "label": "" }
  ],
  "processOwners": [ { "department": "", "role": "", "responsibilities": [] } ],
  "dependencies": {},
  "leadTimes": {},
  "activitiesTable": [
    { "id": "CS.H.3.1.01", "name": "", "nameArabic": "", "performedBy": "", "actualTime": 0, "actualTimeUnit": "Working Days", "availableTime": 0, "availableTimeUnit": "Working Days", "department": "" }
  ],
  "flowchartBoxCount": 0,
  "activitiesTableCount": 0,
  "stepCountDiscrepancy": false,
  "sipoc": {
    "suppliers": ["Asset Management Department"],
    "inputs": ["All RTA projects/initiatives/practices aligned with Circular Economy"],
    "process": "Manage RTA Circular Economy",
    "outputs": ["Annual report for CE performance in RTA to the HE DG."],
    "customers": ["All RTA's sectors and agencies and its affiliated departments."]
  },
  "kpis": [ { "name": "", "nameArabic": "", "formula": "", "target": "", "measurementFrequency": "" } ],
  "internalControls": [ { "controlId": "", "description": "", "riskMitigated": "", "controlType": "" } ],
  "relatedDocuments": [ { "name": "", "reference": "", "type": "" } ],
  "approvals": [ { "role": "", "name": "", "date": "" } ],
  "processId": "",
  "processOwner": "",
  "department": "",
  "section": "",
  "description": "",
  "purpose": "",
  "scope": ""
}
\`\`\`

Rules:
- USE ENGLISH TEXT: Extract English labels/names for all fields (name, department, etc.)
- FIRST: Parse the Activities Table to get the complete list of steps with their IDs, ENGLISH names, and "Performed By" (المسؤولية)
- THEN: Map flowchart boxes to these known steps using their ENGLISH labels
- Count every rectangular process box (type: "task") as a distinct step
- Exclude decision diamonds (gateways), start/end nodes from step count
- For each node with type "task", use ENGLISH name and include the "performedBy" from the swimlane or activities table
- Preserve the exact step sequence and IDs from the activities table
- Include edge labels like Yes/No or condition text when present (use English if available)
- Extract ALL document sections: SIPOC, KPIs, Controls, Related Documents, Approvals
- SIPOC EXTRACTION CRITICAL: Find the table with heading "SIPOC" or section titled "SIPOC". This table has 5 rows.
  * The table has multiple columns with English and Arabic text. You need to extract the ENGLISH text only.
  * Look for these row labels: "Supplier"/"المورد", "Input"/"المدخل", "Process"/"العملية", "Output"/"المخرج", "Customer"/"العميل"
  * When you find a SIPOC row, read ALL the English text in that row's data cell. The English text is usually between the row label and the Arabic translation.
  * Example table structure:
    | Component | Details (English) | Details (Arabic) |
    | Supplier  | Asset Management Department | إدارة األصول |
  * For Supplier row: Extract English text like ["Asset Management Department"] or ["N/A"]
  * For Input row: Extract the COMPLETE English description (often a long sentence): ["All RTA projects/initiatives/practices aligned with Circular Economy"]  
  * For Process row: Extract as string: "Manage RTA Circular Economy"
  * For Output row: Extract COMPLETE English text: ["Annual report for CE performance in RTA to the HE DG."]
  * For Customer row: Extract COMPLETE English text: ["All RTA's sectors and agencies and its affiliated departments."]
  * IMPORTANT: DO NOT return empty arrays. If you cannot find text, use ["NOT FOUND"] so we can debug. Only use ["N/A"] if the cell actually says "N/A".
- If multiple pages, merge into a single graph
- Flag stepCountDiscrepancy if flowchartBoxCount != activitiesTableCount`;

        const message = await this.client.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 8192,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }, ...visionContent],
            },
          ],
        });

        const visionText =
          message.content[0]?.type === "text"
            ? (message.content[0].text ?? "")
            : "";

        if (!visionText || visionText.trim().length === 0) {
          throw new Error("Vision API returned empty content");
        }

        return visionText;
      } catch (canvasError) {
        // If both approaches fail, throw a combined error
        console.error("Canvas fallback also failed:", canvasError);
        const errorMessage =
          canvasError instanceof Error ? canvasError.message : "Unknown error";
        const pdf2picMessage =
          pdf2picError instanceof Error
            ? pdf2picError.message
            : "Unknown error";
        throw new Error(
          `Failed to extract content from PDF using vision API. pdf2pic error: ${pdf2picMessage}, canvas error: ${errorMessage}`,
        );
      }
    }
  }

  private async extractTextFromPDFImagesUsingPdf2Pic(
    arrayBuffer: ArrayBuffer,
    pageNumbers?: number[],
  ): Promise<string> {
    try {
      // Fallback: Use pdf2pic if canvas is not available
      const pdf2pic = (await import("pdf2pic")).default;
      const fs = await import("fs/promises");
      const os = await import("os");
      const path = await import("path");

      // Clone the ArrayBuffer to avoid detached buffer issues
      const bufferCopy = new Uint8Array(arrayBuffer);
      const clonedArrayBuffer = new ArrayBuffer(bufferCopy.length);
      new Uint8Array(clonedArrayBuffer).set(bufferCopy);
      const clonedBuffer = Buffer.from(clonedArrayBuffer);

      // Save arrayBuffer to temporary PDF file
      const tempDir = os.tmpdir();
      const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
      await fs.writeFile(tempPdfPath, clonedBuffer);

      // Convert PDF pages to images
      const converter = pdf2pic.fromPath(tempPdfPath, {
        density: 200,
        saveFilename: "page",
        savePath: tempDir,
        format: "png",
      });

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
      const pdf = await pdfjsLib.getDocument({ data: clonedArrayBuffer })
        .promise;

      // Use provided page numbers or all pages
      const pagesToProcess: number[] =
        pageNumbers ?? Array.from({ length: pdf.numPages }, (_, i) => i + 1);

      // Process pages in parallel
      const conversionPromises = pagesToProcess.map(async (pageNum: number) => {
        try {
          const result = await converter(pageNum, { responseType: "base64" });
          // pdf2pic returns base64 in the base64 property - check if it's non-empty
          if (result?.base64 && result.base64.length > 0) {
            return {
              pageNum,
              image: result.base64,
              success: true as const,
              error: undefined,
            };
          } else {
            // base64 is empty or missing - pdf2pic not available (ImageMagick/GraphicsMagick not installed)
            throw new Error(
              `pdf2pic not available for page ${pageNum} - ImageMagick/GraphicsMagick not installed`,
            );
          }
        } catch (pageError) {
          return {
            pageNum,
            image: undefined,
            success: false as const,
            error: pageError,
          };
        }
      });

      const conversionResults = await Promise.all(conversionPromises);

      // Filter successful conversions and sort by page number
      const successfulConversions = conversionResults
        .filter(
          (
            result,
          ): result is {
            pageNum: number;
            image: string;
            success: true;
            error: undefined;
          } => result.success && result.image !== undefined,
        )
        .sort((a, b) => a.pageNum - b.pageNum);

      const pageImages: string[] = successfulConversions.map(
        (result) => result.image,
      );

      // If all conversions failed, throw error to trigger canvas fallback
      if (conversionResults.every((result) => !result.success)) {
        const firstError = conversionResults.find((result) => result.error);
        if (firstError?.error instanceof Error) {
          throw firstError.error;
        }
        throw new Error("pdf2pic failed for all pages");
      }

      // Clean up temp PDF file
      await fs.unlink(tempPdfPath).catch(() => {
        // Ignore cleanup errors
      });

      if (pageImages.length === 0) {
        throw new Error(
          "pdf2pic not available - ImageMagick or GraphicsMagick not installed. Will use canvas fallback.",
        );
      }

      // Use Claude vision API to extract text from images
      const visionContent = pageImages.map((image) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: "image/png" as const,
          data: image,
        },
      }));

      const prompt = `You are analyzing RTA (Roads and Transport Authority) process documents in Arabic/English bilingual format. The documents contain:
1. A process flowchart/swimlane diagram
2. A detailed "Activities and Responsibilities" table (الأنشطة و المسؤوليات) listing ALL process steps with IDs like CS.H.3.1.01
3. Process metadata including SIPOC, KPIs, controls, and approvals

CRITICAL LANGUAGE RULES:
- This is a BILINGUAL document (English and Arabic)
- ALWAYS extract and use ENGLISH text for all primary fields
- Only use Arabic if English is NOT available for that field
- For flowchart boxes: use the English label (top/left text typically)
- For activities table: use English step names from the "Activity Name" column
- For departments/roles: use English names
- Store Arabic text ONLY in dedicated Arabic fields (nameArabic, processNameArabic, etc.)

CRITICAL STEP COUNTING RULES:
- Each RECTANGULAR BOX in the flowchart represents ONE process step
- Decision DIAMONDS (gateways) are NOT counted as steps - they are decision points
- Start/End OVALS are NOT counted as steps
- The Activities Table is the SOURCE OF TRUTH for step enumeration
- Cross-validate: flowchart box count MUST match activities table row count

Return ONLY a single JSON document inside a code fence like this:
\n\`\`\`json
{
  "processName": "",
  "processNameArabic": "",
  "departments": [],
  "nodes": [
    { "id": "", "name": "", "type": "start"|"end"|"task"|"gateway"|"data"|"annotation", "department": "", "role": "", "performedBy": "", "systemUsed": false }
  ],
  "edges": [
    { "from": "", "to": "", "label": "" }
  ],
  "processOwners": [ { "department": "", "role": "", "responsibilities": [] } ],
  "dependencies": {},
  "leadTimes": {},
  "activitiesTable": [
    { "id": "CS.H.3.1.01", "name": "", "nameArabic": "", "performedBy": "", "actualTime": 0, "actualTimeUnit": "Working Days", "availableTime": 0, "availableTimeUnit": "Working Days", "department": "" }
  ],
  "flowchartBoxCount": 0,
  "activitiesTableCount": 0,
  "stepCountDiscrepancy": false,
  "sipoc": {
    "suppliers": ["Asset Management Department"],
    "inputs": ["All RTA projects/initiatives/practices aligned with Circular Economy"],
    "process": "Manage RTA Circular Economy",
    "outputs": ["Annual report for CE performance in RTA to the HE DG."],
    "customers": ["All RTA's sectors and agencies and its affiliated departments."]
  },
  "kpis": [ { "name": "", "nameArabic": "", "formula": "", "target": "", "measurementFrequency": "" } ],
  "internalControls": [ { "controlId": "", "description": "", "riskMitigated": "", "controlType": "" } ],
  "relatedDocuments": [ { "name": "", "reference": "", "type": "" } ],
  "approvals": [ { "role": "", "name": "", "date": "" } ],
  "processId": "",
  "processOwner": "",
  "department": "",
  "section": "",
  "description": "",
  "purpose": "",
  "scope": ""
}
\`\`\`

Rules:
- USE ENGLISH TEXT: Extract English labels/names for all fields (name, department, etc.)
- FIRST: Parse the Activities Table to get the complete list of steps with their IDs, ENGLISH names, and "Performed By" (المسؤولية)
- THEN: Map flowchart boxes to these known steps using their ENGLISH labels
- Count every rectangular process box (type: "task") as a distinct step
- Exclude decision diamonds (gateways), start/end nodes from step count
- For each node with type "task", use ENGLISH name and include the "performedBy" from the swimlane or activities table
- Preserve the exact step sequence and IDs from the activities table
- Include edge labels like Yes/No or condition text when present (use English if available)
- Extract ALL document sections: SIPOC, KPIs, Controls, Related Documents, Approvals
- SIPOC EXTRACTION CRITICAL: Find the table with heading "SIPOC" or section titled "SIPOC". This table has 5 rows.
  * The table has multiple columns with English and Arabic text. You need to extract the ENGLISH text only.
  * Look for these row labels: "Supplier"/"المورد", "Input"/"المدخل", "Process"/"العملية", "Output"/"المخرج", "Customer"/"العميل"
  * When you find a SIPOC row, read ALL the English text in that row's data cell. The English text is usually between the row label and the Arabic translation.
  * Example table structure:
    | Component | Details (English) | Details (Arabic) |
    | Supplier  | Asset Management Department | إدارة األصول |
  * For Supplier row: Extract English text like ["Asset Management Department"] or ["N/A"]
  * For Input row: Extract the COMPLETE English description (often a long sentence): ["All RTA projects/initiatives/practices aligned with Circular Economy"]  
  * For Process row: Extract as string: "Manage RTA Circular Economy"
  * For Output row: Extract COMPLETE English text: ["Annual report for CE performance in RTA to the HE DG."]
  * For Customer row: Extract COMPLETE English text: ["All RTA's sectors and agencies and its affiliated departments."]
  * IMPORTANT: DO NOT return empty arrays. If you cannot find text, use ["NOT FOUND"] so we can debug. Only use ["N/A"] if the cell actually says "N/A".
- If multiple pages, merge into a single graph
- Flag stepCountDiscrepancy if flowchartBoxCount != activitiesTableCount`;

      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, ...visionContent],
          },
        ],
      });

      const visionText =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      if (!visionText || visionText.trim().length === 0) {
        throw new Error("Vision API returned empty content");
      }

      return visionText;
    } catch (error) {
      // Re-throw the error so it can be caught by the calling function
      throw error;
    }
  }

  async analyzeProcess(content: string): Promise<ProcessAnalysis> {
    // Clean and validate content
    const cleanContent = this.cleanContent(content);
    console.log(
      `[analyzeProcess] Content length: ${cleanContent.length} chars`,
    );

    if (!cleanContent || cleanContent.trim().length === 0) {
      throw new Error("No valid content found in the uploaded file");
    }

    // If the extracted content already contains structured JSON (e.g., from vision OCR), use it directly
    const preParsed = this.tryParseStructuredJSON(cleanContent);
    if (preParsed) {
      console.log(
        `[analyzeProcess] Using pre-parsed JSON with ${preParsed.nodes?.length ?? 0} nodes`,
      );
      return this.mergeStructuredIntoProcessAnalysis(preParsed);
    }

    // Deterministic fallback 1: try to harvest Activities/Responsibilities table directly from raw text
    const harvested = this.extractActivitiesTimingFromText(cleanContent);
    console.log(
      `[analyzeProcess] Harvested ${harvested.length} activities from text`,
    );
    if (harvested.length > 0) {
      const steps = harvested.map((a, idx) => {
        const stepId = a.id ?? `step_${idx + 1}`;
        // Derive department from role if formatted like "Manager - General Budget"
        const department =
          (a.role?.includes("-")
            ? a.role.split("-").pop()?.trim()
            : undefined) ?? "General";
        const role =
          (a.role?.includes("-")
            ? a.role.split("-")[0]?.trim()
            : a.role?.trim()) ?? "Participant";
        return {
          id: stepId,
          name: a.name,
          department,
          role,
          dependencies: [] as string[],
          systemUsed: undefined,
        } satisfies ProcessStep;
      });
      const departments = Array.from(
        new Set(
          steps.map((s) => s.department).filter((d) => d && d.length > 0),
        ),
      );
      const leadTimes: Record<string, number> = {};
      harvested.forEach((a, idx) => {
        const stepId = a.id ?? `step_${idx + 1}`;
        leadTimes[stepId] = a.actualDays;
      });

      const owners: ProcessOwner[] = Array.from(
        new Map(
          steps.map((s) => [
            `${s.department}-${s.role}`,
            {
              department: s.department,
              role: s.role,
              responsibilities: [] as string[],
            },
          ]),
        ).values(),
      );

      return {
        processName: "Business Process",
        departments,
        processOwners: owners,
        processSteps: steps,
        dependencies: {},
        leadTimes,
        // Preserve original text for downstream diagnosis/optimizations
        analysis: cleanContent,
      };
    }

    const prompt = `
      You are extracting an existing, fully reviewed swimlane diagram from a PDF. Do not invent or infer anything. Capture EXACTLY what is present.

      Return STRICT JSON ONLY (no prose, no markdown, no comments) matching this schema:
      {
        "processName": string,
        "departments": string[],
        "processOwners": Array<{ "department": string, "role": string, "responsibilities": string[] }>,
        "processSteps": Array<{ "id": string, "name": string, "department": string, "role": string, "dependencies": string[], "systemUsed"?: boolean }>,
        "dependencies": Record<string, string[]>,
        "leadTimes": Record<string, number>,
        "nodes": Array<{ "id": string, "name": string, "type": "start"|"end"|"task"|"gateway"|"data"|"annotation", "department": string, "role"?: string, "systemUsed"?: boolean }>,
        "edges": Array<{ "from": string, "to": string, "label"?: string }>
      }

      Requirements:
      - Preserve every node (including Start and End), department (swimlane), role/responsible person, decision gateway and connector label exactly as seen.
      - Use node ids that are short and unique (e.g., n1, n2, g1) and reuse them consistently in edges.
      - Include edge labels like Yes/No or condition text when present on connectors.
      - If a field is not present in the diagram, omit it or leave it empty; never guess.
      - Output only valid JSON, no backticks.

      Source (truncated if long):
      ${cleanContent.slice(0, 3000)}
      `;

    try {
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });

      const analysisText =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      // Prefer strict JSON if provided; fall back to heuristic parser otherwise
      const structured = this.tryParseStructuredJSON(analysisText);
      if (structured) {
        return this.mergeStructuredIntoProcessAnalysis(structured);
      }

      // Fallback legacy parsing (use the original content for better signal)
      // Note: the legacy parser expects bullet-like structure; many PDFs won't match it,
      // but we still store the original content in the returned analysis for Phase 1.
      const parsed = this.parseProcessAnalysis(analysisText, cleanContent);
      return { ...parsed, analysis: cleanContent };
    } catch (error) {
      console.error("Error analyzing process:", error);
      throw new Error(
        `Failed to analyze process: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Phase 1: Intelligent diagnosis based on analyzed process
  async diagnoseProcess(analysis: ProcessAnalysis): Promise<ProcessDiagnosis> {
    // If steps weren't parsed, attempt to harvest the Activities table from the raw text
    const hasParsedSteps = analysis.processSteps.length > 0;
    const harvestedActivities = hasParsedSteps
      ? []
      : this.extractActivitiesTimingFromText(analysis.analysis);

    const stepCount = hasParsedSteps
      ? analysis.processSteps.length
      : harvestedActivities.length;

    const departments = (() => {
      if (analysis.departments.length > 0)
        return analysis.departments.join(", ");
      if (!hasParsedSteps && harvestedActivities.length > 0) {
        const derived = Array.from(
          new Set(
            harvestedActivities
              .map((a) => a.role ?? "")
              .filter((r) => r.length > 0)
              .map((r) =>
                r.includes("-") ? (r.split("-").pop()?.trim() ?? r) : r,
              ),
          ),
        ).filter((r) => r.length > 0);
        return derived.join(", ");
      }
      return "";
    })();

    // Build step info including performedBy
    const stepsTimingLines = (
      hasParsedSteps
        ? analysis.processSteps.map((s) => {
            const actual = analysis.leadTimes?.[s.id] ?? 0;
            const available = analysis.leadTimes?.[s.id] ?? actual;
            const role = s.role ?? "Participant";
            // Get performedBy from documentMetadata if available
            const performedBy =
              analysis.documentMetadata?.activitiesTable?.find(
                (a) => a.id === s.id || a.name === s.name,
              )?.performedBy ?? role;
            return `- ${s.id} | ${s.name} | ${s.department} | performedBy:${performedBy} | actual:${actual} | available:${available}`;
          })
        : harvestedActivities.map((a) => {
            const id =
              a.id ??
              (a.name ? a.name.replace(/\s+/g, "_").toLowerCase() : "unknown");
            const performedBy = a.role ?? "Participant";
            return `- ${id} | ${a.name ?? "Unknown"} | performedBy:${performedBy} | actual:${a.actualDays} | available:${a.availableDays}`;
          })
    ).join("\n");

    const depsLines = Object.entries(analysis.dependencies ?? {})
      .map(([k, v]) => `- ${k}: [${(v ?? []).join(", ")}]`)
      .join("\n");

    // Build metadata context for enhanced analysis
    const metadata = analysis.documentMetadata;
    const kpisContext = metadata?.kpis?.length
      ? `\nProcess KPIs:\n${metadata.kpis.map((k) => `- ${k.name}: Target ${k.target}${k.formula ? ` (Formula: ${k.formula})` : ""}`).join("\n")}`
      : "";
    const sipocContext = metadata?.sipoc
      ? `\nSIPOC:\n- Suppliers: ${metadata.sipoc.suppliers?.join(", ") || "N/A"}\n- Inputs: ${metadata.sipoc.inputs?.join(", ") || "N/A"}\n- Outputs: ${metadata.sipoc.outputs?.join(", ") || "N/A"}\n- Customers: ${metadata.sipoc.customers?.join(", ") || "N/A"}`
      : "";
    const controlsContext = metadata?.internalControls?.length
      ? `\nInternal Controls:\n${metadata.internalControls.map((c) => `- ${c.description}${c.controlType ? ` (${c.controlType})` : ""}`).join("\n")}`
      : "";
    const relatedDocsContext = metadata?.relatedDocuments?.length
      ? `\nRelated Standards/Documents:\n${metadata.relatedDocuments.map((d) => `- ${d.name}${d.reference ? ` (${d.reference})` : ""}`).join("\n")}`
      : "";

    const prompt = `
You are a process optimization expert analyzing an organizational workflow for RTA (Roads and Transport Authority).

STEP 1: IDENTIFY THE PROCESS TYPE AND APPLICABLE STANDARDS

Based on the process name and content, determine which international standards apply:

| Process Type Keywords | Applicable Standards |
|----------------------|---------------------|
| asset, assets, registration, inspection, lifecycle, maintenance | ISO 55001 (Asset Management) |
| risk, hazard, mitigation, threat, control | ISO 31000 (Risk Management) |
| software, IT, system, application, license | ISO 19770 (IT Asset Management), ITIL |
| value, benefit, cost-benefit, investment | EN 12973 (Value Management) |
| quality, compliance, audit, governance | ISO 9001 (Quality Management) |
| project, deliverable, milestone | PMI/PRINCE2 principles |

STEP 2: APPLY THE RELEVANT STANDARD'S PRINCIPLES

For ASSET MANAGEMENT processes (ISO 55001):
- Lifecycle perspective: Are decisions considering whole-life costs?
- Risk-based approach: Are critical assets prioritized?
- Value realization: Does the process maximize asset value?
- Integration: Is asset data integrated across systems?

For RISK MANAGEMENT processes (ISO 31000):
- Risk identification: Is there systematic identification?
- Risk assessment: Are likelihood and impact evaluated?
- Risk treatment: Are treatment options properly evaluated?
- Monitoring & review: Is there continuous monitoring?

For IT/SOFTWARE ASSET processes (ISO 19770, ITIL):
- Discovery: Are all software assets identified?
- License compliance: Is licensing tracked?
- Lifecycle management: Is there proper onboarding/offboarding?
- Integration: Is data synchronized across systems?

For VALUE MANAGEMENT processes (EN 12973):
- Function analysis: Are functions clearly defined?
- Value assessment: Is value vs cost evaluated?
- Alternatives: Are alternatives systematically considered?

STEP 3: APPLY LEAN PRINCIPLES (applicable to ALL processes)

Look for the 8 wastes:
- Transport: Unnecessary movement of information/materials between departments
- Inventory: Work items waiting in queues
- Motion: Unnecessary manual steps or data re-entry
- Waiting: Delays between steps, waiting for approvals
- Overproduction: Doing more than required
- Over-processing: Excessive reviews, redundant approvals
- Defects: Steps that cause rework or errors
- Skills underutilization: Manual work that could be automated

STEP 4: APPLY THEORY OF CONSTRAINTS
The bottleneck step limits overall throughput. Identify and address it first.

Given the following process data:

Process Name: ${analysis.processName}
Total Steps: ${stepCount}
Departments Involved: ${departments}
${metadata?.processOwner ? `Process Owner: ${metadata.processOwner}` : ""}
${metadata?.description ? `Description: ${metadata.description}` : ""}
${metadata?.purpose ? `Purpose: ${metadata.purpose}` : ""}
${kpisContext}
${sipocContext}
${controlsContext}
${relatedDocsContext}

Process Steps with Timing and Responsibility:
${stepsTimingLines}

Dependencies:
${depsLines}

Analyze this process and return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "bottlenecks": [
    {
      "stepId": "exact step ID",
      "stepName": "exact step name",
      "reason": "why this is a bottleneck (max 100 chars)",
      "impact": "High|Medium|Low",
      "timingIssue": {
        "actualTime": number,
        "availableTime": number,
        "utilizationPercent": number
      }
    }
  ],
  "redundancies": [
    {
      "steps": ["step1", "step2"],
      "reason": "why these are redundant (max 100 chars)",
      "consolidationSuggestion": "how to merge them"
    }
  ],
  "quickWins": [
    {
      "stepId": "exact step ID",
      "stepName": "exact step name",
      "suggestion": "specific actionable change (max 150 chars)",
      "effort": "Low|Medium|High",
      "impact": "High|Medium|Low",
      "estimatedTimeSaving": "e.g., '5 working days' or 'None'",
      "category": "Automation|Consolidation|Removal|Parallelization|Simplification",
      "performedBy": "Role/department responsible for this step",
      "bestPractice": "ONLY cite if certain. Use exact Lean waste names or accurate ISO terminology. Leave empty string '' if unsure or general optimization."
    }
  ],
  "priorityActions": [
    {
      "action": "concise description",
      "rationale": "why this matters",
      "order": number
    }
  ],
  "processMetrics": {
    "totalDuration": "calculated sum of lead times",
    "criticalPathSteps": ["list of step names on critical path"],
    "departmentHandoffs": number,
    "approvalLayers": number
  },
  "automationClassification": {
    "primaryClassification": "AI Agent|Classical RPA|Manual Optimization",
    "confidenceScore": number,
    "keyFactors": ["top reason 1", "top reason 2"],
    "hybridFlags": {
      "aiAgent": true|false,
      "classicalRpa": true|false,
      "manualOptimization": true|false
    },
    "pathwayScores": {
      "aiAgent": number,
      "classicalRpa": number,
      "manualOptimization": number
    }
  },
  "kpiAnalysis": {
    "currentTargetsRealistic": true|false,
    "suggestedAdjustments": ["If we automate X, target should increase from Y to Z"]
  },
  "controlsAnalysis": {
    "unnecessaryOverhead": ["Controls that add overhead without value"],
    "automationCandidates": ["Manual checks that could be automated"]
  }
}

ANALYSIS CRITERIA:

BOTTLENECK IDENTIFICATION:
- Steps where actual time >= 80% of available time (capacity constraint)
- Steps with 3+ dependencies (coordination bottleneck)
- Steps causing downstream waiting (Lean: Waiting waste)
- Steps with high rework/error rates (Lean: Defects waste)

REDUNDANCY DETECTION:
- Sequential approvals by same department (Lean: Over-processing)
- Duplicate data entry or validation steps (Lean: Motion waste)
- Multiple handoffs that could be consolidated (Lean: Transport waste)
- Parallel review/approval that could be combined

QUICK WIN IDENTIFICATION (prioritize by impact/effort ratio):
1. ELIMINATION: Remove non-value-added steps
2. AUTOMATION: Digitize manual data entry, approvals, notifications
3. PARALLELIZATION: Run independent activities concurrently (Critical Path)
4. CONSOLIDATION: Merge similar activities to reduce handoffs
5. SIMPLIFICATION: Reduce decision points, clarify criteria

For each quick win:
- ALWAYS include performedBy: Extract from the step's swimlane or "Performed By" column
- Be specific and actionable - name the exact change and expected outcome
- bestPractice: BE CONSERVATIVE. Only cite a standard if you are certain the suggestion directly aligns with terminology or principles from that standard. This will be reviewed by experts.
  
  ALLOWED Lean references (these are well-defined):
  * "Lean - Eliminate waiting waste" (only if reducing wait/queue time)
  * "Lean - Eliminate motion waste" (only if reducing unnecessary manual steps/re-entry)
  * "Lean - Reduce over-processing" (only if removing redundant approvals/reviews)
  * "Lean - Reduce transport waste" (only if reducing unnecessary handoffs between departments)
  * "Lean - Prevent defects" (only if adding validation to prevent rework)
  
  ISO references - USE SPARINGLY and only with accurate terminology:
  * "ISO 55001" - Only for asset lifecycle, risk-based asset decisions, asset information management
  * "ISO 31000" - Only for risk identification, assessment, treatment, monitoring
  * "ISO 19770" - Only for software license management, IT asset discovery
  
  When in doubt, leave as empty string "". It's better to have no methodology than to cite incorrectly.
  
- Consider government constraints (compliance, audit trails, transparency)

PRIORITY ACTIONS:
- Address the constraint/bottleneck first
- Consider implementation complexity and change management
- Factor in quick wins that can demonstrate value early

AUTOMATION CLASSIFICATION RULES:
- AI Agent: unstructured documents, judgment-heavy decisions, exceptions handling, cross-system reasoning, language-intensive interactions.
- Classical RPA: repetitive deterministic rules, data entry, status updates, form processing, fixed workflows with low ambiguity.
- Manual Optimization: policy-heavy approvals, low automation feasibility, human negotiation/stakeholder alignment, process redesign needed before automation.
- Hybrid flags can be true for multiple pathways if evidence exists; choose primaryClassification by highest pathwayScores.
- confidenceScore should reflect separation between top two scores and evidence strength.
`.trim();

    try {
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });
      const text =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      const parsed = this.tryParseDiagnosisJSON(text);
      if (parsed) {
        // Ensure all quick wins have performedBy field
        parsed.quickWins = parsed.quickWins.map((qw) => ({
          ...qw,
          performedBy:
            qw.performedBy ??
            this.getPerformedByForStep(qw.stepId, qw.stepName, analysis),
        }));
        return this.ensureDiagnosisClassification(analysis, parsed);
      }
      // Fallback: build deterministic diagnosis rather than throwing
      return this.buildDeterministicDiagnosis(analysis, harvestedActivities);
    } catch (error) {
      console.error("[diagnoseProcess] API call failed:", error);

      // Check for Anthropic API overload error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("overloaded_error") ||
        errorMessage.includes("Overloaded")
      ) {
        throw new Error(
          "Claude AI service is currently experiencing high demand. Please wait a moment and try again.",
        );
      }

      // Check for rate limit errors
      if (errorMessage.includes("rate_limit")) {
        throw new Error(
          "API rate limit reached. Please wait a few minutes before trying again.",
        );
      }

      // For other errors, use fallback
      console.log("[diagnoseProcess] Using fallback diagnosis due to error");
      return this.buildDeterministicDiagnosis(analysis, harvestedActivities);
    }
  }

  // Helper to get performedBy for a step from analysis
  private getPerformedByForStep(
    stepId: string,
    stepName: string,
    analysis: ProcessAnalysis,
  ): string {
    // Try activities table first
    const activityEntry = analysis.documentMetadata?.activitiesTable?.find(
      (a) => a.id === stepId || a.name === stepName,
    );
    if (activityEntry?.performedBy) {
      return activityEntry.performedBy;
    }
    // Try process steps
    const step = analysis.processSteps.find(
      (s) => s.id === stepId || s.name === stepName,
    );
    if (step?.role) {
      return step.role;
    }
    // Try nodes
    const node = analysis.nodes?.find(
      (n) => n.id === stepId || n.name === stepName,
    );
    if (node?.role) {
      return node.role;
    }
    return "Unassigned";
  }

  private cleanContent(content: string): string {
    // Remove or replace problematic characters that might cause API issues
    return content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\r/g, "\n") // Normalize line endings
      .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
      .trim();
  }

  private parseProcessAnalysis(
    analysis: string,
    _originalContent: string,
  ): ProcessAnalysis {
    // Enhanced parsing for process analysis
    const lines = analysis.split("\n");
    const departments: string[] = [];
    const processOwners: ProcessOwner[] = [];
    const processSteps: ProcessStep[] = [];
    const dependencies: Record<string, string[]> = {};
    const leadTimes: Record<string, number> = {};

    let processName = "Business Process";
    let currentSection = "";
    let stepCounter = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (
        trimmedLine.toLowerCase().includes("process name") ||
        trimmedLine.toLowerCase().includes("title")
      ) {
        currentSection = "processname";
      } else if (
        trimmedLine.toLowerCase().includes("department") ||
        trimmedLine.toLowerCase().includes("swim lane")
      ) {
        currentSection = "departments";
      } else if (
        trimmedLine.toLowerCase().includes("owner") ||
        trimmedLine.toLowerCase().includes("role")
      ) {
        currentSection = "owners";
      } else if (
        trimmedLine.toLowerCase().includes("step") ||
        trimmedLine.toLowerCase().includes("task") ||
        trimmedLine.toLowerCase().includes("process")
      ) {
        currentSection = "steps";
      } else if (
        trimmedLine.toLowerCase().includes("dependency") ||
        trimmedLine.toLowerCase().includes("depends")
      ) {
        currentSection = "dependencies";
      } else if (
        trimmedLine.toLowerCase().includes("lead time") ||
        trimmedLine.toLowerCase().includes("duration")
      ) {
        currentSection = "leadtimes";
      }

      // Extract process name
      if (
        currentSection === "processname" &&
        trimmedLine &&
        !trimmedLine.toLowerCase().includes("process name")
      ) {
        processName = trimmedLine.replace(/^[-•*]\s*/, "");
      }

      // Extract departments
      if (
        currentSection === "departments" &&
        (trimmedLine.startsWith("-") ||
          trimmedLine.startsWith("•") ||
          trimmedLine.startsWith("*"))
      ) {
        const dept = trimmedLine.substring(1).trim();
        if (dept && !departments.includes(dept)) {
          departments.push(dept);
        }
      }

      // Extract process owners
      if (
        currentSection === "owners" &&
        (trimmedLine.startsWith("-") ||
          trimmedLine.startsWith("•") ||
          trimmedLine.startsWith("*"))
      ) {
        const ownerText = trimmedLine.substring(1).trim();
        const parts = ownerText.split(":");
        if (parts.length >= 2) {
          const deptRole = parts[0]?.trim() ?? "";
          const responsibilities =
            parts[1]?.split(",").map((r) => r.trim()) ?? [];
          const deptRoleParts = deptRole.split("-");
          if (deptRoleParts.length >= 2) {
            processOwners.push({
              department: deptRoleParts[0]?.trim() ?? "",
              role: deptRoleParts[1]?.trim() ?? "",
              responsibilities,
            });
          }
        }
      }

      // Extract process steps
      if (
        currentSection === "steps" &&
        (trimmedLine.startsWith("-") ||
          trimmedLine.startsWith("•") ||
          trimmedLine.startsWith("*"))
      ) {
        stepCounter++;
        const stepText = trimmedLine.substring(1).trim();
        const stepId = `step_${stepCounter}`;

        // Try to extract department and role from step text
        const deptRoleRegex = /([^-]+)-([^:]+):/;
        const deptRoleMatch = deptRoleRegex.exec(stepText);
        let department = "General";
        let role = "Participant";

        if (deptRoleMatch) {
          department = deptRoleMatch[1]?.trim() ?? "General";
          role = deptRoleMatch[2]?.trim() ?? "Participant";
        }

        processSteps.push({
          id: stepId,
          name: stepText.split(":")[1]?.trim() ?? stepText,
          department,
          role,
          dependencies: [],
          systemUsed:
            stepText.toLowerCase().includes("system") ||
            stepText.toLowerCase().includes("enter"),
        });
      }
    }

    // If no departments found, extract from process owners
    if (departments.length === 0) {
      const uniqueDepts = [
        ...new Set(processOwners.map((owner) => owner.department)),
      ];
      departments.push(...uniqueDepts);
    }

    // If no process owners found, create from steps
    if (processOwners.length === 0) {
      const uniqueOwners = new Map<string, ProcessOwner>();
      processSteps.forEach((step) => {
        const key = `${step.department}-${step.role}`;
        if (!uniqueOwners.has(key)) {
          uniqueOwners.set(key, {
            department: step.department,
            role: step.role,
            responsibilities: [],
          });
        }
      });
      processOwners.push(...Array.from(uniqueOwners.values()));
    }

    return {
      processName,
      departments,
      processOwners,
      processSteps,
      dependencies,
      leadTimes,
      analysis,
    };
  }

  private tryParseStructuredJSON(
    text: string,
  ):
    | (ProcessAnalysis & { nodes: ProcessNode[]; edges: ProcessEdge[] })
    | undefined {
    const extract = (input: string): string | undefined => {
      const trimmed = input.trim();

      // Try to find JSON inside code fences first (most specific)
      const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(input);
      if (fenceMatch?.[1]) {
        const jsonContent = fenceMatch[1].trim();
        console.log("[tryParseStructuredJSON] Found JSON in code fence");
        return jsonContent;
      }

      // Handle TRUNCATED code fence (opening ``` but no closing ```)
      // This happens when Claude's response is cut off due to max_tokens
      const truncatedFenceMatch = /```(?:json)?\s*([\s\S]+)/i.exec(input);
      if (truncatedFenceMatch?.[1]) {
        const jsonContent = truncatedFenceMatch[1].trim();
        // Check if it looks like JSON (starts with {)
        if (jsonContent.startsWith("{")) {
          console.log(
            "[tryParseStructuredJSON] Found truncated code fence, attempting repair",
          );
          return jsonContent;
        }
      }

      // Direct JSON object starting with {
      if (trimmed.startsWith("{")) {
        // Find the matching closing brace
        let braceCount = 0;
        let endIndex = -1;
        for (let i = 0; i < trimmed.length; i++) {
          if (trimmed[i] === "{") braceCount++;
          if (trimmed[i] === "}") braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
        if (endIndex > 0) {
          console.log(
            "[tryParseStructuredJSON] Found JSON starting at beginning",
          );
          return trimmed.substring(0, endIndex);
        }
        // Braces don't balance - return the whole thing for repair attempt
        console.log(
          "[tryParseStructuredJSON] Found unbalanced JSON, will attempt repair",
        );
        return trimmed;
      }

      // Try to find JSON object anywhere in the text (last resort)
      // Look for a complete JSON object with balanced braces
      const jsonStartIndex = input.indexOf("{");
      if (jsonStartIndex >= 0) {
        let braceCount = 0;
        let endIndex = -1;
        for (let i = jsonStartIndex; i < input.length; i++) {
          if (input[i] === "{") braceCount++;
          if (input[i] === "}") braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
        if (endIndex > 0) {
          const extracted = input.substring(jsonStartIndex, endIndex);
          console.log("[tryParseStructuredJSON] Found JSON embedded in text");
          return extracted;
        }
        // Unbalanced but starts with { - extract for repair attempt
        const partialJson = input.substring(jsonStartIndex);
        console.log(
          "[tryParseStructuredJSON] Found unbalanced embedded JSON, will attempt repair",
        );
        return partialJson;
      }

      return undefined;
    };

    // Helper to attempt repairing truncated JSON
    const repairTruncatedJson = (jsonText: string): string | undefined => {
      // Count unbalanced braces and brackets
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;

      for (const char of jsonText) {
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === "\\") {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (char === "{") braceCount++;
        if (char === "}") braceCount--;
        if (char === "[") bracketCount++;
        if (char === "]") bracketCount--;
      }

      // If balanced, return as-is
      if (braceCount === 0 && bracketCount === 0) {
        return jsonText;
      }

      console.log(
        `[tryParseStructuredJSON] Repairing JSON: missing ${braceCount} braces, ${bracketCount} brackets`,
      );

      // Attempt repair: close open strings, brackets, and braces
      let repaired = jsonText;

      // If we're likely in an unclosed string, try to close it
      // Find the last quote and check if it's balanced
      const quoteCount = (jsonText.match(/(?<!\\)"/g) ?? []).length;
      if (quoteCount % 2 !== 0) {
        repaired = repaired + '"';
      }

      // Close any unclosed brackets and braces using repeat
      repaired = repaired + "]".repeat(bracketCount) + "}".repeat(braceCount);

      return repaired;
    };

    const jsonText = extract(text);
    if (!jsonText) {
      console.log("[tryParseStructuredJSON] No JSON found in text");
      console.log(
        `[tryParseStructuredJSON] Text preview: ${text.slice(0, 200)}`,
      );
      return undefined;
    }

    // Helper to validate and return parsed object
    const validateAndReturn = (
      parsedUnknown: unknown,
    ):
      | (ProcessAnalysis & { nodes: ProcessNode[]; edges: ProcessEdge[] })
      | undefined => {
      if (typeof parsedUnknown === "object" && parsedUnknown !== null) {
        const obj = parsedUnknown as Record<string, unknown>;
        const hasName = typeof obj.processName === "string";
        const hasDepts = Array.isArray(obj.departments);
        const hasNodes = Array.isArray((obj as { nodes?: unknown }).nodes);
        const hasEdges = Array.isArray((obj as { edges?: unknown }).edges);
        const hasActivities = Array.isArray(
          (obj as { activitiesTable?: unknown }).activitiesTable,
        );
        const nodesCount = hasNodes
          ? ((obj as { nodes?: unknown[] }).nodes?.length ?? 0)
          : 0;
        const edgesCount = hasEdges
          ? ((obj as { edges?: unknown[] }).edges?.length ?? 0)
          : 0;
        const activitiesCount = hasActivities
          ? ((obj as { activitiesTable?: unknown[] }).activitiesTable?.length ??
            0)
          : 0;
        console.log(
          `[tryParseStructuredJSON] Parsed: hasName=${hasName}, nodes=${nodesCount}, edges=${edgesCount}, activities=${activitiesCount}`,
        );
        // Accept if we have processName and either nodes or activitiesTable
        if (hasName && (hasNodes || hasActivities)) {
          // Ensure arrays exist even if empty
          if (!hasNodes) obj.nodes = [];
          if (!hasEdges) obj.edges = [];
          if (!hasDepts) obj.departments = [];
          return obj as unknown as ProcessAnalysis & {
            nodes: ProcessNode[];
            edges: ProcessEdge[];
          };
        } else {
          console.log(
            "[tryParseStructuredJSON] JSON validation failed - missing required fields",
          );
        }
      }
      return undefined;
    };

    // First attempt: parse as-is
    try {
      const parsedUnknown: unknown = JSON.parse(jsonText);
      const result = validateAndReturn(parsedUnknown);
      if (result) return result;
    } catch (e) {
      console.log(
        "[tryParseStructuredJSON] Initial JSON parse error:",
        e instanceof Error ? e.message : "unknown",
      );

      // Second attempt: try to repair truncated JSON
      const repairedJson = repairTruncatedJson(jsonText);
      if (repairedJson && repairedJson !== jsonText) {
        console.log(
          `[tryParseStructuredJSON] Attempting parse with repaired JSON (added ${repairedJson.length - jsonText.length} chars)`,
        );
        try {
          const parsedRepaired: unknown = JSON.parse(repairedJson);
          const result = validateAndReturn(parsedRepaired);
          if (result) {
            console.log(
              "[tryParseStructuredJSON] Successfully parsed repaired JSON!",
            );
            return result;
          }
        } catch (repairError) {
          console.log(
            "[tryParseStructuredJSON] Repaired JSON also failed to parse:",
            repairError instanceof Error ? repairError.message : "unknown",
          );
        }
      }

      console.log(
        `[tryParseStructuredJSON] Failed JSON preview: ${jsonText.slice(0, 300)}`,
      );
      return undefined;
    }
    return undefined;
  }

  private mergeStructuredIntoProcessAnalysis(
    structured: ProcessAnalysis & {
      nodes?: ProcessNode[];
      edges?: ProcessEdge[];
      activitiesTable?: ActivityTableEntry[];
      flowchartBoxCount?: number;
      activitiesTableCount?: number;
      stepCountDiscrepancy?: boolean;
      sipoc?: SIPOCEntry;
      kpis?: ProcessKPI[];
      internalControls?: InternalControl[];
      relatedDocuments?: RelatedDocument[];
      approvals?: ApprovalEntry[];
      processId?: string;
      processOwner?: string;
      department?: string;
      section?: string;
      description?: string;
      purpose?: string;
      scope?: string;
      processNameArabic?: string;
    },
  ): ProcessAnalysis {
    // Build legacy fields from nodes when possible
    // Prefer activitiesTable as source of truth when available
    const activitiesTable = structured.activitiesTable ?? [];

    const processSteps: ProcessStep[] = structured.processSteps?.length
      ? structured.processSteps
      : activitiesTable.length > 0
        ? activitiesTable.map((a, index) => ({
            id: a.id || `step_${index + 1}`,
            name: a.name,
            department: a.department ?? a.performedBy ?? "General",
            role: a.performedBy ?? "Participant",
            dependencies: [],
            systemUsed: a.systemUsed ? true : undefined,
            leadTime: a.actualTime,
          }))
        : (structured.nodes ?? [])
            .filter((n) => n.type === "task")
            .map((n, index) => ({
              id: n.id || `step_${index + 1}`,
              name: n.name,
              department: n.department,
              role: n.role ?? "Participant",
              dependencies: [],
              systemUsed: n.systemUsed,
            }));

    // Build leadTimes from activities table if available
    const leadTimes: Record<string, number> = structured.leadTimes ?? {};
    if (activitiesTable.length > 0 && Object.keys(leadTimes).length === 0) {
      activitiesTable.forEach((a) => {
        if (a.id && a.actualTime) {
          leadTimes[a.id] = a.actualTime;
        }
      });
    }

    // Build document metadata
    const documentMetadata: ProcessDocumentMetadata = {
      processId: structured.processId,
      processName: structured.processName,
      processNameArabic: structured.processNameArabic,
      processOwner: structured.processOwner,
      department: structured.department,
      section: structured.section,
      description: structured.description,
      purpose: structured.purpose,
      scope: structured.scope,
      sipoc: structured.sipoc
        ? {
            suppliers:
              (structured.sipoc.suppliers ??
              (structured.sipoc as unknown as Record<string, unknown>).supplier)
                ? [
                    String(
                      structured.sipoc.suppliers ??
                        (structured.sipoc as unknown as Record<string, unknown>)
                          .supplier,
                    ),
                  ]
                : [],
            inputs:
              (structured.sipoc.inputs ??
              (structured.sipoc as unknown as Record<string, unknown>).input)
                ? [
                    String(
                      structured.sipoc.inputs ??
                        (structured.sipoc as unknown as Record<string, unknown>)
                          .input,
                    ),
                  ]
                : [],
            process: String(structured.sipoc.process ?? ""),
            outputs:
              (structured.sipoc.outputs ??
              (structured.sipoc as unknown as Record<string, unknown>).output)
                ? [
                    String(
                      structured.sipoc.outputs ??
                        (structured.sipoc as unknown as Record<string, unknown>)
                          .output,
                    ),
                  ]
                : [],
            customers:
              (structured.sipoc.customers ??
              (structured.sipoc as unknown as Record<string, unknown>).customer)
                ? [
                    String(
                      structured.sipoc.customers ??
                        (structured.sipoc as unknown as Record<string, unknown>)
                          .customer,
                    ),
                  ]
                : [],
          }
        : undefined,
      kpis: structured.kpis ?? [],
      relatedDocuments: structured.relatedDocuments ?? [],
      internalControls: structured.internalControls ?? [],
      approvals: structured.approvals ?? [],
      activitiesTable: activitiesTable,
      flowchartBoxCount: structured.flowchartBoxCount,
      activitiesTableCount:
        structured.activitiesTableCount ?? activitiesTable.length,
      stepCountDiscrepancy: structured.stepCountDiscrepancy,
    };

    return {
      processName: structured.processName,
      departments: structured.departments,
      processOwners: structured.processOwners ?? [],
      processSteps,
      dependencies: structured.dependencies ?? {},
      leadTimes,
      analysis: JSON.stringify(structured),
      nodes: structured.nodes,
      edges: structured.edges,
      documentMetadata,
    };
  }

  async optimizeProcess(
    currentAnalysis: ProcessAnalysis,
    optimizationCriteria: string,
  ): Promise<ProcessOptimization> {
    const cleanCriteria = this.cleanContent(optimizationCriteria);

    const prompt = `
You are modifying a business process based on specific optimization criteria.

Current Process (${currentAnalysis.processSteps.length} steps):
${currentAnalysis.processSteps
  .map(
    (step) =>
      `- ID: ${step.id}, Name: ${step.name}, Dept: ${step.department}, Role: ${step.role}`,
  )
  .join("\n")}

${
  currentAnalysis.nodes && currentAnalysis.nodes.length > 0
    ? `\nCurrent Graph Structure:
Nodes: ${currentAnalysis.nodes.length}
${currentAnalysis.nodes.map((n) => `  - ${n.id}: ${n.name} (${n.type}, ${n.department})`).join("\n")}

Edges: ${currentAnalysis.edges?.length ?? 0}
${(currentAnalysis.edges ?? []).map((e) => `  - ${e.from} → ${e.to}${e.label ? ` [${e.label}]` : ""}`).join("\n")}`
    : ""
}

Optimization Instructions (apply these changes based on best practice recommendations):
${cleanCriteria}

CRITICAL INSTRUCTIONS:
1. Apply ONLY the changes specified in the optimization instructions above
2. If removing step X: remove its node, remove all edges to/from it, reconnect predecessor to successor
3. If merging steps A+B: remove B's node, update A's node name, reconnect B's edges to A  
4. If parallelizing: adjust edge connections to enable parallel execution
5. Preserve all unchanged steps/nodes/edges exactly as they are
6. IMPORTANT: Each node in the "nodes" array MUST have a "name" field with the actual step name (not generic labels like "Step" or "Decision")
7. Copy node names from the current graph structure above when preserving nodes
8. Maintain process integrity: ensure no orphan nodes (all nodes must be connected)
9. Preserve necessary control points and compliance requirements

Return ONLY a valid JSON object with this structure (no markdown fences, no explanations):

{
  "processName": "${currentAnalysis.processName}",
  "departments": ${JSON.stringify(currentAnalysis.departments)},
  "processOwners": ${JSON.stringify(currentAnalysis.processOwners)},
  "processSteps": [],
  "dependencies": {},
  "leadTimes": ${JSON.stringify(currentAnalysis.leadTimes)},
  "nodes": [],
  "edges": []
}

IMPORTANT: 
- Start your response with { and end with }
- Do NOT include any text before or after the JSON
- Do NOT use markdown code fences like \`\`\`json
- Return ONLY the JSON object

JSON output:`;

    try {
      console.log("[optimizeProcess] Starting optimization...");
      console.log(`[optimizeProcess] Criteria: ${cleanCriteria.slice(0, 200)}`);

      // First attempt a deterministic edit (e.g., remove step) to avoid hallucination
      const deterministicallyEdited = this.applyDeterministicChange(
        currentAnalysis,
        cleanCriteria,
      );
      if (deterministicallyEdited) {
        console.log("[optimizeProcess] Applied deterministic change");
        console.log(
          `[optimizeProcess] Original steps: ${currentAnalysis.processSteps.length}, Optimized steps: ${deterministicallyEdited.processSteps.length}`,
        );
        console.log(
          `[optimizeProcess] Original nodes: ${currentAnalysis.nodes?.length ?? 0}, Optimized nodes: ${deterministicallyEdited.nodes?.length ?? 0}`,
        );
        return {
          originalProcess: currentAnalysis,
          optimizationCriteria: optimizationCriteria,
          optimizedProcess: deterministicallyEdited,
        };
      }

      console.log("[optimizeProcess] Using AI-based optimization...");
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000, // Increased for complex process modifications with full node/edge arrays
        messages: [{ role: "user", content: prompt }],
      });

      const optimizationText =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      console.log(
        `[optimizeProcess] AI response length: ${optimizationText.length} chars`,
      );
      console.log(
        `[optimizeProcess] AI response preview: ${optimizationText.slice(0, 300)}`,
      );

      const result = this.parseOptimization(
        optimizationText,
        currentAnalysis,
        optimizationCriteria,
      );

      console.log(
        `[optimizeProcess] Original steps: ${result.originalProcess.processSteps.length}, Optimized steps: ${result.optimizedProcess.processSteps.length}`,
      );
      console.log(
        `[optimizeProcess] Original nodes: ${result.originalProcess.nodes?.length ?? 0}, Optimized nodes: ${result.optimizedProcess.nodes?.length ?? 0}`,
      );

      return result;
    } catch (error) {
      console.error("[optimizeProcess] Error:", error);
      throw new Error(
        `Failed to optimize process: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private parseOptimization(
    optimizationText: string,
    currentAnalysis: ProcessAnalysis,
    criteria: string,
  ): ProcessOptimization {
    // Try to parse the AI's JSON response
    const parsed = this.tryParseStructuredJSON(optimizationText);

    if (parsed) {
      // Successfully parsed structured optimization response
      const optimizedAnalysis = this.mergeStructuredIntoProcessAnalysis(parsed);
      return {
        originalProcess: currentAnalysis,
        optimizationCriteria: criteria,
        optimizedProcess: optimizedAnalysis,
      };
    }

    // Fallback: if AI didn't return valid JSON, return unchanged
    console.warn(
      "[parseOptimization] Failed to parse AI optimization response as JSON, returning unchanged process",
    );
    const optimizedAnalysis: ProcessAnalysis = {
      ...currentAnalysis,
      processSteps: [...currentAnalysis.processSteps],
      analysis: optimizationText,
    };

    return {
      originalProcess: currentAnalysis,
      optimizationCriteria: criteria,
      optimizedProcess: optimizedAnalysis,
    };
  }

  async createCurrentProcessDiagram(
    analysis: ProcessAnalysis,
  ): Promise<string> {
    if (this.hasStructuredGraph(analysis)) {
      const mermaid = this.buildMermaidFromStructured(analysis);
      console.log(
        "[createCurrentProcessDiagram] Generated Mermaid (first 500 chars):",
        mermaid.substring(0, 500),
      );
      return mermaid;
    }

    // Fallback to LLM rendering if structured graph is not available
    const prompt = `
      Create a Mermaid flowchart diagram for this business process with horizontal swim lanes (departments) and process steps.
      Return ONLY the mermaid code without any markdown formatting or explanations.

      Process: ${analysis.processName}
      Departments: ${analysis.departments?.join(", ") || "N/A"}
      
      Process Steps:
      ${(analysis.processSteps ?? [])
        .map((step) => `- ${step.department} - ${step.role}: ${step.name}`)
        .join("\n")}

      IMPORTANT REQUIREMENTS:
      - Use flowchart LR (left to right direction)
      - Use subgraphs for each department as swim lanes
      - Show the actual process flow with arrows between steps; include decision branches as gateways
      - Each department should be a separate subgraph
      - Do not include any examples or placeholders; only output the actual diagram
      - Return ONLY the mermaid code, no explanations
      `;

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const result =
      message.content[0]?.type === "text"
        ? (message.content[0].text ?? "")
        : "";
    return this.cleanMermaidCode(result);
  }

  async createOptimizedProcessDiagram(
    optimization: ProcessOptimization,
  ): Promise<string> {
    if (this.hasStructuredGraph(optimization.optimizedProcess)) {
      // Debug: Check for nodes without names
      const nodesWithoutNames = (
        optimization.optimizedProcess.nodes ?? []
      ).filter((n) => !n.name || n.name.trim().length === 0);
      if (nodesWithoutNames.length > 0) {
        console.warn(
          "[createOptimizedProcessDiagram] WARNING: Found nodes without names:",
          nodesWithoutNames.map((n) => ({ id: n.id, type: n.type })),
        );
      }

      const mermaid = this.buildMermaidFromStructured(
        optimization.optimizedProcess,
      );
      console.log(
        "[createOptimizedProcessDiagram] Generated Mermaid (first 500 chars):",
        mermaid.substring(0, 500),
      );
      return mermaid;
    }

    const prompt = `
      Create an optimized Mermaid flowchart diagram for the optimized process.
      Use horizontal swim lanes (LR direction).
      Return ONLY the mermaid code without markdown formatting.

      Original Process: ${optimization.originalProcess.processName}
      Optimization Criteria: ${optimization.optimizationCriteria}

      Process Steps (Updated):
      ${optimization.optimizedProcess.processSteps
        .map((step) => `- ${step.department} - ${step.role}: ${step.name}`)
        .join("\n")}

      Format with horizontal swim lanes:
      flowchart LR
          subgraph "Department A"
              A1[Step 1]
              A2[Step 2]
          end
          subgraph "Department B"
              B1[Step 3]
              B2[Step 4]
          end
          A1 --> A2
          A2 --> B1
          B1 --> B2

      IMPORTANT REQUIREMENTS:
      - Use flowchart LR (left to right direction)
      - Use subgraphs for each department as swim lanes
      - Keep step names short (under 30 characters)
      - Show sequential flow with arrows between steps
      - Return ONLY the mermaid code, no explanations
      `;

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const result =
      message.content[0]?.type === "text"
        ? (message.content[0].text ?? "")
        : "";
    return this.cleanMermaidCode(result);
  }

  private cleanMermaidCode(code: string): string {
    let result = code.trim();

    // Remove markdown code blocks if present
    if (result.startsWith("```mermaid")) {
      result = result.substring(10);
    }
    if (result.startsWith("```")) {
      result = result.substring(3);
    }
    if (result.endsWith("```")) {
      result = result.substring(0, result.length - 3);
    }

    return result.trim();
  }

  async generateOptimizationResults(
    content: string,
    optimizationCriteria: string,
  ): Promise<OptimizationResults> {
    // Analyze the current process
    const currentAnalysis = await this.analyzeProcess(content);

    // Optimize the process based on criteria
    const optimization = await this.optimizeProcess(
      currentAnalysis,
      optimizationCriteria,
    );

    // Generate mermaid diagrams
    const [currentMermaid, optimizedMermaid] = await Promise.all([
      this.createCurrentProcessDiagram(currentAnalysis),
      this.createOptimizedProcessDiagram(optimization),
    ]);

    return {
      currentAnalysis,
      currentMermaid,
      optimization,
      optimizedMermaid,
    };
  }

  // Phase 3: Generate SOP document (MVP - markdown)
  async generateSOPDocument(params: {
    processName: string;
    originalContent: string;
    optimizedMermaid: string;
    appliedChanges: Array<{
      changeDescription: string;
      impact?: string;
      affectedDepartment?: string;
      performedBy?: string;
    }>;
    impactAnalysis?: unknown;
    processId?: string;
    processOwner?: string;
    department?: string;
    section?: string;
    documentMetadata?: ProcessDocumentMetadata;
    diagnosis?: ProcessDiagnosis;
  }): Promise<string> {
    const {
      processName,
      originalContent,
      optimizedMermaid,
      appliedChanges,
      impactAnalysis,
      processId,
      processOwner,
      department,
      section,
      documentMetadata,
    } = params;

    // Build changes list
    const changesList =
      appliedChanges
        .map(
          (c) =>
            `- ${c.changeDescription}${c.impact ? ` (Impact: ${c.impact})` : ""}${c.affectedDepartment ? ` [${c.affectedDepartment}]` : ""}${c.performedBy ? ` - Performed by: ${c.performedBy}` : ""}`,
        )
        .join("\n") || "- None";

    // Build KPIs context
    const kpisContext = documentMetadata?.kpis?.length
      ? `\nCurrent KPIs:\n${documentMetadata.kpis.map((k) => `- ${k.name}: Target ${k.target}${k.formula ? ` (Formula: ${k.formula})` : ""}`).join("\n")}`
      : "";

    // Build SIPOC context - create the actual markdown table
    const sipocContext = documentMetadata?.sipoc
      ? `\nCurrent SIPOC (use this exact table in the SOP):\n\n| Component | Details |\n|-----------|----------|\n| Suppliers | ${documentMetadata.sipoc.suppliers?.join(", ") || "N/A"} |\n| Inputs | ${documentMetadata.sipoc.inputs?.join(", ") || "N/A"} |\n| Process | ${documentMetadata.sipoc.process || "N/A"} |\n| Outputs | ${documentMetadata.sipoc.outputs?.join(", ") || "N/A"} |\n| Customers | ${documentMetadata.sipoc.customers?.join(", ") || "N/A"} |`
      : "";

    // Build controls context
    const controlsContext = documentMetadata?.internalControls?.length
      ? `\nCurrent Internal Controls:\n${documentMetadata.internalControls.map((c) => `- ${c.description}${c.controlType ? ` (${c.controlType})` : ""}`).join("\n")}`
      : "";

    // Build related documents context
    const relatedDocsContext = documentMetadata?.relatedDocuments?.length
      ? `\nRelated Standards/Documents:\n${documentMetadata.relatedDocuments.map((d) => `- ${d.name}${d.reference ? ` (${d.reference})` : ""}`).join("\n")}`
      : "";

    const today = new Date().toISOString().split("T")[0] ?? "";
    const sopPrompt = `
You are generating an updated Standard Operating Procedure (SOP) document for RTA (Roads and Transport Authority).

CRITICAL RULES:
1. DO NOT invent, fabricate, or hallucinate ANY information
2. ONLY include data that was explicitly provided below
3. If information is missing, write "NOT AVAILABLE" or omit that section entirely
4. DO NOT generate placeholder values, example durations, or made-up metrics
5. DO NOT invent KPI targets, activity durations, or performance numbers

Original Process Information:
${originalContent.slice(0, 2000)}

Provided metadata (ONLY use what's explicitly present):
- Process ID: ${processId ?? documentMetadata?.processId ?? "NOT AVAILABLE"}
- Process Name: ${processName}
- Process Owner: ${processOwner ?? documentMetadata?.processOwner ?? "NOT AVAILABLE"}
- Department: ${department ?? documentMetadata?.department ?? "NOT AVAILABLE"}
- Section: ${section ?? documentMetadata?.section ?? "NOT AVAILABLE"}
${kpisContext}
${sipocContext}
${controlsContext}
${relatedDocsContext}

Optimization Changes Applied:
${changesList}

Optimized Process Mermaid:
${optimizedMermaid}

Impact Analysis (actual calculated data):
${impactAnalysis ? JSON.stringify(impactAnalysis).slice(0, 1000) : "NOT AVAILABLE"}

Generate an SOP document in markdown with ONLY the following sections where data exists:

# ${(processId ?? documentMetadata?.processId) ? `${processId ?? documentMetadata?.processId} - ` : ""}${processName}

## Issue Details
- Issue Date: ${today}
- Change Type: Process Optimization Update

## Process Information
- Process Name: ${processName}
${(processId ?? documentMetadata?.processId) ? `- Process ID: ${processId ?? documentMetadata?.processId}` : ""}
${(processOwner ?? documentMetadata?.processOwner) ? `- Process Owner: ${processOwner ?? documentMetadata?.processOwner}` : ""}
${(section ?? documentMetadata?.section) ? `- Section: ${section ?? documentMetadata?.section}` : ""}
${(department ?? documentMetadata?.department) ? `- Department: ${department ?? documentMetadata?.department}` : ""}

${documentMetadata?.description ? `## Description\n${documentMetadata.description}\n` : ""}

${documentMetadata?.purpose ? `## Purpose\n${documentMetadata.purpose}\n` : ""}

${documentMetadata?.scope ? `## Scope\n${documentMetadata.scope}\n` : ""}

${documentMetadata?.sipoc ? `## SIPOC\n\n| Component | Details |\n|-----------|----------|\n| Suppliers | ${documentMetadata.sipoc.suppliers?.join(", ") || "N/A"} |\n| Inputs | ${documentMetadata.sipoc.inputs?.join(", ") || "N/A"} |\n| Process | ${documentMetadata.sipoc.process || "N/A"} |\n| Outputs | ${documentMetadata.sipoc.outputs?.join(", ") || "N/A"} |\n| Customers | ${documentMetadata.sipoc.customers?.join(", ") || "N/A"} |\n` : ""}

${kpisContext ? `## Process KPIs\nList the KPIs provided above. DO NOT invent new targets or improvements unless explicitly stated in the impact analysis.\n` : ""}

## Process Model (Optimized Flow)
\`\`\`mermaid
${optimizedMermaid}
\`\`\`

## Optimization Change Log
| Change Applied | Performed By | Impact |
|----------------|--------------|--------|
${appliedChanges.map((c) => `| ${c.changeDescription} | ${c.performedBy ?? "N/A"} | ${c.impact ?? "N/A"} |`).join("\n")}

${impactAnalysis ? `## Impact Analysis\nSummarize the actual calculated improvements from the impact analysis data above (steps reduced, time saved, etc.). DO NOT invent numbers.\n` : ""}

${controlsContext ? `## Internal Controls\nList the internal controls provided above. Note any that were affected by the optimization changes.\n` : ""}

${relatedDocsContext || ""}

## Document Revision History
- Date: ${today}
- Change: Process optimization applied
- Changes: ${appliedChanges.length} optimization(s) implemented
${impactAnalysis ? `- Impact: See Impact Analysis section above` : ""}

Return ONLY the markdown for the SOP. DO NOT add fabricated sections, invented metrics, or placeholder data.
`.trim();

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 6000,
      messages: [{ role: "user", content: sopPrompt }],
    });
    const md =
      message.content[0]?.type === "text"
        ? (message.content[0].text ?? "")
        : "";
    return md.trim();
  }

  // ─── Multi-process extraction + parallel diagnosis ───────────────────────

  /**
   * Extracts ALL distinct processes from a document using Claude Opus with
   * forced tool-calling, which guarantees valid structured JSON output.
   */
  async extractAllProcessesFromDocument(
    base64Content: string,
    fileType: string,
  ): Promise<ProcessAnalysis[]> {
    const extractionTool = {
      name: "extract_all_processes",
      description:
        "Extract every distinct business process found in the document. " +
        "A distinct process has its own title, flowchart/swimlane diagram, or activities table. " +
        "Use ENGLISH text for every field value; store Arabic only in the dedicated Arabic fields.",
      input_schema: {
        type: "object" as const,
        properties: {
          processes: {
            type: "array",
            description: "All distinct processes found in the document",
            items: {
              type: "object",
              properties: {
                processName: {
                  type: "string",
                  description: "Process name in English",
                },
                processNameArabic: {
                  type: "string",
                  description: "Process name in Arabic if available",
                },
                processId: {
                  type: "string",
                  description: "Process identifier code",
                },
                processOwner: {
                  type: "string",
                  description: "Role or name of process owner",
                },
                department: {
                  type: "string",
                  description: "Primary department",
                },
                section: {
                  type: "string",
                  description: "Section within department",
                },
                description: {
                  type: "string",
                  description: "What this process does",
                },
                purpose: {
                  type: "string",
                  description: "Why this process exists",
                },
                scope: {
                  type: "string",
                  description: "Boundaries of the process",
                },
                departments: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "All departments appearing as swimlanes in this process",
                },
                processOwners: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      department: { type: "string" },
                      role: { type: "string" },
                      responsibilities: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["department", "role"],
                  },
                },
                nodes: {
                  type: "array",
                  description:
                    "All flowchart nodes with English labels. Every rectangular task box = task, diamond = gateway, oval = start/end.",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "Short unique node ID e.g. n1, g2, start1",
                      },
                      name: {
                        type: "string",
                        description: "English label for this node",
                      },
                      type: {
                        type: "string",
                        enum: [
                          "start",
                          "end",
                          "task",
                          "gateway",
                          "data",
                          "annotation",
                        ],
                      },
                      department: {
                        type: "string",
                        description: "Which swimlane/department owns this node",
                      },
                      role: {
                        type: "string",
                        description: "Role performing this step",
                      },
                      systemUsed: { type: "boolean" },
                    },
                    required: ["id", "name", "type", "department"],
                  },
                },
                edges: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      from: { type: "string" },
                      to: { type: "string" },
                      label: {
                        type: "string",
                        description: "Connector label e.g. Yes / No",
                      },
                    },
                    required: ["from", "to"],
                  },
                },
                activitiesTable: {
                  type: "array",
                  description:
                    "Row-by-row contents of the Activities and Responsibilities table",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        description: "Activity ID like CS.H.3.1.01",
                      },
                      name: {
                        type: "string",
                        description: "Activity name in English",
                      },
                      nameArabic: { type: "string" },
                      performedBy: {
                        type: "string",
                        description: "Role/department performing this activity",
                      },
                      actualTime: {
                        type: "number",
                        description: "Actual execution time (numeric)",
                      },
                      actualTimeUnit: {
                        type: "string",
                        description: "Unit: Working Days, Hours, etc.",
                      },
                      availableTime: {
                        type: "number",
                        description: "Available/allocated time (numeric)",
                      },
                      availableTimeUnit: { type: "string" },
                      department: { type: "string" },
                      systemUsed: { type: "string" },
                    },
                    required: [
                      "id",
                      "name",
                      "performedBy",
                      "actualTime",
                      "actualTimeUnit",
                      "availableTime",
                      "availableTimeUnit",
                    ],
                  },
                },
                kpis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      nameArabic: { type: "string" },
                      target: { type: "string" },
                      formula: { type: "string" },
                      measurementFrequency: { type: "string" },
                      dataSource: { type: "string" },
                    },
                    required: ["name", "target"],
                  },
                },
                sipoc: {
                  type: "object",
                  properties: {
                    suppliers: { type: "array", items: { type: "string" } },
                    inputs: { type: "array", items: { type: "string" } },
                    process: { type: "string" },
                    outputs: { type: "array", items: { type: "string" } },
                    customers: { type: "array", items: { type: "string" } },
                  },
                  required: [
                    "suppliers",
                    "inputs",
                    "process",
                    "outputs",
                    "customers",
                  ],
                },
                internalControls: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      controlId: { type: "string" },
                      description: { type: "string" },
                      riskMitigated: { type: "string" },
                      controlType: { type: "string" },
                    },
                    required: ["description"],
                  },
                },
                relatedDocuments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      reference: { type: "string" },
                      type: { type: "string" },
                    },
                    required: ["name"],
                  },
                },
                approvals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      role: { type: "string" },
                      name: { type: "string" },
                      date: { type: "string" },
                    },
                    required: ["role"],
                  },
                },
                flowchartBoxCount: {
                  type: "number",
                  description:
                    "Number of rectangular task boxes counted in the flowchart",
                },
                activitiesTableCount: {
                  type: "number",
                  description: "Number of rows in the activities table",
                },
                stepCountDiscrepancy: { type: "boolean" },
              },
              required: [
                "processName",
                "departments",
                "nodes",
                "edges",
                "activitiesTable",
                "kpis",
                "sipoc",
                "internalControls",
                "relatedDocuments",
                "approvals",
              ],
            },
          },
        },
        required: ["processes"],
      },
    };

    const userText = `Analyze this document and extract ALL distinct business processes using the extract_all_processes tool.

For each process extract:
1. Complete metadata (name, owner, department, scope, purpose, description)
2. ALL flowchart nodes with exact English labels (task boxes, gateways, start/end ovals)
3. ALL directed edges/connections between nodes with their labels
4. The complete Activities & Responsibilities table — every row with ID, name, performedBy, actualTime, availableTime
5. SIPOC table
6. KPIs with targets and formulas
7. Internal controls
8. Related documents and approvals

CRITICAL RULES:
- Extract EVERY distinct process found (document may contain 1 to many processes)
- Use ENGLISH text for all name/label fields; Arabic text only in Arabic-suffixed fields
- Include ALL nodes — every rectangular task box, diamond gateway, and oval start/end
- Capture edge labels (Yes/No, conditions)
- Activities table: capture every row; do NOT omit or abbreviate
- Do NOT truncate arrays — include every item found`;

    let messageContent: Anthropic.MessageParam["content"];

    if (fileType === "application/pdf") {
      messageContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Content,
          },
        } as Anthropic.DocumentBlockParam,
        { type: "text", text: userText },
      ];
    } else {
      const textContent = Buffer.from(base64Content, "base64").toString(
        "utf-8",
      );
      messageContent = `${userText}\n\nDocument content:\n${textContent}`;
    }

    console.log(
      "[extractAllProcesses] Calling Claude Opus with forced tool calling (streaming)...",
    );
    const startTime = Date.now();

    const stream = await this.client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 32000,
      tools: [extractionTool],
      tool_choice: { type: "tool", name: "extract_all_processes" },
      messages: [{ role: "user", content: messageContent }],
    });

    const response = await stream.finalMessage();

    console.log(
      `[extractAllProcesses] Claude Opus took ${Date.now() - startTime}ms`,
    );

    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    if (toolUseBlock?.type !== "tool_use") {
      throw new Error(
        "Extraction tool was not invoked by the model — cannot continue",
      );
    }

    const input = toolUseBlock.input as {
      processes: Array<Record<string, unknown>>;
    };
    const rawProcesses = input.processes ?? [];

    console.log(
      `[extractAllProcesses] Tool returned ${rawProcesses.length} process(es)`,
    );

    return rawProcesses.map((p) =>
      this.mergeStructuredIntoProcessAnalysis(p as unknown as ProcessAnalysis),
    );
  }

  /**
   * Diagnoses a single process using forced tool-calling for guaranteed
   * structured JSON output. Falls back to deterministic logic on error.
   */
  async diagnoseProcessWithToolCalling(
    analysis: ProcessAnalysis,
  ): Promise<ProcessDiagnosis> {
    const diagnosisTool = {
      name: "diagnose_process",
      description:
        "Analyze a business process and return a structured diagnosis identifying bottlenecks, redundancies, quick wins, priority actions, and process metrics.",
      input_schema: {
        type: "object" as const,
        properties: {
          bottlenecks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stepId: { type: "string" },
                stepName: { type: "string" },
                reason: {
                  type: "string",
                  description: "Why this is a bottleneck (max 100 chars)",
                },
                impact: { type: "string", enum: ["High", "Medium", "Low"] },
                timingIssue: {
                  type: "object",
                  properties: {
                    actualTime: { type: "number" },
                    availableTime: { type: "number" },
                    utilizationPercent: { type: "number" },
                  },
                  required: [
                    "actualTime",
                    "availableTime",
                    "utilizationPercent",
                  ],
                },
              },
              required: [
                "stepId",
                "stepName",
                "reason",
                "impact",
                "timingIssue",
              ],
            },
          },
          redundancies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                steps: { type: "array", items: { type: "string" } },
                reason: {
                  type: "string",
                  description: "Why these steps are redundant (max 100 chars)",
                },
                consolidationSuggestion: { type: "string" },
              },
              required: ["steps", "reason", "consolidationSuggestion"],
            },
          },
          quickWins: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stepId: { type: "string" },
                stepName: { type: "string" },
                suggestion: {
                  type: "string",
                  description: "Specific actionable change (max 150 chars)",
                },
                effort: { type: "string", enum: ["Low", "Medium", "High"] },
                impact: { type: "string", enum: ["High", "Medium", "Low"] },
                estimatedTimeSaving: {
                  type: "string",
                  description: "e.g. '5 working days'",
                },
                category: {
                  type: "string",
                  enum: [
                    "Automation",
                    "Consolidation",
                    "Removal",
                    "Parallelization",
                    "Simplification",
                  ],
                },
                performedBy: {
                  type: "string",
                  description: "Role/department performing this step",
                },
                bestPractice: {
                  type: "string",
                  description:
                    "Methodology reference e.g. Lean - Eliminate waiting waste. Leave empty string if unsure.",
                },
              },
              required: [
                "stepId",
                "stepName",
                "suggestion",
                "effort",
                "impact",
                "estimatedTimeSaving",
                "category",
                "performedBy",
              ],
            },
          },
          priorityActions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                rationale: { type: "string" },
                order: { type: "number" },
              },
              required: ["action", "rationale", "order"],
            },
          },
          processMetrics: {
            type: "object",
            properties: {
              totalDuration: {
                type: "string",
                description: "Sum of all step lead times",
              },
              criticalPathSteps: {
                type: "array",
                items: { type: "string" },
              },
              departmentHandoffs: { type: "number" },
              approvalLayers: { type: "number" },
            },
            required: [
              "totalDuration",
              "criticalPathSteps",
              "departmentHandoffs",
              "approvalLayers",
            ],
          },
          automationClassification: {
            type: "object",
            properties: {
              primaryClassification: {
                type: "string",
                enum: ["AI Agent", "Classical RPA", "Manual Optimization"],
              },
              confidenceScore: { type: "number" },
              keyFactors: { type: "array", items: { type: "string" } },
              hybridFlags: {
                type: "object",
                properties: {
                  aiAgent: { type: "boolean" },
                  classicalRpa: { type: "boolean" },
                  manualOptimization: { type: "boolean" },
                },
                required: ["aiAgent", "classicalRpa", "manualOptimization"],
              },
              pathwayScores: {
                type: "object",
                properties: {
                  aiAgent: { type: "number" },
                  classicalRpa: { type: "number" },
                  manualOptimization: { type: "number" },
                },
                required: ["aiAgent", "classicalRpa", "manualOptimization"],
              },
            },
            required: [
              "primaryClassification",
              "confidenceScore",
              "keyFactors",
              "hybridFlags",
              "pathwayScores",
            ],
          },
        },
        required: [
          "bottlenecks",
          "redundancies",
          "quickWins",
          "priorityActions",
          "processMetrics",
          "automationClassification",
        ],
      },
    };

    // Build step context
    const stepLines = (
      analysis.processSteps.length > 0
        ? analysis.processSteps.map((s) => {
            const actual = analysis.leadTimes?.[s.id] ?? 0;
            const performedBy =
              analysis.documentMetadata?.activitiesTable?.find(
                (a) => a.id === s.id || a.name === s.name,
              )?.performedBy ??
              s.role ??
              "Participant";
            return `- ${s.id} | ${s.name} | dept:${s.department} | performedBy:${performedBy} | actualTime:${actual}`;
          })
        : (analysis.documentMetadata?.activitiesTable ?? []).map((a) => {
            return `- ${a.id} | ${a.name} | performedBy:${a.performedBy} | actualTime:${a.actualTime} | availableTime:${a.availableTime}`;
          })
    ).join("\n");

    const meta = analysis.documentMetadata;
    const contextLines = [
      `Process: ${analysis.processName}`,
      `Departments: ${analysis.departments.join(", ")}`,
      meta?.processOwner ? `Owner: ${meta.processOwner}` : "",
      meta?.description ? `Description: ${meta.description}` : "",
      meta?.purpose ? `Purpose: ${meta.purpose}` : "",
      meta?.kpis?.length
        ? `KPIs:\n${meta.kpis.map((k) => `  - ${k.name}: ${k.target}`).join("\n")}`
        : "",
      meta?.sipoc
        ? `SIPOC: Suppliers=${meta.sipoc.suppliers?.join(",")} | Customers=${meta.sipoc.customers?.join(",")}`
        : "",
      `Steps (${analysis.processSteps.length || (meta?.activitiesTable?.length ?? 0)} total):\n${stepLines}`,
    ]
      .filter(Boolean)
      .join("\n");

    const promptText = `You are a process optimization expert analyzing an RTA government workflow. Use the diagnose_process tool to return your structured analysis.

${contextLines}

Apply:
- Lean waste analysis (8 wastes: transport, inventory, motion, waiting, overproduction, over-processing, defects, skills underutilization)
- Theory of Constraints (identify the single bottleneck that limits throughput)
- Government compliance context (audit trails, Arabic/English bilingual operations)

For each quick win, set performedBy to the exact role/department from the steps data above.
For bestPractice, only cite if certain (e.g. "Lean - Eliminate waiting waste"). Leave empty string if unsure.`;

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8000,
        tools: [diagnosisTool],
        tool_choice: { type: "tool", name: "diagnose_process" },
        messages: [{ role: "user", content: promptText }],
      });

      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      if (toolUseBlock?.type !== "tool_use") {
        console.warn(
          "[diagnoseProcessWithToolCalling] Tool not invoked, using fallback",
        );
        return this.buildDeterministicDiagnosis(analysis, []);
      }

      return this.ensureDiagnosisClassification(
        analysis,
        toolUseBlock.input as ProcessDiagnosis,
      );
    } catch (error) {
      console.error("[diagnoseProcessWithToolCalling] Error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes("overloaded_error") ||
        msg.includes("Overloaded") ||
        msg.includes("rate_limit")
      ) {
        throw error;
      }
      return this.buildDeterministicDiagnosis(analysis, []);
    }
  }

  /**
   * End-to-end: extract all processes from a document then run parallel
   * diagnosis for each one. This is the main entry point for multi-process
   * documents.
   */
  async extractAndDiagnoseAllProcesses(
    base64Content: string,
    _fileName: string,
    fileType: string,
  ): Promise<MultiProcessResult> {
    console.log("[extractAndDiagnoseAll] Step 1: Extracting all processes…");
    const t0 = Date.now();

    const analyses = await this.extractAllProcessesFromDocument(
      base64Content,
      fileType,
    );

    console.log(
      `[extractAndDiagnoseAll] Extraction done (${Date.now() - t0}ms) – found ${analyses.length} process(es)`,
    );

    if (analyses.length === 0) {
      throw new Error(
        "No processes were found in the document. Please ensure the file contains at least one process definition with a flowchart or activities table.",
      );
    }

    console.log(
      `[extractAndDiagnoseAll] Step 2: Running parallel diagnosis for ${analyses.length} process(es)…`,
    );
    const t1 = Date.now();

    const diagnosed = await Promise.all(
      analyses.map(async (analysis, idx) => {
        console.log(
          `[extractAndDiagnoseAll]   → Diagnosing [${idx + 1}/${analyses.length}]: "${analysis.processName}"`,
        );
        const [diagnosis, currentMermaid] = await Promise.all([
          this.diagnoseProcessWithToolCalling(analysis),
          this.createCurrentProcessDiagram(analysis),
        ]);
        return {
          processIndex: idx,
          analysis,
          diagnosis,
          currentMermaid,
        } satisfies ProcessWithDiagnosis;
      }),
    );

    console.log(
      `[extractAndDiagnoseAll] All diagnoses done (${Date.now() - t1}ms). TOTAL: ${Date.now() - t0}ms`,
    );

    return { processes: diagnosed };
  }
}

// Helper utilities and deterministic edits
export function sanitizeMermaidId(rawId: string): string {
  // Mermaid identifiers: letters, numbers, underscore. Replace others by underscore.
  let sanitized = rawId.replace(/[^a-zA-Z0-9_]/g, "_");

  // Mermaid reserved keywords that cannot be used as node IDs
  const reservedKeywords = [
    "end",
    "subgraph",
    "graph",
    "flowchart",
    "direction",
    "click",
    "style",
    "class",
    "classDef",
    "linkStyle",
  ];

  // If the sanitized ID matches a reserved keyword (case-insensitive), prefix it
  if (reservedKeywords.includes(sanitized.toLowerCase())) {
    sanitized = `node_${sanitized}`;
  }

  return sanitized;
}

export function escapeMermaidLabel(label: string): string {
  // Escape special characters that can break mermaid syntax
  return label
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\(/g, "-") // Replace parentheses with dashes to avoid syntax conflicts
    .replace(/\)/g, "-")
    .replace(/"/g, "'") // Replace double quotes with single quotes
    .replace(/\n/g, " ") // Replace newlines with spaces
    .replace(/\r/g, " ") // Replace carriage returns with spaces
    .replace(/\t/g, " ") // Replace tabs with spaces
    .replace(/#/g, "") // Remove # which can start comments
    .replace(/;/g, ",") // Replace semicolons
    .replace(/\\/g, "/") // Replace backslashes
    .replace(/\|/g, " ") // Replace pipes
    .replace(/\{/g, "-") // Replace curly braces with dashes
    .replace(/\}/g, "-")
    .replace(/</g, "-") // Replace angle brackets with dashes
    .replace(/>/g, "-")
    .replace(/`/g, "'") // Replace backticks
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/-+/g, "-") // Collapse multiple dashes into one
    .trim();
}

// Instance methods added to class via prototype to keep file organization compact
declare module "./ProcessOptimizer" {
  interface ProcessOptimizer {
    hasStructuredGraph(analysis: ProcessAnalysis): boolean;
    buildMermaidFromStructured(analysis: ProcessAnalysis): string;
    applyDeterministicChange(
      analysis: ProcessAnalysis,
      criteria: string,
    ): ProcessAnalysis | undefined;
  }
}

ProcessOptimizer.prototype.hasStructuredGraph = function (
  analysis: ProcessAnalysis,
): boolean {
  return Boolean(
    analysis.nodes &&
      analysis.nodes.length > 0 &&
      analysis.edges &&
      analysis.edges.length > 0,
  );
};

ProcessOptimizer.prototype.buildMermaidFromStructured = function (
  analysis: ProcessAnalysis,
): string {
  const nodes = analysis.nodes ?? [];
  const edges = analysis.edges ?? [];

  // Create a map of node IDs to step names for fallback
  const nodeIdToStepName = new Map<string, string>();
  (analysis.processSteps ?? []).forEach((step) => {
    nodeIdToStepName.set(step.id, step.name);
  });

  const splitDeptAndRole = (
    full: string,
  ): { department: string; role?: string } => {
    // Keep the department as-is; roles are provided separately on nodes.
    // This avoids mis-splitting real department names that contain " - ".
    return { department: (full ?? "").trim(), role: undefined };
  };

  interface DeptGroup {
    department: string;
    roles: Set<string>;
    items: ProcessNode[];
  }

  const byDept = new Map<string, DeptGroup>();
  nodes.forEach((n) => {
    const { department } = splitDeptAndRole(n.department);
    const role = n.role ? n.role.trim() : undefined;
    const group = byDept.get(department) ?? {
      department,
      roles: new Set<string>(),
      items: [],
    };
    if (role) group.roles.add(role);
    group.items.push({ ...n, department });
    byDept.set(department, group);
  });

  const lines: string[] = [];
  lines.push("flowchart LR");

  // Emit subgraphs by department
  Array.from(byDept.values()).forEach((group) => {
    // Use "General" if department name is empty to avoid invalid Mermaid syntax
    const dept = (group.department.trim() || "General")
      .replace(/"/g, "'") // Escape quotes in subgraph names
      .replace(/\n/g, " ")
      .replace(/\r/g, " ")
      .trim();
    lines.push(`    subgraph "${dept}"`);
    lines.push("        direction TB");
    // Actual process nodes
    group.items.forEach((n) => {
      const id = sanitizeMermaidId(n.id);
      const raw = typeof n.name === "string" ? n.name : "";
      const safe = escapeMermaidLabel(raw).trim();

      // Try to get name from processSteps if node name is empty
      const fallbackName =
        safe.length === 0 ? nodeIdToStepName.get(n.id) : undefined;
      const safeFallback = fallbackName
        ? escapeMermaidLabel(fallbackName).trim()
        : "";

      const label =
        safe.length > 0
          ? safe
          : safeFallback.length > 0
            ? safeFallback
            : n.type === "start"
              ? "Start"
              : n.type === "end"
                ? "End"
                : n.type === "gateway"
                  ? "Decision"
                  : n.type === "data"
                    ? "Data"
                    : "Step"; // Default label for nodes without names

      let nodeLine = "";
      if (n.type === "start") {
        nodeLine = `${id}([${label}])`;
      } else if (n.type === "end") {
        nodeLine = `${id}([${label}])`;
      } else if (n.type === "gateway") {
        nodeLine = `${id}{${label}}`;
      } else if (n.type === "data") {
        // Use database-like pill for data objects: [(label)]
        nodeLine = `${id}[(${label})]`;
      } else {
        nodeLine = `${id}[${label}]`;
      }
      lines.push(`        ${nodeLine}`);
    });
    lines.push("    end");
  });

  // Emit edges after subgraphs
  edges.forEach((e) => {
    const from = sanitizeMermaidId(e.from);
    const to = sanitizeMermaidId(e.to);
    if (e.label && e.label.trim().length > 0) {
      const safeLabel = escapeMermaidLabel(e.label);
      lines.push(`    ${from} -- ${safeLabel} --> ${to}`);
    } else {
      lines.push(`    ${from} --> ${to}`);
    }
  });

  const result = lines.join("\n");

  // Validate: check for common Mermaid syntax issues
  const syntaxIssues: string[] = [];
  lines.forEach((line, idx) => {
    // Check for empty node definitions like "nodeId[]"
    if (/\w+\[\]\s*(?!\-\->)/.test(line)) {
      syntaxIssues.push(
        `Line ${idx + 1}: Empty node label detected: ${line.trim()}`,
      );
    }
    // Check for multiple node definitions on same line
    if (/\]\s*[a-zA-Z_]\w*[\[\{]/.test(line) && !line.includes("-->")) {
      syntaxIssues.push(
        `Line ${idx + 1}: Multiple nodes without connector: ${line.trim()}`,
      );
    }
  });

  if (syntaxIssues.length > 0) {
    console.error(
      "[buildMermaidFromStructured] Syntax issues detected:",
      syntaxIssues,
    );
  }

  return result;
};

ProcessOptimizer.prototype.applyDeterministicChange = function (
  analysis: ProcessAnalysis,
  criteria: string,
): ProcessAnalysis | undefined {
  // Detect remove step requests
  const removeMatch = /remove\s+(?:the\s+)?(?:step\s+)?\"?([^\"]+)\"?/i.exec(
    criteria,
  );
  if (!removeMatch) return undefined;
  const nameToRemove = removeMatch[1]?.trim().toLowerCase();

  // If structured nodes exist, operate on them
  if (analysis.nodes && analysis.nodes.length > 0) {
    const target = analysis.nodes.find(
      (n) =>
        n.type !== "start" &&
        n.type !== "end" &&
        n.name.toLowerCase() === nameToRemove,
    );
    if (!target) return undefined;

    const remainingNodes = analysis.nodes.filter((n) => n.id !== target.id);
    const incoming = (analysis.edges ?? []).filter((e) => e.to === target.id);
    const outgoing = (analysis.edges ?? []).filter((e) => e.from === target.id);
    const passthroughEdges: ProcessEdge[] = [];
    incoming.forEach((inE) => {
      outgoing.forEach((outE) => {
        passthroughEdges.push({ from: inE.from, to: outE.to });
      });
    });
    const remainingEdges = (analysis.edges ?? []).filter(
      (e) => e.from !== target.id && e.to !== target.id,
    );
    const newEdges = [...remainingEdges, ...passthroughEdges];

    const remainingSteps = analysis.processSteps.filter(
      (s) => s.name.toLowerCase() !== nameToRemove,
    );

    return {
      ...analysis,
      processSteps: remainingSteps,
      nodes: remainingNodes,
      edges: newEdges,
      analysis: `${analysis.analysis}\n\n[Applied deterministic removal of step: ${target.name}]`,
    };
  }

  // Fallback: operate on linear steps list
  const idx = analysis.processSteps.findIndex(
    (s) => s.name.toLowerCase() === nameToRemove,
  );
  if (idx === -1) return undefined;
  const removed = analysis.processSteps[idx];
  const newSteps = [
    ...analysis.processSteps.slice(0, idx),
    ...analysis.processSteps.slice(idx + 1),
  ];
  return {
    ...analysis,
    processSteps: newSteps,
    analysis: `${analysis.analysis}\n\n[Applied deterministic removal of step: ${removed ? removed.name : ""}]`,
  };
};

// Local helpers
declare module "./ProcessOptimizer" {
  interface ProcessOptimizer {
    tryParseDiagnosisJSON(text: string): ProcessDiagnosis | undefined;
    extractActivitiesTimingFromText(text: string): Array<{
      id?: string;
      name: string;
      role?: string;
      actualDays: number;
      availableDays: number;
    }>;
    buildDeterministicDiagnosis(
      analysis: ProcessAnalysis,
      harvested: Array<{
        id?: string;
        name: string;
        role?: string;
        actualDays: number;
        availableDays: number;
      }>,
    ): ProcessDiagnosis;
    computeAutomationClassification(
      analysis: ProcessAnalysis,
      diagnosis: Pick<
        ProcessDiagnosis,
        "bottlenecks" | "quickWins" | "processMetrics"
      >,
    ): ProcessAutomationClassification;
    ensureDiagnosisClassification(
      analysis: ProcessAnalysis,
      diagnosis: ProcessDiagnosis,
    ): ProcessDiagnosis;
  }
}

ProcessOptimizer.prototype.tryParseDiagnosisJSON = function (
  text: string,
): ProcessDiagnosis | undefined {
  const extract = (input: string): string | undefined => {
    const trimmed = input.trim();
    if (trimmed.startsWith("{")) return trimmed;
    const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(input);
    if (fenceMatch?.[1]) return fenceMatch[1].trim();
    return undefined;
  };
  const jsonText = extract(text);
  if (!jsonText) return undefined;
  try {
    const objUnknown: unknown = JSON.parse(jsonText);
    if (typeof objUnknown !== "object" || objUnknown === null) return undefined;
    const obj = objUnknown as Record<string, unknown>;
    if (
      Array.isArray(obj.bottlenecks) &&
      Array.isArray(obj.redundancies) &&
      Array.isArray(obj.quickWins) &&
      Array.isArray(obj.priorityActions) &&
      typeof obj.processMetrics === "object" &&
      obj.processMetrics !== null
    ) {
      return obj as unknown as ProcessDiagnosis;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

ProcessOptimizer.prototype.extractActivitiesTimingFromText = function (
  text: string,
) {
  const lines = text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim());
  const results: Array<{
    id?: string;
    name: string;
    role?: string;
    actualDays: number;
    availableDays: number;
  }> = [];

  const toDays = (val: number, unit: string): number => {
    const u = unit.toLowerCase();
    if (u.includes("hour")) return val / 8;
    if (u.includes("month")) return val * 21;
    return val; // assume Working Days
  };

  for (const raw of lines) {
    if (!/(Working\s+Days|Hours|Month|Months)/i.test(raw)) continue;
    // An activities line typically includes two time expressions (actual and available)
    const idMatch = /(CS\.[A-Z]\.\d+\.\d+\.\d+)/i.exec(raw);
    const id = idMatch?.[1];

    const timeRegex = /(\d+(?:\.\d+)?)\s*(Working\s+Days|Hours|Month|Months)/gi;
    const matches = Array.from(raw.matchAll(timeRegex));
    if (matches.length < 1 || !matches[0]) continue;
    const ap = matches[0];
    const av = matches.length > 1 && matches[1] ? matches[1] : ap;
    const actualDays = toDays(
      parseFloat(ap[1] ?? "0"),
      ap[2] ?? "Working Days",
    );
    const availableDays = toDays(
      parseFloat(av[1] ?? "0"),
      av[2] ?? "Working Days",
    );

    // Name heuristic: remove id and times, take remaining leading phrase
    let nameCandidate = raw
      .replace(id ?? "", "")
      .replace(timeRegex, "")
      .trim();
    nameCandidate = nameCandidate
      .replace(
        /\b(Actual|Available|Time|Execute|Timeframe|Performed|By)\b/gi,
        "",
      )
      .trim();
    nameCandidate = nameCandidate.replace(/\s{2,}/g, " ").trim();
    const name = nameCandidate.length > 0 ? nameCandidate : (id ?? "activity");

    // Role: trailing part after the last time
    let role: string | undefined;
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      if (last) {
        const lastIndex =
          typeof last.index === "number" ? last.index + last[0].length : -1;
        if (lastIndex >= 0 && lastIndex < raw.length) {
          role = raw.substring(lastIndex).trim();
          if (role.length === 0) role = undefined;
        }
      }
    }

    results.push({
      id,
      name,
      role,
      actualDays,
      availableDays,
    });
  }

  // Deduplicate by name
  const dedup = new Map<string, (typeof results)[number]>();
  results.forEach((r) => {
    if (!dedup.has(r.name)) dedup.set(r.name, r);
  });
  return Array.from(dedup.values());
};

ProcessOptimizer.prototype.buildDeterministicDiagnosis = function (
  analysis: ProcessAnalysis,
  harvested: Array<{
    id?: string;
    name: string;
    role?: string;
    actualDays: number;
    availableDays: number;
  }>,
): ProcessDiagnosis {
  // Combine parsed steps with harvested activities (prefer parsed when available)
  type StepLike = {
    id: string;
    name: string;
    department?: string;
    role?: string;
    actual: number;
    available: number;
  };
  const steps: StepLike[] = [];
  if (analysis.processSteps.length > 0) {
    analysis.processSteps.forEach((s, idx) => {
      const id = s.id || `step_${idx + 1}`;
      const actual = analysis.leadTimes?.[id] ?? 0;
      const available = actual; // no separate available time in parsed steps
      steps.push({
        id,
        name: s.name,
        department: s.department,
        role: s.role,
        actual,
        available,
      });
    });
  } else {
    harvested.forEach((h, idx) => {
      const id = h.id ?? `step_${idx + 1}`;
      steps.push({
        id,
        name: h.name,
        department: h.role, // best-effort
        role: h.role,
        actual: h.actualDays,
        available: h.availableDays,
      });
    });
  }

  // Bottlenecks by utilization or fan-in dependencies
  const deps = analysis.dependencies ?? {};
  const depCounts = new Map<string, number>();
  Object.values(deps).forEach((arr) => {
    (arr ?? []).forEach((to) => {
      depCounts.set(to, (depCounts.get(to) ?? 0) + 1);
    });
  });

  const bottlenecks: DiagnosisBottleneck[] = steps
    .map((s) => {
      const actual = s.actual;
      const available = s.available > 0 ? s.available : Math.max(1, s.actual);
      const utilization = available > 0 ? (actual / available) * 100 : 0;
      const isFanIn = (depCounts.get(s.id) ?? 0) >= 3;
      if (utilization >= 80 || isFanIn) {
        const impact: "High" | "Medium" | "Low" =
          utilization >= 95 || isFanIn
            ? "High"
            : utilization >= 85
              ? "Medium"
              : "Low";
        return {
          stepId: s.id,
          stepName: s.name,
          reason: isFanIn ? "High dependency fan-in" : "High time utilization",
          impact,
          timingIssue: {
            actualTime: Number(actual.toFixed(2)),
            availableTime: Number(available.toFixed(2)),
            utilizationPercent: Number(utilization.toFixed(1)),
          },
        };
      }
      return undefined;
    })
    .filter((b): b is DiagnosisBottleneck => Boolean(b));

  // Heuristic quick wins: automation for "Enter/Update/Create", parallelization for long steps
  // These are basic pattern-based suggestions - no methodology labels since this is deterministic fallback
  const quickWins: DiagnosisQuickWin[] = [];
  steps.forEach((s) => {
    const lower = s.name.toLowerCase();
    const performedBy = s.role ?? s.department ?? "Unassigned";
    if (/(enter|update|create|submit|manual)/i.test(lower)) {
      const saved = Math.max(1, Math.round(s.actual * 0.3));
      quickWins.push({
        stepId: s.id,
        stepName: s.name,
        suggestion: "Automate data entry and system updates for this step",
        effort: "Low",
        impact: "High",
        estimatedTimeSaving: `${saved} working days`,
        category: "Automation",
        performedBy,
      });
    } else if (s.actual >= 5 && s.available >= s.actual) {
      const saved = Math.max(1, Math.round(s.actual * 0.5));
      quickWins.push({
        stepId: s.id,
        stepName: s.name,
        suggestion:
          "Parallelize with upstream/downstream checks to reduce wait time",
        effort: "Medium",
        impact: "Medium",
        estimatedTimeSaving: `${saved} working days`,
        category: "Parallelization",
        performedBy,
      });
    }
  });

  // Metrics
  const totalDuration = steps.reduce((a, s) => a + (s.actual || 0), 0);
  let departmentHandoffs = 0;
  let approvalLayers = 0;
  if (analysis.nodes && analysis.edges) {
    const idToDept = new Map(
      (analysis.nodes ?? []).map((n) => [n.id, n.department]),
    );
    departmentHandoffs = (analysis.edges ?? []).reduce((count, e) => {
      const from = idToDept.get(e.from);
      const to = idToDept.get(e.to);
      return count + (from && to && from !== to ? 1 : 0);
    }, 0);
    approvalLayers = (analysis.nodes ?? []).filter(
      (n) => n.type === "gateway" || n.name.toLowerCase().includes("approve"),
    ).length;
  }
  const criticalPathSteps = steps
    .slice()
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 5)
    .map((s) => s.name);

  const priorityActions: DiagnosisPriorityAction[] =
    quickWins.length > 0 || bottlenecks.length > 0
      ? [
          {
            action: "Resolve bottleneck steps first",
            rationale:
              "System throughput is limited by its bottleneck; fixing it yields maximum improvement",
            order: 1,
          },
          {
            action: "Automate high-friction data entry and manual steps",
            rationale:
              "Reduces manual effort and human error; enables faster cycle time",
            order: 2,
          },
          {
            action: "Consolidate approval layers and reduce handoffs",
            rationale:
              "Each handoff adds delay and potential for errors; fewer handoffs = faster throughput",
            order: 3,
          },
        ]
      : [
          {
            action: "Validate step timings and dependencies",
            rationale:
              "Accurate baseline measurements are essential before optimization can begin",
            order: 1,
          },
        ];

  const automationClassification = this.computeAutomationClassification(
    analysis,
    {
      bottlenecks,
      quickWins,
      processMetrics: {
        totalDuration: `${Number(totalDuration.toFixed(2))} days`,
        criticalPathSteps,
        departmentHandoffs,
        approvalLayers,
      },
    },
  );

  return {
    bottlenecks,
    redundancies: [],
    quickWins,
    priorityActions,
    processMetrics: {
      totalDuration: `${Number(totalDuration.toFixed(2))} days`,
      criticalPathSteps,
      departmentHandoffs,
      approvalLayers,
    },
    automationClassification,
  };
};

ProcessOptimizer.prototype.computeAutomationClassification = function (
  analysis: ProcessAnalysis,
  diagnosis: Pick<
    ProcessDiagnosis,
    "bottlenecks" | "quickWins" | "processMetrics"
  >,
): ProcessAutomationClassification {
  const steps = analysis.processSteps ?? [];
  const quickWins = diagnosis.quickWins ?? [];
  const names = steps.map((s) => s.name.toLowerCase());

  const aiRegex =
    /(analy[sz]e|assess|review case|investigate|exception|complaint|dispute|interpret|recommend|decision|risk assess|language|email response|reason)/i;
  const rpaRegex =
    /(data entry|enter|update|create record|status update|form|register|upload|copy|paste|reconcile|validate|checklist|notification|generate report|submit)/i;
  const manualRegex =
    /(committee|board|policy|stakeholder|meeting|approval|authorize|governance|negotiation|coordination)/i;

  let aiScore = 25;
  let rpaScore = 25;
  let manualScore = 25;
  const factors: string[] = [];

  const aiStepHits = names.filter((n) => aiRegex.test(n)).length;
  const rpaStepHits = names.filter((n) => rpaRegex.test(n)).length;
  const manualStepHits = names.filter((n) => manualRegex.test(n)).length;

  aiScore += aiStepHits * 8;
  rpaScore += rpaStepHits * 8;
  manualScore += manualStepHits * 6;

  const automationQuickWins = quickWins.filter(
    (q) => q.category === "Automation",
  ).length;
  const simplificationQuickWins = quickWins.filter(
    (q) => q.category === "Simplification" || q.category === "Consolidation",
  ).length;

  rpaScore += automationQuickWins * 6;
  aiScore += quickWins.filter((q) => /exception|decision|risk/i.test(q.suggestion)).length * 6;
  manualScore += simplificationQuickWins * 3;

  const approvals = diagnosis.processMetrics.approvalLayers ?? 0;
  const handoffs = diagnosis.processMetrics.departmentHandoffs ?? 0;
  manualScore += approvals >= 3 ? 10 : 0;
  manualScore += handoffs >= 6 ? 8 : 0;

  const systemHeavy =
    (analysis.nodes ?? []).filter((n) => n.systemUsed).length >=
    Math.max(1, Math.floor((analysis.nodes ?? []).length / 3));
  if (systemHeavy) {
    rpaScore += 10;
    factors.push("High system interaction favors deterministic automation");
  }

  if (aiStepHits > 0) {
    factors.push("Judgment and exception-oriented steps indicate AI agent potential");
  }
  if (rpaStepHits > 0 || automationQuickWins > 0) {
    factors.push("Repetitive rule-based activities are strong RPA candidates");
  }
  if (approvals > 0 || manualStepHits > 0) {
    factors.push("Governance and approvals require manual optimization guardrails");
  }

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  aiScore = clamp(aiScore);
  rpaScore = clamp(rpaScore);
  manualScore = clamp(manualScore);

  const ranked: Array<{ k: AutomationPathway; v: number }> = [
    { k: "AI Agent" as AutomationPathway, v: aiScore },
    { k: "Classical RPA" as AutomationPathway, v: rpaScore },
    { k: "Manual Optimization" as AutomationPathway, v: manualScore },
  ].sort((a, b) => b.v - a.v);

  const confidenceBase = 50 + (ranked[0]?.v ?? 0) * 0.35;
  const gap = (ranked[0]?.v ?? 0) - (ranked[1]?.v ?? 0);
  const confidenceScore = clamp(confidenceBase + gap * 0.7);

  return {
    primaryClassification: ranked[0]?.k ?? "Manual Optimization",
    confidenceScore,
    keyFactors: factors.slice(0, 4),
    hybridFlags: {
      aiAgent: aiScore >= 55,
      classicalRpa: rpaScore >= 55,
      manualOptimization: manualScore >= 55,
    },
    pathwayScores: {
      aiAgent: aiScore,
      classicalRpa: rpaScore,
      manualOptimization: manualScore,
    },
  };
};

ProcessOptimizer.prototype.ensureDiagnosisClassification = function (
  analysis: ProcessAnalysis,
  diagnosis: ProcessDiagnosis,
): ProcessDiagnosis {
  const computed = this.computeAutomationClassification(analysis, diagnosis);
  const existing = diagnosis.automationClassification;

  const normalizePercent = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    // Some model outputs use 0-1 probabilities; convert to percentage scale.
    const scaled = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, Math.round(scaled)));
  };

  if (!existing) {
    return { ...diagnosis, automationClassification: computed };
  }

  return {
    ...diagnosis,
    automationClassification: {
      primaryClassification:
        existing.primaryClassification ?? computed.primaryClassification,
      confidenceScore:
        typeof existing.confidenceScore === "number"
          ? normalizePercent(existing.confidenceScore)
          : computed.confidenceScore,
      keyFactors:
        Array.isArray(existing.keyFactors) && existing.keyFactors.length > 0
          ? existing.keyFactors
          : computed.keyFactors,
      hybridFlags: {
        aiAgent: Boolean(existing.hybridFlags?.aiAgent ?? computed.hybridFlags.aiAgent),
        classicalRpa: Boolean(
          existing.hybridFlags?.classicalRpa ?? computed.hybridFlags.classicalRpa,
        ),
        manualOptimization: Boolean(
          existing.hybridFlags?.manualOptimization ??
            computed.hybridFlags.manualOptimization,
        ),
      },
      pathwayScores: {
        aiAgent:
          typeof existing.pathwayScores?.aiAgent === "number"
            ? normalizePercent(existing.pathwayScores.aiAgent)
            : computed.pathwayScores.aiAgent,
        classicalRpa:
          typeof existing.pathwayScores?.classicalRpa === "number"
            ? normalizePercent(existing.pathwayScores.classicalRpa)
            : computed.pathwayScores.classicalRpa,
        manualOptimization:
          typeof existing.pathwayScores?.manualOptimization === "number"
            ? normalizePercent(existing.pathwayScores.manualOptimization)
            : computed.pathwayScores.manualOptimization,
      },
    },
  };
};
