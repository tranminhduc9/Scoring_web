import { useEffect, useRef, useState } from "react";
import { useClusteringStore } from "@/lib/clustering-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Move, ZoomIn, Lasso, Maximize, Download, FileImage, Expand } from "lucide-react";
import Plotly from "plotly.js-dist";

export default function ClusterVisualization() {
  const { results, isRunning, parameters } = useClusteringStore();
  const plotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [selectedClusters, setSelectedClusters] = useState<number[]>([]);
  const [activeTool, setActiveTool] = useState<"orbit" | "zoom" | "pan">("orbit");
  const [isFullscreen, setIsFullscreen] = useState(false);

  console.log("🚀 ClusterVisualization component loaded at:", new Date().toLocaleTimeString());

  useEffect(() => {
    if (!plotRef.current || !results?.clusterResult) return;

    const clusterResult = results.clusterResult;
    console.log("✅ Processed cluster data:", clusterResult);

    // Transform API data for visualization
    let data: any[] = [];

    if (clusterResult.companies && Array.isArray(clusterResult.companies)) {
      // Process new API format with companies array
      let pointIndex = 0;

      clusterResult.companies.forEach((company: any) => {
        if (company.enterprise && Array.isArray(company.enterprise)) {
          company.enterprise.forEach((enterprise: any) => {
            const clusterLabel = enterprise.cluster || enterprise.Label || 0;

            // Get coordinates
            let embX, embY;
            if (enterprise.pca2_x !== undefined && enterprise.pca2_y !== undefined) {
              embX = enterprise.pca2_x;
              embY = enterprise.pca2_y;
            } else if (enterprise.emb_x !== undefined && enterprise.emb_y !== undefined) {
              embX = enterprise.emb_x;
              embY = enterprise.emb_y;
            } else {
              embX = 0;
              embY = 0;
            }

            // Calculate size based on employee count
            let calculatedSize = 0.1;
            if (enterprise.empl_qtty && enterprise.empl_qtty > 0) {
              calculatedSize = Math.log10(enterprise.empl_qtty + 1) * 0.5;
            }
            calculatedSize = Math.max(0.1, calculatedSize);

            data.push({
              id: `company-${pointIndex}`,
              name: enterprise.name || 'Unknown Company',
              taxcode: enterprise.taxcode || '',
              sector: enterprise.sector_name || '',
              sector_unique_id: enterprise.sector_unique_id || company.sector_unique_id || '',
              employees: enterprise.empl_qtty || 0,
              x: embX,
              y: embY,
              size: calculatedSize,
              cluster: clusterLabel
            });
            pointIndex++;
          });
        }
      });
    }

    console.log("🎨 Creating visualization with", data.length, "data points");

    if (data.length === 0) {
      console.log("⚠️ No data or plotRef:", { dataLength: data.length, plotRef: !!plotRef.current });
      return;
    }

    const clusters = Array.from(new Set(data.map(d => d.cluster).filter(c => c !== null && c !== undefined))).sort();
    console.log("🎯 Found clusters:", clusters);

    // Color palette for clusters
    const colors = [
      '#1976D2', '#4CAF50', '#F44336', '#FF9800', '#9C27B0', '#FF5722',
      '#607D8B', '#795548', '#E91E63', '#00BCD4', '#8BC34A', '#FFC107'
    ];

    // Create 3D bar/column traces for each cluster
    const traces: any[] = [];

    clusters.forEach((clusterId, index) => {
      const clusterPoints = data.filter(d => d.cluster === clusterId);
      const showCluster = selectedClusters.length === 0 || selectedClusters.includes(clusterId!);
      const clusterColor = colors[index % colors.length];

      clusterPoints.forEach((point, pointIndex) => {
        const x = point.x;
        const y = point.y;
        const height = Math.max(0.1, point.size * 1.5);
        const columnWidth = 0.002;
        const w = columnWidth / 2;

        // Create detailed hover text
        let hoverText = `<b>${point.name}</b><br>`;
        hoverText += `Tọa độ: (${x.toFixed(3)}, ${y.toFixed(3)})<br>`;
        hoverText += `Kích thước quy mô: ${point.size.toFixed(2)}<br>`;
        hoverText += `Mã số thuế: ${point.taxcode}<br>`;
        hoverText += `Tên ngành: ${point.sector}<br>`;
        hoverText += `Sector ID: ${point.sector_unique_id}<br>`;
        hoverText += `Số nhân viên: ${point.employees.toLocaleString()}`;

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

        // 12 triangular faces
        const faces = [
          [0,1,2], [0,2,3], // Bottom
          [4,6,5], [4,7,6], // Top  
          [3,2,6], [3,6,7], // Front
          [0,4,5], [0,5,1], // Back
          [0,3,7], [0,7,4], // Left
          [1,5,6], [1,6,2]  // Right
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
          opacity: showCluster ? 0.8 : 0.1,
          showlegend: pointIndex === 0,
          name: pointIndex === 0 ? `Cluster ${clusterId} (${clusterPoints.length})` : undefined,
          text: hoverText,
          hoverinfo: 'text',
          visible: showCluster,
          lighting: {
            ambient: 0.4,
            diffuse: 0.8,
            specular: 0.2,
            roughness: 0.3
          },
          flatshading: false
        });
      });
    });

    const layout = {
      title: {
        text: `Bar Plot với Lambda (λ): ${parameters.lambda} Number of Clusters (k): ${clusterResult.best_k || parameters.k}`,
        font: { size: 16 }
      },
      scene: {
        xaxis: {
          title: {
            text: 'Sectorcode after embeded',
            font: { size: 14, color: '#374151' }
          },
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          showticklabels: true,
          tickformat: '.2f',
          tickfont: { size: 12, color: '#6B7280' },
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
          zerolinewidth: 1,
        },
        yaxis: {
          title: {
            text: 'Sectorcode after embeded',
            font: { size: 14, color: '#374151' }
          },
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          showticklabels: true,
          tickformat: '.2f',
          tickfont: { size: 12, color: '#6B7280' },
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
          zerolinewidth: 1,
        },
        zaxis: {
          title: {
            text: 'Weighted Aggregate Scale',
            font: { size: 14, color: '#374151' }
          },
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          showticklabels: true,
          tickformat: '.2f',
          tickfont: { size: 12, color: '#6B7280' },
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
          zerolinewidth: 1,
          range: [0, null]
        },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        },
        dragmode: activeTool === 'orbit' ? 'orbit' : activeTool === 'zoom' ? 'zoom' : 'pan',
        aspectratio: {
          x: 1, y: 1, z: 0.8
        }
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white',
      margin: { l: 60, r: 100, t: 80, b: 60 },
      showlegend: true,
      legend: {
        x: 1.02,
        xanchor: 'left',
        y: 1,
        yanchor: 'top',
        bgcolor: 'rgba(255,255,255,0.95)',
        bordercolor: 'rgba(0,0,0,0.15)',
        borderwidth: 1,
        font: { size: 12 },
        itemsizing: 'constant',
        itemwidth: 30,
      },
      autosize: true,
      width: undefined,
      height: undefined
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      doubleClick: 'reset',
    };

    Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      setPlotReady(true);
    });

    // Set up tool interactions
    if (plotRef.current) {
      const plotDiv = plotRef.current as any;

      switch (activeTool) {
        case 'orbit':
          Plotly.relayout(plotDiv, { 'scene.dragmode': 'orbit' });
          break;
        case 'zoom':
          Plotly.relayout(plotDiv, { 'scene.dragmode': 'zoom' });
          break;
        case 'pan':
          Plotly.relayout(plotDiv, { 'scene.dragmode': 'pan' });
          break;
      }
    }

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [results, selectedClusters, activeTool]);

  const handleClusterFilter = (value: string) => {
    if (value === "all") {
      setSelectedClusters([]);
    } else {
      const clusterId = parseInt(value);
      setSelectedClusters([clusterId]);
    }
  };

  const resetZoom = () => {
    if (plotRef.current && plotReady) {
      Plotly.relayout(plotRef.current, {
        'scene.xaxis.autorange': true,
        'scene.yaxis.autorange': true,
        'scene.zaxis.autorange': true,
        'scene.camera': {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        }
      });
    }
  };

  const downloadPlotAsPNG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1200,
        height: 800,
        filename: 'bar-plot-visualization'
      });
    }
  };

  const downloadPlotAsSVG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'svg',
        width: 1200,
        height: 800,
        filename: 'bar-plot-visualization'
      });
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
      // Resize plot after fullscreen change
      setTimeout(() => {
        if (plotRef.current && (Plotly as any).Plots?.resize) {
          try {
            (Plotly as any).Plots.resize(plotRef.current);
          } catch (e) { /* ignore resize errors */ }
        }
      }, 200);
    } catch (err) {
      console.warn('Fullscreen not supported or failed:', err);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Resize plot when exiting fullscreen
      if (!document.fullscreenElement) {
        setTimeout(() => {
          if (plotRef.current && (Plotly as any).Plots?.resize) {
            try {
              (Plotly as any).Plots.resize(plotRef.current);
            } catch (e) { /* ignore resize errors */ }
          }
        }, 200);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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

  if (isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Processing clustering...</p>
        </div>
      </div>
    );
  }

  if (!results?.clusterResult) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card">
        <div className="text-center text-muted-foreground">
          <div className="mb-3">📊</div>
          <p>No data to visualize</p>
          <p className="text-sm mt-2">Upload files and run clustering to see results</p>
        </div>
      </div>
    );
  }

  // Transform data for display
  let processedData: any[] = [];
  const clusterResult = results.clusterResult;

  if (clusterResult.companies && Array.isArray(clusterResult.companies)) {
    let pointIndex = 0;
    clusterResult.companies.forEach((company: any) => {
      if (company.enterprise && Array.isArray(company.enterprise)) {
        company.enterprise.forEach((enterprise: any) => {
          processedData.push({
            cluster: enterprise.cluster || enterprise.Label || 0
          });
          pointIndex++;
        });
      }
    });
  }

  return (
    <div className="w-full h-full" ref={containerRef}>
      <div className="w-full space-y-4 pb-6 px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>3D Bar Plot Visualization</span>
                {selectedClusters.length > 0 && (
                  <Badge variant="secondary">
                    Filtered: Cluster {selectedClusters.join(", ")}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Tool Selection */}
                <div className="flex border rounded-md">
                  <Button
                    variant={activeTool === "pan" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTool("pan")}
                    className="rounded-r-none"
                    title="Pan Tool - Di chuyển biểu đồ"
                    data-testid="tool-pan"
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
                    variant={activeTool === "orbit" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTool("orbit")}
                    className="rounded-l-none"
                    title="Orbit Tool - Xoay biểu đồ"
                    data-testid="tool-orbit"
                  >
                    <Lasso className="h-4 w-4" />
                  </Button>
                </div>

                {/* Cluster Filter */}
                <Select
                  value={selectedClusters.length === 0 ? "all" : selectedClusters.join(",")}
                  onValueChange={handleClusterFilter}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter clusters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clusters</SelectItem>
                    {Array.from(new Set(processedData.map(d => d.cluster).filter(c => c !== null && c !== undefined))).sort().map(cluster => (
                      <SelectItem key={cluster} value={cluster!.toString()}>
                        Cluster {cluster}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Navigation */}
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetZoom}
                    title="Reset View"
                    data-testid="reset-view"
                  >
                    <Maximize className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                </div>

                {/* Download Options */}
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadPlotAsPNG}
                    title="Download as PNG"
                    data-testid="download-png"
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
                    data-testid="download-svg"
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
                    data-testid="fullscreen"
                  >
                    <Expand className="h-4 w-4 mr-1" />
                    {isFullscreen ? 'Exit' : 'Full'}
                  </Button>
                </div>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Chart Info */}
            <div className="text-sm text-muted-foreground">
              Lambda (λ): {parameters.lambda} • Clusters: {clusterResult.best_k || parameters.k} • Companies: {processedData.length}
            </div>

            {/* Plot Container */}
            <div className="flex">
              <div
                className="border border-gray-200 rounded overflow-hidden w-full"
                style={{
                  height: Math.max(700, 600),
                  minHeight: '700px'
                }}
              >
                <div
                  ref={plotRef}
                  className="w-full h-full"
                  data-testid="bar-plot"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}