import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import panzoom from "panzoom";

interface MermaidDiagramProps {
  chart: string;
  id?: string;
}

export default function MermaidDiagram({ chart, id }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !chart) return;

    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "Arial, sans-serif",
    });

    // Generate unique ID if not provided
    const diagramId =
      id ?? `mermaid-${Math.random().toString(36).substr(2, 9)}`;

    // Clear previous content
    ref.current.innerHTML = "";

    // Render the diagram
    mermaid
      .render(diagramId, chart)
      .then(({ svg }) => {
        console.log("Mermaid rendered successfully:", diagramId);
        if (ref.current) {
          ref.current.innerHTML = svg;

          // Apply panzoom to the SVG
          const svgElement = ref.current.querySelector("svg");
          if (svgElement) {
            console.log("SVG element found, applying panzoom");
            svgElement.style.maxWidth = "100%";
            svgElement.style.height = "auto";
            svgElement.style.cursor = "grab";
            svgElement.style.width = "100%";
            svgElement.style.overflow = "visible";

            // Initialize panzoom with container bounds
            panzoom(svgElement, {
              maxZoom: 4,
              minZoom: 0.5,
              bounds: true,
              boundsPadding: 0.1,
            });
          } else {
            console.log("No SVG element found in rendered content");
          }
        }
      })
      .catch((error) => {
        console.error("Mermaid rendering error:", error);
        if (ref.current) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          ref.current.innerHTML = `<div class="text-red-500 text-sm p-4 border border-red-200 rounded">
            <p><strong>Diagram Error:</strong></p>
            <pre class="mt-2 text-xs">${errorMessage}</pre>
            <details class="mt-2">
              <summary class="cursor-pointer text-xs">Show raw chart</summary>
              <pre class="mt-1 text-xs bg-gray-100 p-2 rounded">${chart}</pre>
            </details>
          </div>`;
        }
      });
  }, [chart, id]);

  return (
    <div ref={ref} className="mermaid-container max-w-full overflow-hidden" />
  );
}
