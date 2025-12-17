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

export interface ProcessDiagnosis {
  bottlenecks: DiagnosisBottleneck[];
  redundancies: DiagnosisRedundancy[];
  quickWins: DiagnosisQuickWin[];
  priorityActions: DiagnosisPriorityAction[];
  processMetrics: DiagnosisProcessMetrics;
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
  "sipoc": { "suppliers": [], "inputs": [], "process": "", "outputs": [], "customers": [] },
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
  "sipoc": { "suppliers": [], "inputs": [], "process": "", "outputs": [], "customers": [] },
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
            const id = a.id ?? a.name.replace(/\s+/g, "_").toLowerCase();
            const performedBy = a.role ?? "Participant";
            return `- ${id} | ${a.name} | performedBy:${performedBy} | actual:${a.actualDays} | available:${a.availableDays}`;
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
You are a process optimization expert analyzing an organizational workflow for RTA (Roads and Transport Authority). Given the following process data:

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

Your task is to analyze this process and return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
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
      "performedBy": "Role/department responsible for this step (from swimlane or activities table)"
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
  "kpiAnalysis": {
    "currentTargetsRealistic": true|false,
    "suggestedAdjustments": ["If we automate X, target should increase from Y to Z"]
  },
  "controlsAnalysis": {
    "unnecessaryOverhead": ["Controls that add overhead without value"],
    "automationCandidates": ["Manual checks that could be automated"]
  }
}

Analysis criteria:
- Bottlenecks: Steps where actual time approaches or exceeds available time (>80% utilization), or steps with 3+ dependencies
- Redundancies: Steps with similar names/activities or sequential approvals by same department
- Quick wins: Focus on steps that can be automated, removed, or parallelized with minimal effort
- For each quick win, ALWAYS include:
  - performedBy: Extract from the step's swimlane or "Performed By" column in activities table
- Analyze whether current KPI targets are realistic given process bottlenecks
- Identify controls that add unnecessary overhead or could be automated
- Prioritize by impact/effort ratio
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
        return parsed;
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
      }

      return undefined;
    };

    const jsonText = extract(text);
    if (!jsonText) {
      console.log("[tryParseStructuredJSON] No JSON found in text");
      console.log(
        `[tryParseStructuredJSON] Text preview: ${text.slice(0, 200)}`,
      );
      return undefined;
    }

    try {
      const parsedUnknown: unknown = JSON.parse(jsonText);
      // Minimal validation with type narrowing
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
    } catch (e) {
      console.log(
        "[tryParseStructuredJSON] JSON parse error:",
        e instanceof Error ? e.message : "unknown",
      );
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
            suppliers: structured.sipoc.suppliers ?? [],
            inputs: structured.sipoc.inputs ?? [],
            process: structured.sipoc.process ?? "",
            outputs: structured.sipoc.outputs ?? [],
            customers: structured.sipoc.customers ?? [],
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

Optimization Instructions:
${cleanCriteria}

CRITICAL INSTRUCTIONS:
1. Apply ONLY the changes specified in the optimization instructions above
2. If removing step X: remove its node, remove all edges to/from it, reconnect predecessor to successor
3. If merging steps A+B: remove B's node, update A's node name, reconnect B's edges to A  
4. If parallelizing: adjust edge connections to enable parallel execution
5. Preserve all unchanged steps/nodes/edges exactly as they are

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
      return this.buildMermaidFromStructured(analysis);
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
      return this.buildMermaidFromStructured(optimization.optimizedProcess);
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

    // Build SIPOC context
    const sipocContext = documentMetadata?.sipoc
      ? `\nCurrent SIPOC:\n- Suppliers: ${documentMetadata.sipoc.suppliers?.join(", ") || "N/A"}\n- Inputs: ${documentMetadata.sipoc.inputs?.join(", ") || "N/A"}\n- Outputs: ${documentMetadata.sipoc.outputs?.join(", ") || "N/A"}\n- Customers: ${documentMetadata.sipoc.customers?.join(", ") || "N/A"}`
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

Original Process Information (extract what you can from the following text; if absent, leave placeholders):
${originalContent.slice(0, 2000)}

Provided metadata overrides (use when present):
- Process ID: ${processId ?? documentMetadata?.processId ?? ""}
- Process Name: ${processName}
- Process Owner: ${processOwner ?? documentMetadata?.processOwner ?? ""}
- Department: ${department ?? documentMetadata?.department ?? ""}
- Section: ${section ?? documentMetadata?.section ?? ""}
${kpisContext}
${sipocContext}
${controlsContext}
${relatedDocsContext}

Optimization Summary:
${changesList}

Optimized Process Mermaid:
${optimizedMermaid}

Impact Analysis (free-form JSON-like info to summarize in KPIs/Description):
${impactAnalysis ? JSON.stringify(impactAnalysis).slice(0, 1000) : ""}

Your task: Generate a complete SOP document in markdown format (MVP) with this structure:

# ${processId ?? documentMetadata?.processId ?? "PROCESS-ID"} - ${processName}

## Issue Details
- Issue Number: [Increment]
- Issue Date: ${today}
- Change Type: Process Optimization Update

## Process Information
- Process Name: ${processName}
- Process ID: ${processId ?? documentMetadata?.processId ?? "PROCESS-ID"}
- Process Owner: ${processOwner ?? documentMetadata?.processOwner ?? "[Owner]"}
- Section: ${section ?? documentMetadata?.section ?? "[Section]"}
- Department: ${department ?? documentMetadata?.department ?? "[Department]"}

## Description
Provide a concise description of the optimized process, highlighting improvements and rationale.
${documentMetadata?.description ? `\nOriginal Description: ${documentMetadata.description}` : ""}

## Purpose
State the updated purpose of the process aligned with optimization goals.
${documentMetadata?.purpose ? `\nOriginal Purpose: ${documentMetadata.purpose}` : ""}

## Scope
Define the scope (use original if inferable, otherwise write a reasonable placeholder).
${documentMetadata?.scope ? `\nOriginal Scope: ${documentMetadata.scope}` : ""}

## SIPOC
Recreate a simple SIPOC-style table (as markdown) based on available process information.

## Related Strategic Goals
- Enhance operational efficiency
- [Add more if inferable]

## Process KPIs (Updated)
Update KPIs based on improvements. For each KPI:
- Show current target and proposed new target with justification
- Example: "If we automate step X, target should increase from 70% to 85%"
${kpisContext}

## Process Model (Optimized Flow)
\`\`\`mermaid
${optimizedMermaid}
\`\`\`

## Activities and Responsibilities
Provide an activities table (Step ID, Activity Name, Performed By, Department, Description, Expected Duration).

### Optimization Change Log
| Original Step | Change Applied | Performed By | Impact |
|--------------|----------------|--------------|--------|
Fill the table with the applied changes above where possible.

## Internal Controls (Updated)
List key controls; update if steps changed; otherwise provide baseline controls.
Flag any controls that were streamlined or automated as part of the optimization.
${controlsContext}

## Related Documents and Standards
${relatedDocsContext || "- List applicable standards and policies"}

## Document Revision History
Add an entry summarizing this optimization update, including:
- Date of change
- Summary of optimizations applied
- Expected impact on KPIs

Return ONLY the markdown for the SOP (no extra prose).
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
      const label =
        safe.length > 0
          ? safe
          : n.type === "start"
            ? "Start"
            : n.type === "end"
              ? "End"
              : n.type === "gateway"
                ? "Decision"
                : "";

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
      lines.push(`    ${from} -- ${escapeMermaidLabel(e.label)} --> ${to}`);
    } else {
      lines.push(`    ${from} --> ${to}`);
    }
  });

  return lines.join("\n");
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
            action: "Automate high-friction data entry/update steps",
            rationale:
              "Reduces manual effort and cycle time on frequently executed tasks",
            order: 1,
          },
          {
            action: "Resolve high-utilization or fan-in bottlenecks",
            rationale:
              "Bottleneck removal yields outsized throughput improvement",
            order: 2,
          },
          {
            action: "Consider parallelization on long-duration steps",
            rationale:
              "Overlap work where dependencies allow to cut elapsed time",
            order: 3,
          },
        ]
      : [
          {
            action: "Validate step timings and dependencies",
            rationale: "Ensure accurate measurements to enable optimization",
            order: 1,
          },
        ];

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
  };
};
