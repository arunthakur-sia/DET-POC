import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  fontFamily: "Arial, sans-serif",
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
  },
});

interface MermaidDiagramProps {
  chart: string;
  id?: string;
}

export default function MermaidDiagram({ chart, id }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Basic validation
    if (!contentRef.current) {
      return;
    }

    if (!chart || chart.trim() === "") {
      setError("No diagram content provided");
      return;
    }

    // Generate a unique ID for this render with timestamp to avoid collisions
    const timestamp = Date.now();
    const chartHash = chart
      .split("")
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
      .toString(36);
    const safeId = id ? id.replace(/[^a-zA-Z0-9-_]/g, "") : "diagram";
    const uniqueId = `mermaid-${safeId}-${chartHash}-${timestamp}`;

    let isMounted = true;

    // Render function
    const renderDiagram = async () => {
      try {
        setError(null);

        // Render the diagram - mermaid.render creates a temporary element internally
        const { svg } = await mermaid.render(uniqueId, chart);

        // Only update DOM if component is still mounted
        if (!isMounted || !contentRef.current) {
          return;
        }

        // Clear previous content
        contentRef.current.innerHTML = "";

        // Create a wrapper div for the SVG
        const wrapper = document.createElement("div");
        wrapper.innerHTML = svg;

        const svgElement = wrapper.querySelector("svg");
        if (svgElement) {
          // Allow SVG to scale with container but maintain aspect ratio
          svgElement.style.width = "100%";
          svgElement.style.height = "auto";
          svgElement.style.maxWidth = "none"; // Allow scaling up

          // Append to our container
          contentRef.current.appendChild(svgElement);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";

        if (isMounted) {
          setError(errorMessage);
          if (contentRef.current) {
            contentRef.current.innerHTML = `<div class="text-red-500 text-sm p-2">
              <div class="font-semibold mb-1">Error rendering diagram</div>
              <div class="text-xs">${errorMessage}</div>
            </div>`;
          }
        }
      } finally {
        // Cleanup: Remove the temporary element mermaid created (it has the uniqueId as its id)
        if (isMounted) {
          setTimeout(() => {
            const tempElement = document.getElementById(uniqueId);
            if (tempElement && tempElement.parentElement?.id === "d3-mermaid") {
              tempElement.remove();
            }
          }, 100);
        }
      }
    };

    void renderDiagram();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  const handleZoomIn = () => setScale((s) => Math.min(s * 1.2, 5));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.2, 0.2));
  const handleReset = () => setScale(1);

  return (
    <div className="relative overflow-hidden rounded border border-gray-200 bg-white">
      {/* Zoom Controls - only show when diagram is rendered successfully */}
      {!error && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 rounded bg-white/90 p-1 shadow-sm ring-1 ring-gray-200">
          <button
            onClick={handleZoomIn}
            className="flex h-6 w-6 items-center justify-center rounded font-bold text-gray-600 hover:bg-gray-100"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="flex h-6 w-6 items-center justify-center rounded font-bold text-gray-600 hover:bg-gray-100"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={handleReset}
            className="rounded px-2 text-xs text-gray-600 hover:bg-gray-100"
            title="Reset Zoom"
          >
            Reset
          </button>
        </div>
      )}

      {/* Scrollable Container */}
      <div
        ref={containerRef}
        className="overflow-auto p-4"
        style={{ minHeight: "300px", maxHeight: "600px" }}
      >
        {/* Scalable Content */}
        <div
          ref={contentRef}
          style={{
            // Use width percentage to control zoom - this ensures scrollbars work correctly
            // both horizontally and vertically as the SVG scales up
            width: `${scale * 100}%`,
            minWidth: "100%", // Never shrink below container width
            transition: "width 0.2s ease-out",
          }}
        />
      </div>
    </div>
  );
}
