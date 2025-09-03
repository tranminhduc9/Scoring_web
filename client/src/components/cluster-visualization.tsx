import React, { useEffect, useRef, useState } from 'react';
import { ClusterResult } from '../../../shared/schema';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Download, FileImage, Maximize, Move, ZoomIn, Square } from "lucide-react";

interface ClusterVisualizationProps {
  clusterResult: ClusterResult;
  width?: number;
  height?: number;
}

interface DataPoint {
  x: number;
  y: number;
  cluster: number;
  size: number;
  index: number;
  companyInfo?: {
    name: string;
    taxcode: string;
    sector_name: string;
    sector_unique_id: string | number;
    empl_qtty: number;
    yearreport: number;
    s_DT_TTM: number;
    s_EMPL: number;
    s_TTS: number;
    s_VCSH: number;
    [key: string]: any; // For STD_RTD fields
  };
}

export default function ClusterVisualization({ 
  clusterResult, 
  width = 800, 
  // increase default height so page lengthens and becomes scrollable
  height = 1000 
}: ClusterVisualizationProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [plotReady, setPlotReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<"orbit" | "zoom" | "pan" | "select">("orbit");
  const [selectedArea, setSelectedArea] = useState<{xmin: number, xmax: number, ymin: number, ymax: number} | null>(null);

  // Add timestamp to verify code reload
  console.log("🚀 ClusterVisualization component loaded at:", new Date().toLocaleTimeString());

  useEffect(() => {
    if (!clusterResult) {
      console.log("⚠️ No cluster result");
      return;
    }

    // Process data based on format
    let processedData: DataPoint[] = [];

    if (clusterResult.companies && Array.isArray(clusterResult.companies)) {
      // Process new companies format
      let pointIndex = 0;
      clusterResult.companies.forEach((company: any) => {
        if (company.enterprise && Array.isArray(company.enterprise)) {
          company.enterprise.forEach((enterprise: any) => {
            const embX = enterprise.emb_x || 0;
            const embY = enterprise.emb_y || 0;
            const clusterLabel = enterprise.cluster || enterprise.Label || 0;
            const employeeSize = enterprise.empl_qtty ? Math.log10(enterprise.empl_qtty + 1) * 0.5 : 0.1;

            processedData.push({
              x: embX,
              y: embY,
              cluster: clusterLabel,
              size: Math.max(0.1, employeeSize),
              index: pointIndex,
              companyInfo: {
                name: enterprise.name || 'Unknown Company',
                taxcode: enterprise.taxcode || '',
                sector_name: enterprise.sector_name || '',
                sector_unique_id: enterprise.sector_unique_id || company.sector_unique_id || '',
                empl_qtty: enterprise.empl_qtty || 0,
                yearreport: enterprise.yearreport || 2024,
                s_DT_TTM: enterprise.s_DT_TTM || 0,
                s_EMPL: enterprise.s_EMPL || 0,
                s_TTS: enterprise.s_TTS || 0,
                s_VCSH: enterprise.s_VCSH || 0
              }
            });
            pointIndex++;
          });
        }
      });

      setData(processedData);
      console.log("✅ Processed cluster data:", processedData.length, "points");
      return;
    }

    // Legacy format fallback
    if (!clusterResult.embedding || !clusterResult.labels) {
      console.log("⚠️ Missing required fields in cluster result");
      return;
    }

    const transformedData = clusterResult.embedding.map((coords: number[], i: number) => ({
      x: coords[0],
      y: coords[1],
      cluster: clusterResult.labels![i] || 0,
      size: clusterResult.size ? clusterResult.size[i] || 0.1 : 0.1,
      index: i
    }));

    setData(transformedData);
    console.log("✅ Loaded cluster visualization data:", transformedData.length, "points");
  }, [clusterResult]);


  useEffect(() => {
    if (!data.length || !plotRef.current) {
      console.log("⚠️ No data or plotRef:", { dataLength: data.length, plotRef: !!plotRef.current });
      return;
    }

    // Check if plot already exists to avoid recreation
    if (plotReady && plotRef.current && (plotRef.current as any).data) {
      console.log("🎨 Plot already exists, skipping recreation");
      return;
    }

    console.log("🎨 Creating visualization with", data.length, "data points");

    // Get unique clusters and define colors
    const clusters = Array.from(new Set(data.map(d => d.cluster))).sort();
    console.log("🎯 Found clusters:", clusters);

    const colors = [
      '#1976D2', '#4CAF50', '#F44336', '#FF9800', '#9C27B0', '#FF5722',
      '#607D8B', '#795548', '#E91E63', '#00BCD4', '#8BC34A', '#FFC107'
    ];

    // Create only 3D mesh columns - no scatter points
    const traces: any[] = [];

    clusters.forEach((clusterId, clusterIndex) => {
      const clusterPoints = data.filter(d => d.cluster === clusterId);
      const clusterColor = colors[clusterIndex % colors.length];

      clusterPoints.forEach((point, pointIndex) => {
        const columnWidth = 0.01; // 1px equivalent for compact visualization
        const x = point.x;
        const y = point.y;
        const height = Math.max(0.1, point.size * 2);

        // Create detailed hover text with all company information
        let hoverText = `<b>${point.companyInfo?.name || 'N/A'}</b><br>`;
        hoverText += `Tọa độ: (${x.toFixed(3)}, ${y.toFixed(3)})<br>`;
        hoverText += `Kích thước quy mô: ${point.size.toFixed(2)}<br>`;
        hoverText += `Mã số thuế: ${point.companyInfo?.taxcode || 'N/A'}<br>`;
        hoverText += `Tên ngành: ${point.companyInfo?.sector_name || 'N/A'}<br>`;
        hoverText += `Sector ID: ${point.companyInfo?.sector_unique_id || 'N/A'}<br>`;
        hoverText += `Số nhân viên: ${(point.companyInfo?.empl_qtty || 0).toLocaleString()}`;

        // Create solid 3D rectangular column using mesh3d
        const w = columnWidth / 2;

        // 8 vertices of rectangular column
        const vertices = [
          [x-w, y-w, 0],      // 0: bottom-left-back
          [x+w, y-w, 0],      // 1: bottom-right-back  
          [x+w, y+w, 0],      // 2: bottom-right-front
          [x-w, y+w, 0],      // 3: bottom-left-front
          [x-w, y-w, height], // 4: top-left-back
          [x+w, y-w, height], // 5: top-right-back
          [x+w, y+w, height], // 6: top-right-front
          [x-w, y+w, height]  // 7: top-left-front
        ];

        // 12 triangular faces (6 faces × 2 triangles each)
        const faces = [
          [0,1,2], [0,2,3], // Bottom face
          [4,6,5], [4,7,6], // Top face  
          [3,2,6], [3,6,7], // Front face
          [0,4,5], [0,5,1], // Back face
          [0,3,7], [0,7,4], // Left face
          [1,5,6], [1,6,2]  // Right face
        ];

        traces.push({
          type: 'mesh3d',
          x: vertices.map(v => v[0]),
          y: vertices.map(v => v[1]), 
          z: vertices.map(v => v[2]),
          i: faces.map(f => f[0]),
          j: faces.map(f => f[1]),
          k: faces.map(f => f[2]),
          color: clusterColor,
          opacity: 0.9,
          showlegend: pointIndex === 0,
          name: pointIndex === 0 ? `Cluster ${clusterId}` : undefined,
          text: hoverText,
          hoverinfo: 'text',
          lighting: {
            ambient: 0.6,
            diffuse: 0.9,
            specular: 0.3,
            roughness: 0.1
          }
        });
      });
    });

  // compute layout size from actual container so Plotly fills available width and height
  const container = plotRef.current!.parentElement as HTMLElement | null;
  const computedWidth = container ? container.clientWidth : width;
  const computedHeight = container ? container.clientHeight : height;

  const layout = {
        title: {
        text: '3D Column Chart - Company Clustering Analysis',
        font: { size: 16 }
      },
      scene: {
        xaxis: {
          title: 'Embedding X',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        yaxis: {
          title: 'Embedding Y',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        zaxis: {
          title: 'Company Metrics (Height)',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
          range: [0, null] // Start from 0 for better column visualization
        },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        },
        // Enable full 3D interaction: orbit, zoom, pan
        dragmode: activeTool === 'orbit' ? 'orbit' : activeTool === 'zoom' ? 'zoom' : activeTool === 'pan' ? 'pan' : 'select'
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white',
      margin: { l: 60, r: 200, t: 60, b: 60 },
      showlegend: true,
      legend: {
        x: 1.02,
        xanchor: 'left',
        y: 1,
        yanchor: 'top',
        bgcolor: 'rgba(255,255,255,0.95)',
        bordercolor: 'rgba(0,0,0,0.15)',
        borderwidth: 1,
      },
      // size to container so CSS-driven height/width controls page scroll
      width: computedWidth,
      height: computedHeight,
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      // Enable all 3D interactions
      modeBarButtonsToRemove: [],
      // allow scroll wheel zoom
      scrollZoom: true,
    };

  Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      setPlotReady(true);

      // Add selection event handler
      if (plotRef.current) {
        (plotRef.current as any).on('plotly_selected', (eventData: any) => {
          if (eventData && eventData.range && activeTool === 'select') {
            const range = eventData.range;
            if (range.x && range.y) {
              const selectedArea = {
                xmin: range.x[0],
                xmax: range.x[1],
                ymin: range.y[0],
                ymax: range.y[1]
              };
              setSelectedArea(selectedArea);
              zoomToSelection(selectedArea);
            }
          }
        });
      }
    });

    return () => {
      if (plotRef.current) {
        try {
          (plotRef.current as any).removeAllListeners?.('plotly_selected');
        } catch (e) {
          // Ignore cleanup errors
        }
        // Don't purge on every cleanup to avoid losing plot when switching tabs
        // Only purge when component is actually being destroyed
      }
    };
  }, [data, width, height]);

  const downloadPlotAsPNG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1200,
        height: 800,
        filename: 'cluster-visualization'
      });
    }
  };

  const downloadPlotAsSVG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'svg',
        width: 1200,
        height: 800,
        filename: 'cluster-visualization'
      });
    }
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current || plotRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
      // Give the browser a tick then resize the Plotly plot to fit fullscreen
      setTimeout(() => {
        if (plotRef.current && (Plotly as any).Plots && (Plotly as any).Plots.resize) {
          try { (Plotly as any).Plots.resize(plotRef.current); } catch (e) { /* noop */ }
        }
      }, 200);
    } catch (err) {
      // ignore fullscreen errors (user may block)
    }
  };

  const zoomToSelection = (area: {xmin: number, xmax: number, ymin: number, ymax: number}) => {
    if (!plotRef.current || !plotReady) return;

    // Calculate zoom factor to expand the selected area
    const xRange = area.xmax - area.xmin;
    const yRange = area.ymax - area.ymin;
    const padding = 0.1; // 10% padding

    const update = {
      'scene.xaxis.range': [area.xmin - xRange * padding, area.xmax + xRange * padding],
      'scene.yaxis.range': [area.ymin - yRange * padding, area.ymax + yRange * padding],
    };

    Plotly.relayout(plotRef.current, update);
  };

  const resetZoom = () => {
    if (!plotRef.current || !plotReady) return;

    const update = {
      'scene.xaxis.range': null,
      'scene.yaxis.range': null,
      'scene.zaxis.range': [0, null]
    };

    Plotly.relayout(plotRef.current, update);
    setSelectedArea(null);
  };

  const scaleBetweenPoints = () => {
    if (!plotRef.current || !plotReady || !selectedArea) return;

    // Find points in selected area
    const pointsInArea = data.filter(point => 
      point.x >= selectedArea.xmin && point.x <= selectedArea.xmax &&
      point.y >= selectedArea.ymin && point.y <= selectedArea.ymax
    );

    if (pointsInArea.length === 0) return;

    // Calculate average distance between points in selected area
    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < pointsInArea.length; i++) {
      for (let j = i + 1; j < pointsInArea.length; j++) {
        const distance = Math.sqrt(
          Math.pow(pointsInArea[i].x - pointsInArea[j].x, 2) + 
          Math.pow(pointsInArea[i].y - pointsInArea[j].y, 2)
        );
        totalDistance += distance;
        pairCount++;
      }
    }

    if (pairCount === 0) return;

    const avgDistance = totalDistance / pairCount;
    const scaleFactor = Math.max(2, Math.min(10, 1 / avgDistance)); // Scale factor between 2x and 10x

    // Apply scaling by adjusting the range
    const centerX = (selectedArea.xmin + selectedArea.xmax) / 2;
    const centerY = (selectedArea.ymin + selectedArea.ymax) / 2;
    const rangeX = (selectedArea.xmax - selectedArea.xmin) / scaleFactor;
    const rangeY = (selectedArea.ymax - selectedArea.ymin) / scaleFactor;

    const update = {
      'scene.xaxis.range': [centerX - rangeX/2, centerX + rangeX/2],
      'scene.yaxis.range': [centerY - rangeY/2, centerY + rangeY/2],
    };

    Plotly.relayout(plotRef.current, update);
  };

  useEffect(() => {
    const handler = () => {
      if (plotRef.current && (Plotly as any).Plots && (Plotly as any).Plots.resize) {
        try { (Plotly as any).Plots.resize(plotRef.current); } catch (e) { /* noop */ }
      }
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handler);
    window.addEventListener('resize', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      window.removeEventListener('resize', handler);
    };
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (plotRef.current) {
        try {
          Plotly.purge(plotRef.current);
        } catch (e) {
          console.warn('Plot cleanup error:', e);
        }
      }
    };
  }, []);

  return (
    <div className="cluster-visualization relative" ref={containerRef}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cluster Visualization</h3>
          <p className="text-sm text-gray-600">
            3D Column Chart showing company metrics by cluster • Dataset: {clusterResult.dataset_id} • 
            Clusters: {clusterResult.best_k} • Companies: {data.length}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Interaction Tools */}
          <div className="flex border rounded-md mr-2">
            <Button
              variant={activeTool === "orbit" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("orbit")}
              className="rounded-r-none"
              title="3D Orbit Tool"
              data-testid="tool-orbit"
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "zoom" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("zoom")}
              className="rounded-none border-l border-r"
              title="Zoom Tool"
              data-testid="tool-zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "select" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("select")}
              className="rounded-l-none"
              title="Box Select Tool - Chọn vùng không gian để phóng to"
              data-testid="tool-select"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Actions */}
          {selectedArea && (
            <div className="flex gap-1 mr-2">
              <Button
                variant="outline"
                size="sm"
                onClick={scaleBetweenPoints}
                title="Tăng scale distance giữa các điểm trong vùng đã chọn"
                data-testid="scale-points"
              >
                🔍 Scale Up
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetZoom}
                title="Reset zoom về ban đầu"
                data-testid="reset-zoom"
              >
                🔄 Reset
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={downloadPlotAsPNG}
            title="Download as PNG"
            data-testid="download-cluster-png"
            disabled={!plotReady}
          >
            <Download className="h-4 w-4 mr-1" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPlotAsSVG}
            title="Download as SVG"
            data-testid="download-cluster-svg"
            disabled={!plotReady}
          >
            <FileImage className="h-4 w-4 mr-1" />
            SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            data-testid="fullscreen-cluster"
          >
            <Maximize className="h-4 w-4 mr-1" />
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </Button>
        </div>
      </div>
      <div className="border border-gray-200 rounded overflow-auto" style={{ width: '100%', height: `${height}px`, maxHeight: '80vh' }}>
        <div
          ref={plotRef}
          className="w-full h-full min-h-full"
          style={{ width: '100%', height: '100%', minHeight: `${height}px` }}
        />
      </div>
    </div>
  );
}