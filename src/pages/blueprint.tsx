import Head from "next/head";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import ReactMarkdown from "react-markdown";
import { api } from "@/utils/api";
import MermaidDiagram from "@/components/MermaidDiagram";
import type { AnalysisResults } from "@/server/services/BlueprintAnalyzer";

export default function ServiceBlueprint() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string>("");

  const extractTextMutation = api.blueprint.extractText.useMutation();
  const analyzeBlueprintMutation = api.blueprint.analyzeBlueprint.useMutation();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        setError(
          `File size too large. Please upload a file smaller than 10MB. Current file size: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        );
        return;
      }

      setUploadedFile(file);
      setError("");

      const processFile = async () => {
        try {
          const fileContent = await file.text();
          const result = await extractTextMutation.mutateAsync({
            fileContent,
            fileName: file.name,
            fileType: file.type,
          });

          if (result.success) {
            setExtractedText(result.text ?? "");
          } else {
            setError(result.error ?? "Failed to extract text");
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to process file",
          );
        }
      };

      void processFile();
    },
    [extractTextMutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    multiple: false,
  });

  const handleGenerateBlueprints = async () => {
    if (!extractedText) return;

    setIsGenerating(true);
    setError("");

    try {
      const result = await analyzeBlueprintMutation.mutateAsync({
        content: extractedText,
      });

      if (result.success) {
        setResults(result.results ?? null);
      } else {
        setError(result.error ?? "Failed to analyze blueprint");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to analyze blueprint",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const renderSidebar = () => (
    <div className="w-56 bg-gray-100 p-5">
      {/* Logo */}
      <div className="mb-8">
        <img src="/assets/sia.png" alt="SIA Logo" className="h-8 w-auto" />
      </div>

      {/* Favorites */}
      <div className="mb-2 flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-gray-200">
        <div className="flex items-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="mr-2"
          >
            <path
              d="M7.68335 1.53C7.71257 1.47097 7.7577 1.42129 7.81365 1.38655C7.86961 1.35181 7.93416 1.3334 8.00002 1.3334C8.06588 1.3334 8.13043 1.35181 8.18639 1.38655C8.24234 1.42129 8.28747 1.47097 8.31669 1.53L9.85669 4.64933C9.95814 4.85465 10.1079 5.03223 10.2931 5.16697C10.4783 5.30167 10.6934 5.38941 10.92 5.42267L14.364 5.92667C14.4293 5.93612 14.4906 5.96365 14.541 6.00613C14.5914 6.04862 14.629 6.10437 14.6494 6.16707C14.6698 6.22978 14.6722 6.29694 14.6564 6.36096C14.6406 6.42498 14.6072 6.48333 14.56 6.52933L12.0694 8.95467C11.9051 9.11473 11.7822 9.31232 11.7112 9.53042C11.6403 9.74852 11.6234 9.98059 11.662 10.2067L12.25 13.6333C12.2615 13.6986 12.2545 13.7657 12.2297 13.8271C12.2049 13.8885 12.1633 13.9417 12.1097 13.9807C12.0561 14.0196 11.9927 14.0427 11.9266 14.0473C11.8605 14.0519 11.7945 14.0378 11.736 14.0067L8.65735 12.388C8.4545 12.2815 8.22881 12.2258 7.99997 12.2258C7.77113 12.2258 7.54544 12.2815 7.34259 12.388L4.26402 14.0067C4.20557 14.0376 4.13962 14.0515 4.07365 14.0468C4.00769 14.0421 3.94437 14.019 3.89088 13.9801C3.8374 13.9413 3.79591 13.8881 3.77112 13.8268C3.74634 13.7655 3.73926 13.6985 3.75069 13.6333L4.33802 10.2073C4.37682 9.98116 4.36001 9.74893 4.28905 9.5307C4.21808 9.31246 4.09509 9.11477 3.93069 8.95467L1.44002 6.53C1.39242 6.48402 1.35868 6.4256 1.34266 6.36138C1.32664 6.29717 1.32898 6.22975 1.34941 6.16679C1.36983 6.10384 1.40753 6.04789 1.4582 6.00532C1.50888 5.96275 1.57049 5.93527 1.63602 5.926L5.07935 5.42267C5.30619 5.38967 5.52161 5.30204 5.70708 5.16733C5.89254 5.03261 6.04249 4.85485 6.14402 4.64933L7.68335 1.53Z"
              stroke="#020817"
              strokeWidth="1.33333"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm text-gray-700">Favorites</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 12L10 8L6 4"
            stroke="#020817"
            strokeWidth="1.33333"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );

  const renderUploadSection = () => (
    <div className="border-r border-gray-200 p-5">
      <h2 className="mb-4 text-lg font-bold text-gray-800">
        AI-Powered Service Blueprint Enhancement
      </h2>

      <div className="mb-6">
        <h3 className="text-md mb-3 font-semibold text-gray-800">
          Upload Current Service Blueprint
        </h3>

        <div
          {...getRootProps()}
          className={`file-upload-area cursor-pointer rounded-lg border-2 border-dashed border-cyan-500 p-8 text-center ${
            isDragActive ? "bg-cyan-50" : "bg-cyan-25"
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-gray-600">
            {isDragActive ? (
              <p>Drop the file here...</p>
            ) : (
              <div>
                <p className="mb-2">Add collections or drag and drop files</p>
                <p className="text-sm text-gray-500">
                  PDF or TXT files only (max 10MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {uploadedFile && (
          <div className="mt-4 rounded border bg-gray-50 p-3">
            <p className="text-sm text-gray-700">
              <strong>File:</strong> {uploadedFile.name}
            </p>
            <p className="text-sm text-gray-500">
              <strong>Size:</strong> {(uploadedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}

        {extractedText && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-800">
              Extracted Content Preview
            </h4>
            <div className="content-preview max-h-40 overflow-y-auto rounded border bg-gray-50 p-3">
              <pre className="text-xs whitespace-pre-wrap text-gray-700">
                {extractedText.slice(0, 1000)}
                {extractedText.length > 1000 && "..."}
              </pre>
            </div>
          </div>
        )}

        {extractedText && (
          <button
            onClick={handleGenerateBlueprints}
            disabled={isGenerating}
            className="btn-primary mt-4 w-full rounded bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isGenerating ? "Generating..." : "Generate 3 Blueprints"}
          </button>
        )}
      </div>
    </div>
  );

  const renderResults = () => {
    if (isGenerating) {
      return (
        <div className="p-8 text-center">
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-500"></div>
          <p className="text-gray-600">
            AI is analyzing your service blueprint and generating 3 optimized
            options...
          </p>
        </div>
      );
    }

    if (!results) {
      return (
        <div className="p-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Output</h3>
          <div className="rounded border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-cyan-800">
              Upload a service blueprint file to generate improved options
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-5">
        <h3 className="mb-6 text-lg font-semibold text-gray-800">
          Generated Blueprint Options
        </h3>

        {/* Current State Analysis */}
        <div className="mb-8">
          <h4 className="text-md mb-3 font-semibold text-gray-800">
            Current State Analysis
          </h4>
          <div className="mb-4 rounded border bg-white p-4">
            <MermaidDiagram chart={results.currentMermaid} id="current-state" />
          </div>
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-cyan-600 hover:text-cyan-800">
              Current State Details
            </summary>
            <div className="mt-2 rounded border bg-gray-50 p-3">
              <div className="text-sm text-gray-700 prose prose-sm max-w-none">
                <ReactMarkdown>
                  {results.currentAnalysis.analysis}
                </ReactMarkdown>
              </div>
            </div>
          </details>
        </div>

        {/* Blueprint Options */}
        <div className="mb-8">
          <h4 className="text-md mb-4 font-semibold text-gray-800">
            AI-Generated Options
          </h4>

          {Object.entries(results.options).map(([key, option], index) => {
            const isBest = (index + 1).toString() === results.bestOption;
            return (
              <div key={key} className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <h5 className="font-semibold text-gray-800">
                    Option {index + 1}: {option.title}
                  </h5>
                  {isBest && (
                    <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                      RECOMMENDED
                    </span>
                  )}
                </div>

                <div className="mb-3 rounded border bg-white p-4">
                  <MermaidDiagram
                    chart={option.mermaid}
                    id={`option-${index + 1}`}
                  />
                </div>

                <details className={isBest ? "open" : ""}>
                  <summary className="cursor-pointer text-sm text-cyan-600 hover:text-cyan-800">
                    Option {index + 1} Details
                  </summary>
                  <div className="mt-2 rounded border bg-gray-50 p-3">
                    <p className="text-sm text-gray-700">{option.content}</p>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Service Blueprint Analysis</title>
        <meta
          name="description"
          content="AI-Powered Service Blueprint Enhancement"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen bg-gray-50">
        {renderSidebar()}

        <div className="flex flex-1">
          <div className="w-80">{renderUploadSection()}</div>
          <div className="flex-1">{renderResults()}</div>
        </div>
      </div>

      {/* Back Button */}
      <div className="fixed bottom-4 left-4">
        <button
          onClick={() => window.history.back()}
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
        >
          ← Back to Home
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message fixed top-4 right-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </>
  );
}
