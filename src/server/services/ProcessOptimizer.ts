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
    constructor() {
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

export interface ProcessOwner {
  department: string;
  role: string;
  responsibilities: string[];
}

export interface ProcessAnalysis {
  processName: string;
  departments: string[];
  processOwners: ProcessOwner[];
  processSteps: ProcessStep[];
  dependencies: Record<string, string[]>;
  leadTimes: Record<string, number>;
  analysis: string;
}

export interface ProcessOptimization {
  originalProcess: ProcessAnalysis;
  optimizationCriteria: string;
  optimizedProcess: ProcessAnalysis;
  changes: ProcessChange[];
  impactAnalysis: string;
}

export interface ProcessChange {
  type: "removed" | "added" | "modified" | "dependency_changed";
  stepId: string;
  description: string;
  impact: "high" | "medium" | "low";
  affectedSteps: string[];
}

export interface OptimizationResults {
  currentAnalysis: ProcessAnalysis;
  currentMermaid: string;
  optimization: ProcessOptimization;
  optimizedMermaid: string;
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

  private async extractTextFromPDF(file: File): Promise<string> {
    try {
      // Dynamically import PDF.js only when needed
      const pdfjsLib = await import("pdfjs-dist");

      // Configure PDF.js for server-side usage (older version compatible with Node.js 21)
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
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
        text += pageText + "\n";
      }

      if (!text || text.trim().length === 0) {
        throw new Error(
          "The uploaded PDF file appears to be empty or contains no readable text",
        );
      }

      return text;
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
    try {
      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Content);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }

      // Dynamically import PDF.js only when needed
      const pdfjsLib = await import("pdfjs-dist");

      // Configure PDF.js for server-side usage (older version compatible with Node.js 21)
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
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
        text += pageText + "\n";
      }

      if (!text || text.trim().length === 0) {
        throw new Error(
          "The uploaded PDF file appears to be empty or contains no readable text",
        );
      }

      return text;
    } catch (error) {
      throw new Error(
        `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
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

  async analyzeProcess(content: string): Promise<ProcessAnalysis> {
    // Clean and validate content
    const cleanContent = this.cleanContent(content);

    if (!cleanContent || cleanContent.trim().length === 0) {
      throw new Error("No valid content found in the uploaded file");
    }

    const prompt = `
      Analyze this business process document and extract detailed information about the process flow, departments, roles, and dependencies.
      
      Content: ${cleanContent.slice(0, 3000)}
      
      Please extract and structure the following information:
      1. Process Name
      2. Departments involved (swim lanes)
      3. Process Owners (department + role combinations)
      4. Process Steps (sequential tasks with owners)
      5. Dependencies between steps
      6. Lead times for each step (if mentioned)
      7. System usage indicators
      
      Format your response as a structured analysis that can be parsed programmatically.
      Focus on identifying swim lanes, sequential processes, and dependencies.
      `;

    try {
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });

      const analysis =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      // Parse the analysis to extract structured data
      return this.parseProcessAnalysis(analysis, cleanContent);
    } catch (error) {
      console.error("Error analyzing process:", error);
      throw new Error(
        `Failed to analyze process: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
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

  async optimizeProcess(
    currentAnalysis: ProcessAnalysis,
    optimizationCriteria: string,
  ): Promise<ProcessOptimization> {
    const cleanCriteria = this.cleanContent(optimizationCriteria);
    const cleanAnalysis = this.cleanContent(currentAnalysis.analysis);

    const prompt = `
      Based on this business process analysis and the optimization criteria, make ONLY the specific changes requested.
      Be precise and conservative - only modify what is explicitly mentioned in the criteria.
      
      Current Process Analysis:
      ${cleanAnalysis.slice(0, 1500)}
      
      Process Steps:
      ${currentAnalysis.processSteps
        .map((step) => `- ${step.department} - ${step.role}: ${step.name}`)
        .join("\n")}
      
      Optimization Criteria:
      ${cleanCriteria}
      
      IMPORTANT INSTRUCTIONS:
      1. Make ONLY the specific changes mentioned in the criteria
      2. If criteria says "remove X", only remove X and adjust dependencies
      3. If criteria says "add dependency Y to Z", only add that specific dependency
      4. Do NOT make additional changes beyond what is explicitly requested
      5. Preserve all other process steps exactly as they are
      6. Only modify the minimum necessary to implement the requested change
      
      Please provide:
      1. An updated process flow with ONLY the requested changes
      2. Specific changes made (be precise about what was modified)
      3. Impact analysis of ONLY the changes made
      4. Updated dependencies for ONLY the affected steps
      
      Focus on precision and minimal changes.
      `;

    try {
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const optimizationText =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      return this.parseOptimization(
        optimizationText,
        currentAnalysis,
        optimizationCriteria,
      );
    } catch (error) {
      console.error("Error optimizing process:", error);
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
    // Parse the optimization response to extract changes
    const changes: ProcessChange[] = [];
    const lines = optimizationText.split("\n");

    let currentSection = "";
    const optimizedSteps: ProcessStep[] = [...currentAnalysis.processSteps];
    let impactAnalysis = "";

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (
        trimmedLine.toLowerCase().includes("change") ||
        trimmedLine.toLowerCase().includes("modification")
      ) {
        currentSection = "changes";
      } else if (
        trimmedLine.toLowerCase().includes("impact") ||
        trimmedLine.toLowerCase().includes("effect")
      ) {
        currentSection = "impact";
      }

      if (
        currentSection === "changes" &&
        (trimmedLine.startsWith("-") || trimmedLine.startsWith("•"))
      ) {
        const changeText = trimmedLine.substring(1).trim();

        // Determine change type based on keywords
        let type: ProcessChange["type"] = "modified";
        if (
          changeText.toLowerCase().includes("remove") ||
          changeText.toLowerCase().includes("eliminate")
        ) {
          type = "removed";
        } else if (
          changeText.toLowerCase().includes("add") ||
          changeText.toLowerCase().includes("introduce")
        ) {
          type = "added";
        } else if (
          changeText.toLowerCase().includes("dependency") ||
          changeText.toLowerCase().includes("depends")
        ) {
          type = "dependency_changed";
        }

        changes.push({
          type,
          stepId: `change_${changes.length + 1}`,
          description: changeText,
          impact:
            changeText.toLowerCase().includes("critical") ||
            changeText.toLowerCase().includes("major")
              ? "high"
              : changeText.toLowerCase().includes("minor") ||
                  changeText.toLowerCase().includes("small")
                ? "low"
                : "medium",
          affectedSteps: [],
        });
      }

      if (currentSection === "impact") {
        impactAnalysis += trimmedLine + "\n";
      }
    }

    // Create optimized process analysis (simplified version)
    const optimizedAnalysis: ProcessAnalysis = {
      ...currentAnalysis,
      processSteps: optimizedSteps,
      analysis: optimizationText,
    };

    return {
      originalProcess: currentAnalysis,
      optimizationCriteria: criteria,
      optimizedProcess: optimizedAnalysis,
      changes,
      impactAnalysis: impactAnalysis.trim(),
    };
  }

  async createCurrentProcessDiagram(
    analysis: ProcessAnalysis,
  ): Promise<string> {
    const prompt = `
      Create a Mermaid flowchart diagram for this business process with horizontal swim lanes (departments) and process steps.
      Return ONLY the mermaid code without any markdown formatting or explanations.

      Process: ${analysis.processName}
      Departments: ${analysis.departments.join(", ")}
      
      Process Steps:
      ${analysis.processSteps
        .map((step) => `- ${step.department} - ${step.role}: ${step.name}`)
        .join("\n")}

      Format exactly like this example with horizontal swim lanes (LR direction):
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
      - Each department should be a separate subgraph
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
    const prompt = `
      Create an optimized Mermaid flowchart diagram showing ONLY the specific changes made to the process.
      Use horizontal swim lanes (LR direction) and highlight ONLY the changed elements in yellow.
      Return ONLY the mermaid code without markdown formatting.

      Original Process: ${optimization.originalProcess.processName}
      Optimization Criteria: ${optimization.optimizationCriteria}
      
      SPECIFIC Changes Made (be precise):
      ${optimization.changes
        .map((change) => `- ${change.type}: ${change.description}`)
        .join("\n")}

      Process Steps (Updated):
      ${optimization.optimizedProcess.processSteps
        .map((step) => `- ${step.department} - ${step.role}: ${step.name}`)
        .join("\n")}

      Format with horizontal swim lanes and highlight ONLY changed elements in yellow:
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
          
          classDef changed fill:#ffff00,stroke:#333,stroke-width:2px
          class A2,B1 changed

      IMPORTANT REQUIREMENTS:
      - Use flowchart LR (left to right direction)
      - Use subgraphs for each department as swim lanes
      - Highlight ONLY the specific steps that were changed
      - Keep step names short (under 30 characters)
      - Show sequential flow with arrows between steps
      - Be precise - only highlight what was actually modified
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
}
