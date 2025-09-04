import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileImage, Maximize, Move, ZoomIn, Square, RotateCcw, Target, Expand } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useClusteringStore } from "@/lib/clustering-store";

interface DataPoint {
  x: number;
  y: number;
  z?: number;
  cluster: number;
  size: number;
  index: number;
  info?: {
    name?: string;
    taxcode?: string;
    sector?: string;
    employees?: number;
    [key: string]: any;
  };
}

interface InteractiveZoomSpaceProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  title?: string;
  is3D?: boolean;
  onSelectionChange?: (selectedPoints: DataPoint[]) => void;
}

export default function InteractiveZoomSpace({
  data = [],
  width = 800,
  height = 600,
  title = "Interactive Clustering Space",
  is3D = true,
  onSelectionChange
}: InteractiveZoomSpaceProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<"orbit" | "zoom" | "pan" | "rotate">("rotate");
  const [selectedArea, setSelectedArea] = useState<{xmin: number, xmax: number, ymin: number, ymax: number, zmin?: number, zmax?: number} | null>(null);
  const [scaleFactor, setScaleFactor] = useState([1]);
  const [selectedPoints, setSelectedPoints] = useState<DataPoint[]>([]);
  const [zoomHistory, setZoomHistory] = useState<any[]>([]);
  const [filteredCluster, setFilteredCluster] = useState<number | null>(null);

  // Color palette for clusters
  const colors = [
    '#1976D2', '#4CAF50', '#F44336', '#FF9800', '#9C27B0', '#FF5722',
    '#607D8B', '#795548', '#E91E63', '#00BCD4', '#8BC34A', '#FFC107',
    '#3F51B5', '#009688', '#CDDC39', '#FF7043'
  ];

  // Get filtered data based on selected cluster
  const getFilteredData = useCallback(() => {
    return filteredCluster !== null ? data.filter(point => point.cluster === filteredCluster) : data;
  }, [data, filteredCluster]);

  // Transform clustering results to the format expected by InteractiveZoomSpace
  const scaledData = useMemo(() => {
    console.log("🚀 Interactive Zoom Space: Transforming clustering data...");

    if (!data || data.length === 0) {
      console.log("⚠️ No clustering data available");
      return [];
    }

    // Check if data is from clustering store or passed directly
    let sourceData: any[] = [];

    if (Array.isArray(data) && data.length > 0 && data[0].hasOwnProperty('x')) {
      // Direct data format
      sourceData = data;
    } else {
      // Clustering store format - need to transform
      const storeResults = (data as any);
      if (storeResults?.clusterResult?.companies && Array.isArray(storeResults.clusterResult.companies)) {
        console.log("📊 Total companies:", storeResults.clusterResult.companies.length);

        storeResults.clusterResult.companies.forEach((company: any, companyIndex: number) => {
          if (company.enterprise && Array.isArray(company.enterprise)) {
            company.enterprise.forEach((enterprise: any, enterpriseIndex: number) => {
              const clusterLabel = enterprise.cluster !== undefined ? enterprise.cluster : (enterprise.Label || 0);
              const embX = enterprise.emb_x;
              const embY = enterprise.emb_y;

              // Only process if we have valid coordinates
              if (embX !== null && embX !== undefined && embY !== null && embY !== undefined && !isNaN(embX) && !isNaN(embY)) {
                const employeeCount = enterprise.empl_qtty || 1;

                // Calculate Z using the specified formula
                const s_DT_TTM = enterprise.s_DT_TTM || 0;
                const s_TTS = enterprise.s_TTS || 0;
                const s_VCSH = enterprise.s_VCSH || 0;
                const s_EMPL = enterprise.s_EMPL || 0;
                const calculatedZ = (s_DT_TTM + s_TTS + s_VCSH) * 0.3 + s_EMPL * 0.1;

                sourceData.push({
                  x: embX,
                  y: embY,
                  z: calculatedZ,
                  cluster: clusterLabel,
                  size: Math.max(0.1, Math.log10(employeeCount + 1) * 0.3),
                  index: companyIndex * 1000 + enterpriseIndex,
                  info: {
                    name: enterprise.name || `Company ${companyIndex}-${enterpriseIndex}`,
                    taxcode: enterprise.taxcode || '',
                    sector: enterprise.sector_name || '',
                    employees: employeeCount
                  }
                });
              }
            });
          }
        });
      }
    }

    console.log("✅ Interactive Zoom Space: Data transformation completed");
    console.log("📊 Total points processed:", sourceData.length);
    return sourceData;
  }, [data]);

  // Calculate scaled positions based on selection and scale factor
  const getScaledData = useCallback(() => {
    const filteredData = getFilteredData();

    if (!selectedArea || scaleFactor[0] === 1) return filteredData;

    const centerX = (selectedArea.xmin + selectedArea.xmax) / 2;
    const centerY = (selectedArea.ymin + selectedArea.ymax) / 2;
    const centerZ = is3D && selectedArea.zmin !== undefined && selectedArea.zmax !== undefined
      ? (selectedArea.zmin + selectedArea.zmax) / 2
      : 0;

    return filteredData.map(point => {
      // Check if point is in selected area
      const inArea = point.x >= selectedArea.xmin && point.x <= selectedArea.xmax &&
                    point.y >= selectedArea.ymin && point.y <= selectedArea.ymax &&
                    (!is3D || !selectedArea.zmin || !selectedArea.zmax ||
                     (point.z !== undefined && point.z >= selectedArea.zmin && point.z <= selectedArea.zmax));

      if (!inArea) return point;

      // Scale distance from center
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const dz = is3D && point.z !== undefined ? point.z - centerZ : 0;

      return {
        ...point,
        x: centerX + dx * scaleFactor[0],
        y: centerY + dy * scaleFactor[0],
        z: is3D && point.z !== undefined ? centerZ + dz * scaleFactor[0] : point.z
      };
    });
  }, [getFilteredData, selectedArea, scaleFactor, is3D]);

  // Create plot
  useEffect(() => {
    if (!plotRef.current || !scaledData.length) return;

    const clusters = Array.from(new Set(scaledData.map(d => d.cluster))).sort();

    // Create traces for each cluster
    const traces = clusters.map((clusterId, index) => {
      const clusterPoints = scaledData.filter(d => d.cluster === clusterId);

      const trace: any = {
        x: clusterPoints.map(d => d.x),
        y: clusterPoints.map(d => d.y),
        mode: 'markers',
        type: is3D ? 'scatter3d' : 'scatter',
        name: `Cluster ${clusterId}`,
        marker: {
          color: colors[index % colors.length],
          size: clusterPoints.map(d => Math.max(4, d.size * 8)),
          opacity: 0.7,
          line: {
            color: '#333',
            width: 1
          }
        },
        text: clusterPoints.map(d => {
          let text = `${d.info?.name || `Point ${d.index}`}<br>`;
          text += `Cluster: ${d.cluster}<br>`;
          text += `Size: ${d.size.toFixed(2)}<br>`;
          text += `Position: (${d.x.toFixed(3)}, ${d.y.toFixed(3)}`;
          if (is3D && d.z !== undefined) text += `, ${d.z.toFixed(3)}`;
          text += `)<br>`;
          if (d.info?.taxcode) text += `Tax Code: ${d.info.taxcode}<br>`;
          if (d.info?.sector) text += `Sector: ${d.info.sector}<br>`;
          if (d.info?.employees) text += `Employees: ${d.info.employees.toLocaleString()}`;
          return text;
        }),
        hovertemplate: '%{text}<extra></extra>',
      };

      if (is3D) {
        trace.z = clusterPoints.map(d => d.z || d.size);
      }

      return trace;
    });

    const layout: any = {
      title: {
        text: title,
        font: { size: 16, color: '#333' }
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        x: 1.02,
        y: 1,
        xanchor: 'left',
        bgcolor: 'rgba(255,255,255,0.95)',
        bordercolor: '#333',
        borderwidth: 1
      },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      margin: { l: 60, r: 100, t: 80, b: 60 },
      annotations: [
        {
          x: 0.98,
          y: 0.98,
          xref: 'paper',
          yref: 'paper',
          text: '<b>Chú thích:</b><br>' +
                'X: Sectorcode after embedded<br>' +
                'Y: Sectorcode after embedded<br>' +
                (is3D ? 'Z: Weighted Aggregate Scale' : ''),
          showarrow: false,
          align: 'left',
          bgcolor: 'rgba(255, 255, 255, 0.9)',
          bordercolor: '#666',
          borderwidth: 1,
          borderpad: 8,
          font: { size: 11, color: '#333' },
          xanchor: 'right',
          yanchor: 'top'
        }
      ]
    };

    if (is3D) {
      layout.scene = {
        xaxis: {
          title: 'X Coordinate',
          gridcolor: '#e0e0e0',
          zerolinecolor: '#bdbdbd'
        },
        yaxis: {
          title: 'Y Coordinate',
          gridcolor: '#e0e0e0',
          zerolinecolor: '#bdbdbd'
        },
        zaxis: {
          title: 'Z Coordinate / Size',
          gridcolor: '#e0e0e0',
          zerolinecolor: '#bdbdbd'
        },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        },
        dragmode: activeTool === 'pan' ? 'pan' : activeTool === 'zoom' ? 'zoom' : activeTool === 'orbit' ? 'orbit' : 'rotate'
      };
    } else {
      layout.xaxis = {
        title: 'X Coordinate',
        gridcolor: '#e0e0e0',
        zerolinecolor: '#bdbdbd'
      };
      layout.yaxis = {
        title: 'Y Coordinate',
        gridcolor: '#e0e0e0',
        zerolinecolor: '#bdbdbd'
      };
      layout.dragmode = activeTool === 'pan' ? 'pan' : activeTool === 'zoom' ? 'zoom' : 'select';
    }

    const config = {
      displayModeBar: false,
      responsive: true,
      doubleClick: 'reset'
    };

    Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      setPlotReady(true);
      console.log('Interactive zoom space rendered successfully');

      // Add selection event handlers
      if (plotRef.current) {
        const plotDiv = plotRef.current as any;

        // Handle box/lasso selection
        plotDiv.on('plotly_selected', (eventData: any) => {
          if (eventData && eventData.points && eventData.points.length > 0) {
            const points = eventData.points;
            const selectedData: DataPoint[] = [];

            // Calculate bounding box of selection
            let xmin = Infinity, xmax = -Infinity;
            let ymin = Infinity, ymax = -Infinity;
            let zmin = Infinity, zmax = -Infinity;

            points.forEach((point: any) => {
              const dataPoint = scaledData[point.pointIndex];
              if (dataPoint) {
                selectedData.push(dataPoint);
                xmin = Math.min(xmin, point.x);
                xmax = Math.max(xmax, point.x);
                ymin = Math.min(ymin, point.y);
                ymax = Math.max(ymax, point.y);
                if (is3D && point.z !== undefined) {
                  zmin = Math.min(zmin, point.z);
                  zmax = Math.max(zmax, point.z);
                }
              }
            });

            if (selectedData.length > 0) {
              const area: any = { xmin, xmax, ymin, ymax };
              if (is3D && zmin !== Infinity && zmax !== -Infinity) {
                area.zmin = zmin;
                area.zmax = zmax;
              }

              setSelectedArea(area);
              setSelectedPoints(selectedData);
              onSelectionChange?.(selectedData);

              // Save current zoom state to history
              saveZoomState();
            }
          }
        });

        // Handle deselection
        plotDiv.on('plotly_deselect', () => {
          setSelectedArea(null);
          setSelectedPoints([]);
          onSelectionChange?.([]);
        });
      }
    });

    return () => {
      if (plotRef.current) {
        try {
          const plotDiv = plotRef.current as any;
          plotDiv.removeAllListeners('plotly_selected');
          plotDiv.removeAllListeners('plotly_deselect');
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };

  }, [scaledData, activeTool, getScaledData, is3D, title, onSelectionChange, filteredCluster]);

  // Auto-update plot when scale factor changes
  useEffect(() => {
    if (!plotRef.current || !plotReady || scaleFactor[0] === 1) return;

    // Re-render plot with new scaled data
    const filteredData = getFilteredData();

    if (!selectedArea || scaleFactor[0] === 1) return;

    const centerX = (selectedArea.xmin + selectedArea.xmax) / 2;
    const centerY = (selectedArea.ymin + selectedArea.ymax) / 2;
    const centerZ = is3D && selectedArea.zmin !== undefined && selectedArea.zmax !== undefined
      ? (selectedArea.zmin + selectedArea.zmax) / 2
      : 0;

    const scaledPoints = filteredData.map(point => {
      // Check if point is in selected area
      const inArea = point.x >= selectedArea.xmin && point.x <= selectedArea.xmax &&
                    point.y >= selectedArea.ymin && point.y <= selectedArea.ymax &&
                    (!is3D || !selectedArea.zmin || !selectedArea.zmax ||
                     (point.z !== undefined && point.z >= selectedArea.zmin && point.z <= selectedArea.zmax));

      if (!inArea) return point;

      // Scale distance from center
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const dz = is3D && point.z !== undefined ? point.z - centerZ : 0;

      return {
        ...point,
        x: centerX + dx * scaleFactor[0],
        y: centerY + dy * scaleFactor[0],
        z: is3D && point.z !== undefined ? centerZ + dz * scaleFactor[0] : point.z
      };
    });

    // Update plot with scaled data
    const clusters = Array.from(new Set(scaledPoints.map(d => d.cluster))).sort();
    const traces = clusters.map((clusterId, index) => {
      const clusterPoints = scaledPoints.filter(d => d.cluster === clusterId);

      const trace: any = {
        x: clusterPoints.map(d => d.x),
        y: clusterPoints.map(d => d.y),
        mode: 'markers',
        type: is3D ? 'scatter3d' : 'scatter',
        name: `Cluster ${clusterId}`,
        marker: {
          color: colors[index % colors.length],
          size: clusterPoints.map(d => Math.max(4, d.size * 8)),
          opacity: 0.7,
          line: {
            color: '#333',
            width: 1
          }
        },
        text: clusterPoints.map(d => {
          let text = `${d.info?.name || `Point ${d.index}`}<br>`;
          text += `Cluster: ${d.cluster}<br>`;
          text += `Size: ${d.size.toFixed(2)}<br>`;
          text += `Position: (${d.x.toFixed(3)}, ${d.y.toFixed(3)}`;
          if (is3D && d.z !== undefined) text += `, ${d.z.toFixed(3)}`;
          text += `)<br>`;
          if (d.info?.taxcode) text += `Tax Code: ${d.info.taxcode}<br>`;
          if (d.info?.sector) text += `Sector: ${d.info.sector}<br>`;
          if (d.info?.employees) text += `Employees: ${d.info.employees.toLocaleString()}`;
          return text;
        }),
        hovertemplate: '%{text}<extra></extra>',
      };

      if (is3D) {
        trace.z = clusterPoints.map(d => d.z || d.size);
      }

      return trace;
    });

    Plotly.restyle(plotRef.current, {
      x: traces.map(t => t.x),
      y: traces.map(t => t.y),
      ...(is3D && { z: traces.map(t => t.z) })
    });

  }, [scaleFactor, selectedArea, getFilteredData, is3D]);

  // Save current zoom state
  const saveZoomState = () => {
    if (!plotRef.current || !plotReady) return;

    const plotDiv = plotRef.current as any;
    const layout = plotDiv.layout;

    if (is3D && layout.scene) {
      setZoomHistory(prev => [...prev, {
        scene: {
          xaxis: { ...layout.scene.xaxis },
          yaxis: { ...layout.scene.yaxis },
          zaxis: { ...layout.scene.zaxis },
          camera: { ...layout.scene.camera }
        }
      }]);
    } else {
      setZoomHistory(prev => [...prev, {
        xaxis: { ...layout.xaxis },
        yaxis: { ...layout.yaxis }
      }]);
    }
  };

  // Zoom to selected area with automatic scaling
  const zoomToSelection = () => {
    if (!plotRef.current || !plotReady || !selectedArea) return;

    const padding = 0.1;
    const xRange = selectedArea.xmax - selectedArea.xmin;
    const yRange = selectedArea.ymax - selectedArea.ymin;

    // Auto-calculate optimal scale based on zoom level
    const originalDataBounds = {
      xmin: Math.min(...scaledData.map(d => d.x)),
      xmax: Math.max(...scaledData.map(d => d.x)),
      ymin: Math.min(...scaledData.map(d => d.y)),
      ymax: Math.max(...scaledData.map(d => d.y))
    };

    const originalXRange = originalDataBounds.xmax - originalDataBounds.xmin;
    const originalYRange = originalDataBounds.ymax - originalDataBounds.ymin;

    // Calculate zoom ratio (how much we're zooming in)
    const zoomRatioX = originalXRange / xRange;
    const zoomRatioY = originalYRange / yRange;
    const avgZoomRatio = (zoomRatioX + zoomRatioY) / 2;

    // Auto-scale: increase scale factor based on zoom level
    const autoScaleFactor = Math.min(5, Math.max(1, Math.log2(avgZoomRatio + 1) * 1.5));

    console.log(`🔍 Auto-scaling: Zoom ratio ${avgZoomRatio.toFixed(2)}x, Scale factor ${autoScaleFactor.toFixed(2)}x`);

    // Update scale factor automatically
    setScaleFactor([autoScaleFactor]);

    const update: any = {};

    if (is3D) {
      update['scene.xaxis.range'] = [
        selectedArea.xmin - xRange * padding,
        selectedArea.xmax + xRange * padding
      ];
      update['scene.yaxis.range'] = [
        selectedArea.ymin - yRange * padding,
        selectedArea.ymax + yRange * padding
      ];

      if (selectedArea.zmin !== undefined && selectedArea.zmax !== undefined) {
        const zRange = selectedArea.zmax - selectedArea.zmin;
        update['scene.zaxis.range'] = [
          selectedArea.zmin - zRange * padding,
          selectedArea.zmax + zRange * padding
        ];
      }
    } else {
      update['xaxis.range'] = [
        selectedArea.xmin - xRange * padding,
        selectedArea.xmax + xRange * padding
      ];
      update['yaxis.range'] = [
        selectedArea.ymin - yRange * padding,
        selectedArea.ymax + yRange * padding
      ];
    }

    Plotly.relayout(plotRef.current, update);
  };

  // Reset zoom to original view
  const resetZoom = () => {
    if (!plotRef.current || !plotReady) return;

    const update: any = {};

    if (is3D) {
      update['scene.xaxis.range'] = null;
      update['scene.yaxis.range'] = null;
      update['scene.zaxis.range'] = null;
      update['scene.camera'] = { eye: { x: 1.5, y: 1.5, z: 1.5 } };
    } else {
      update['xaxis.range'] = null;
      update['yaxis.range'] = null;
    }

    Plotly.relayout(plotRef.current, update);
    setSelectedArea(null);
    setSelectedPoints([]);
    setScaleFactor([1]);
    setZoomHistory([]);
    onSelectionChange?.([]);
  };

  // Go back to previous zoom state
  const goBackZoom = () => {
    if (!plotRef.current || !plotReady || zoomHistory.length === 0) return;

    const previousState = zoomHistory[zoomHistory.length - 1];
    Plotly.relayout(plotRef.current, previousState);
    setZoomHistory(prev => prev.slice(0, -1));
  };

  // Apply smart scaling to enhance visual separation
  const applySmartScaling = () => {
    if (!selectedArea || selectedPoints.length === 0) return;

    // Calculate average distance between points in selection
    let totalDistance = 0;
    let pairCount = 0;

    for (let i = 0; i < selectedPoints.length; i++) {
      for (let j = i + 1; j < selectedPoints.length; j++) {
        const p1 = selectedPoints[i];
        const p2 = selectedPoints[j];
        const distance = Math.sqrt(
          Math.pow(p1.x - p2.x, 2) +
          Math.pow(p1.y - p2.y, 2) +
          (is3D && p1.z !== undefined && p2.z !== undefined ? Math.pow(p1.z - p2.z, 2) : 0)
        );
        totalDistance += distance;
        pairCount++;
      }
    }

    if (pairCount === 0) return;

    const avgDistance = totalDistance / pairCount;
    const optimalScale = Math.max(1.5, Math.min(5, 0.5 / avgDistance));
    setScaleFactor([optimalScale]);

    // Re-render with new scale
    setTimeout(() => {
      zoomToSelection();
    }, 100);
  };

  // Focus on specific cluster - Filter chỉ hiển thị cluster đó
  const focusOnCluster = (clusterId: number) => {
    if (filteredCluster === clusterId) {
      // Nếu nhấn lại cùng cluster -> reset filter
      setFilteredCluster(null);
      resetZoom();
    } else {
      // Set filter to new cluster
      const clusterPoints = data.filter(d => d.cluster === clusterId);
      if (clusterPoints.length === 0) return;

      setFilteredCluster(clusterId);
      setSelectedPoints(clusterPoints);
      onSelectionChange?.(clusterPoints);
    }
  };

  // Download functions
  const downloadPNG = () => {
    if (!plotRef.current || !plotReady) return;
    Plotly.downloadImage(plotRef.current, {
      format: 'png',
      width: 1200,
      height: 800,
      filename: 'interactive-zoom-space'
    });
  };

  const downloadSVG = () => {
    if (!plotRef.current || !plotReady) return;
    Plotly.downloadImage(plotRef.current, {
      format: 'svg',
      width: 1200,
      height: 800,
      filename: 'interactive-zoom-space'
    });
  };

  // Toggle fullscreen
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
      setTimeout(() => {
        if (plotRef.current && (Plotly as any).Plots?.resize) {
          try {
            (Plotly as any).Plots.resize(plotRef.current);
          } catch (e) { /* noop */ }
        }
      }, 200);
    } catch (err) {
      // ignore fullscreen errors
    }
  };

  // Get unique clusters for cluster selector
  const clusters = Array.from(new Set(data.map(d => d.cluster))).sort();

  // Get lambda value from clustering store
  const { parameters } = useClusteringStore();
  const lambdaValue = parameters?.lambda || 0.5;

  // Dynamically construct the title
  const dynamicTitle = `Scatter Plot theo Lambda (λ): ${lambdaValue}, Clusters: ${clusters.join(', ')}`;


  if (!data.length) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center text-muted-foreground">
            <div className="mb-3">📊</div>
            <p>No data available for visualization</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full h-full" ref={containerRef}>
      {/* Container with Scroll */}
      <ScrollArea className="h-full w-full max-w-screen">
        <div className="w-full space-y-4 pb-6 px-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span>{dynamicTitle}</span>
                  {selectedPoints.length > 0 && (
                    <Badge variant="secondary">
                      {selectedPoints.length} points selected
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
                      className={is3D ? "rounded-none border-l border-r" : "rounded-l-none"}
                      title="Zoom Tool"
                      data-testid="tool-zoom"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    {is3D && (
                      <Button
                        variant={activeTool === "orbit" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setActiveTool("orbit")}
                        className="rounded-l-none"
                        title="Orbit Tool"
                        data-testid="tool-orbit"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={function() {
                        setFilteredCluster(null);
                        setSelectedPoints([]);
                        onSelectionChange?.([]);
                        resetZoom();
                      }}
                      title="Reset to show all clusters"
                      data-testid="reset-view"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Show All
                    </Button>
                  </div>

                  {/* Download Options */}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadPNG}
                      disabled={!plotReady}
                      title="Download as PNG"
                      data-testid="download-png"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PNG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadSVG}
                      disabled={!plotReady}
                      title="Download as SVG"
                      data-testid="download-svg"
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
                      <Maximize className="h-4 w-4 mr-1" />
                      {isFullscreen ? 'Exit' : 'Full'}
                    </Button>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Controls Panel - Centered */}
              <div className="flex justify-center">
                <div className="p-4 bg-muted/50 rounded-lg max-w-4xl w-full">
                  <div className="flex flex-col lg:flex-row items-center justify-center gap-4">
                    {/* Scale Factor Control */}
                    {selectedArea && (
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <label className="text-sm font-medium whitespace-nowrap">
                          Scale Factor: {scaleFactor[0].toFixed(1)}x
                        </label>
                        <Slider
                          value={scaleFactor}
                          onValueChange={setScaleFactor}
                          min={0.1}
                          max={5}
                          step={0.1}
                          className="w-32 lg:w-48"
                          data-testid="scale-slider"
                        />
                      </div>
                    )}


                  </div>
                </div>
              </div>

              {/* Plot Container - Top Aligned */}
              <div className="flex">
                <div
                  className="border border-gray-200 rounded overflow-hidden w-full"
                  style={{
                    height: Math.max(700, height),
                    minHeight: '700px'
                  }}
                >
                  <div
                    ref={plotRef}
                    className="w-full h-full"
                    data-testid="interactive-zoom-space"
                  />
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}