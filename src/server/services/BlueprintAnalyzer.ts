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

export interface BlueprintAnalysis {
  keyTouchpoints: string[];
  painPoints: string[];
  stakeholders: string[];
  processFlow: string[];
  analysis: string;
}

export interface ImprovementOption {
  content: string;
  title: string;
  focus:
    | "efficiency-focused"
    | "citizen-experience-focused"
    | "digital-transformation-focused";
}

export interface AnalysisResults {
  currentAnalysis: BlueprintAnalysis;
  currentMermaid: string;
  options: {
    option1: ImprovementOption & { mermaid: string };
    option2: ImprovementOption & { mermaid: string };
    option3: ImprovementOption & { mermaid: string };
  };
  bestOption: string;
}

export class BlueprintAnalyzer {
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

  async analyzeCurrentState(content: string): Promise<BlueprintAnalysis> {
    // Clean and validate content
    const cleanContent = this.cleanContent(content);

    if (!cleanContent || cleanContent.trim().length === 0) {
      throw new Error("No valid content found in the uploaded file");
    }

    const prompt = `
      Analyze this Dubai Government service blueprint and extract:
      1. Key touchpoints and service steps
      2. Current pain points and bottlenecks
      3. Stakeholders involved (citizens, staff, systems)
      4. Process flow and handoffs
      
      Content: ${cleanContent.slice(0, 2000)}
      
      Format your response with clear sections and be specific about Dubai Government context.
      `;

    try {
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });

      const analysis =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      // Parse the analysis to extract structured data
      return this.parseAnalysis(analysis);
    } catch (error) {
      console.error("Error analyzing current state:", error);
      throw new Error(
        `Failed to analyze content: ${error instanceof Error ? error.message : "Unknown error"}`,
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

  private parseAnalysis(analysis: string): BlueprintAnalysis {
    // Simple parsing - in a real implementation, you might want more sophisticated parsing
    const lines = analysis.split("\n");
    const keyTouchpoints: string[] = [];
    const painPoints: string[] = [];
    const stakeholders: string[] = [];
    const processFlow: string[] = [];

    let currentSection = "";
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (
        trimmedLine.toLowerCase().includes("touchpoint") ||
        trimmedLine.toLowerCase().includes("step")
      ) {
        currentSection = "touchpoints";
      } else if (
        trimmedLine.toLowerCase().includes("pain") ||
        trimmedLine.toLowerCase().includes("bottleneck")
      ) {
        currentSection = "painpoints";
      } else if (
        trimmedLine.toLowerCase().includes("stakeholder") ||
        trimmedLine.toLowerCase().includes("citizen") ||
        trimmedLine.toLowerCase().includes("staff")
      ) {
        currentSection = "stakeholders";
      } else if (
        trimmedLine.toLowerCase().includes("flow") ||
        trimmedLine.toLowerCase().includes("process")
      ) {
        currentSection = "processflow";
      } else if (trimmedLine.startsWith("-") || trimmedLine.startsWith("•")) {
        const item = trimmedLine.substring(1).trim();
        switch (currentSection) {
          case "touchpoints":
            keyTouchpoints.push(item);
            break;
          case "painpoints":
            painPoints.push(item);
            break;
          case "stakeholders":
            stakeholders.push(item);
            break;
          case "processflow":
            processFlow.push(item);
            break;
        }
      }
    }

    return {
      keyTouchpoints,
      painPoints,
      stakeholders,
      processFlow,
      analysis,
    };
  }

  async generateImprovementOption(
    currentAnalysis: BlueprintAnalysis,
    focusType:
      | "efficiency-focused"
      | "citizen-experience-focused"
      | "digital-transformation-focused",
  ): Promise<ImprovementOption> {
    const focusPrompts = {
      "efficiency-focused":
        "Focus on process automation, reducing steps, eliminating bottlenecks, and streamlining workflows.",
      "citizen-experience-focused":
        "Focus on improving citizen touchpoints, reducing wait times, enhancing communication, and simplifying interactions.",
      "digital-transformation-focused":
        "Focus on digital-first approaches, AI integration, omnichannel experiences, and paperless processes.",
    };

    const titles = {
      "efficiency-focused": "Efficiency-Focused Blueprint",
      "citizen-experience-focused": "Citizen Experience-Focused Blueprint",
      "digital-transformation-focused":
        "Digital Transformation-Focused Blueprint",
    };

    const cleanAnalysis = this.cleanContent(currentAnalysis.analysis);

    const prompt = `
      Based on this Dubai Government service analysis, generate specific improvements with a ${focusType} approach:
      
      ${cleanAnalysis.slice(0, 1000)}
      
      ${focusPrompts[focusType]}
      
      Also consider:
      - Arabic language support
      - Integration with Dubai Government digital platforms
      - Policy 360 alignment
      
      Provide specific, actionable recommendations.
      `;

    try {
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      });

      const content =
        message.content[0]?.type === "text"
          ? (message.content[0].text ?? "")
          : "";

      return {
        content,
        title: titles[focusType],
        focus: focusType,
      };
    } catch (error) {
      console.error(`Error generating ${focusType} option:`, error);
      throw new Error(
        `Failed to generate ${focusType} option: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createCurrentJourneyDiagram(
    analysis: BlueprintAnalysis,
  ): Promise<string> {
    const prompt = `
      Create a Mermaid journey diagram for this service analysis. Return ONLY the mermaid code without any markdown formatting or explanations.

      ${analysis.analysis.slice(0, 1000)}

      Format exactly like this example:
      journey
          title Current Passport Renewal Journey
          section Application
            Check Requirements: 2: Citizen
            Gather Documents: 2: Citizen
            Visit Office: 1: Citizen
          section Submission
            Queue and Wait: 1: Citizen
            Submit Documents: 2: Staff
            Make Payment: 3: Citizen
          section Processing
            Document Review: 2: Officer
            Security Check: 3: System
          section Collection
            Receive Notification: 3: System
            Collect Passport: 4: Citizen

      Use scores 1-5. Keep section and step names short (under 20 characters).
      Return ONLY the mermaid code, no explanations.
      `;

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const result =
      message.content[0]?.type === "text"
        ? (message.content[0].text ?? "")
        : "";
    return this.cleanMermaidCode(result);
  }

  async createFutureJourneyDiagram(
    improvements: ImprovementOption,
  ): Promise<string> {
    const prompt = `
      Create an improved Mermaid journey diagram. Return ONLY the mermaid code without markdown formatting.

      Improvements: ${improvements.content.slice(0, 1000)}

      Show digital improvements, automation, and better scores (3-5).
      Format exactly like:
      journey
          title Improved Passport Renewal Journey
          section Digital Application
            Online Form: 4: Citizen
            Auto Document Check: 4: System
          section Smart Processing
            AI Verification: 5: System
            Real-time Updates: 4: System
          section Delivery
            SMS Notification: 5: System
            Home Delivery: 5: Courier

      Keep names short and scores high to show improvement.
      Return ONLY the mermaid code, no explanations.
      `;

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 400,
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

  async evaluateBestOption(
    option1: ImprovementOption,
    option2: ImprovementOption,
    option3: ImprovementOption,
  ): Promise<string> {
    const prompt = `
      Evaluate these three service improvement options and determine which is best for Dubai Government:
      
      Option 1 (Efficiency): ${option1.content.slice(0, 500)}
      Option 2 (Citizen Experience): ${option2.content.slice(0, 500)}
      Option 3 (Digital Transformation): ${option3.content.slice(0, 500)}
      
      Consider: impact, feasibility, alignment with Policy 360, and ROI.
      Return only the number (1, 2, or 3) of the best option.
      `;

    const message = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 50,
      messages: [{ role: "user", content: prompt }],
    });

    const result =
      message.content[0]?.type === "text"
        ? (message.content[0].text ?? "")
        : "";
    return result.trim();
  }

  async generateAllOptions(
    currentAnalysis: BlueprintAnalysis,
  ): Promise<AnalysisResults> {
    // Generate 3 different improvement options
    const [option1, option2, option3] = await Promise.all([
      this.generateImprovementOption(currentAnalysis, "efficiency-focused"),
      this.generateImprovementOption(
        currentAnalysis,
        "citizen-experience-focused",
      ),
      this.generateImprovementOption(
        currentAnalysis,
        "digital-transformation-focused",
      ),
    ]);

    // Generate mermaid diagrams for each
    const [currentMermaid, option1Mermaid, option2Mermaid, option3Mermaid] =
      await Promise.all([
        this.createCurrentJourneyDiagram(currentAnalysis),
        this.createFutureJourneyDiagram(option1),
        this.createFutureJourneyDiagram(option2),
        this.createFutureJourneyDiagram(option3),
      ]);

    // Determine best option
    const bestOption = await this.evaluateBestOption(option1, option2, option3);

    return {
      currentAnalysis,
      currentMermaid,
      options: {
        option1: { ...option1, mermaid: option1Mermaid },
        option2: { ...option2, mermaid: option2Mermaid },
        option3: { ...option3, mermaid: option3Mermaid },
      },
      bestOption,
    };
  }
}
