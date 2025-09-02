
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileImage, Maximize, Move, ZoomIn, Square, RotateCcw, Target, Expand } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

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
  const [activeTool, setActiveTool] = useState<"orbit" | "zoom" | "pan" | "select">("select");
  const [selectedArea, setSelectedArea] = useState<{xmin: number, xmax: number, ymin: number, ymax: number, zmin?: number, zmax?: number} | null>(null);
  const [scaleFactor, setScaleFactor] = useState([1]);
  const [selectedPoints, setSelectedPoints] = useState<DataPoint[]>([]);
  const [zoomHistory, setZoomHistory] = useState<any[]>([]);

  // Color palette for clusters
  const colors = [
    '#1976D2', '#4CAF50', '#F44336', '#FF9800', '#9C27B0', '#FF5722',
    '#607D8B', '#795548', '#E91E63', '#00BCD4', '#8BC34A', '#FFC107',
    '#3F51B5', '#009688', '#CDDC39', '#FF7043'
  ];

  // Calculate scaled positions based on selection and scale factor
  const getScaledData = useCallback(() => {
    if (!selectedArea || scaleFactor[0] === 1) return data;

    const centerX = (selectedArea.xmin + selectedArea.xmax) / 2;
    const centerY = (selectedArea.ymin + selectedArea.ymax) / 2;
    const centerZ = is3D && selectedArea.zmin !== undefined && selectedArea.zmax !== undefined
      ? (selectedArea.zmin + selectedArea.zmax) / 2 
      : 0;

    return data.map(point => {
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
  }, [data, selectedArea, scaleFactor, is3D]);

  // Create plot
  useEffect(() => {
    if (!plotRef.current || !data.length) return;

    const scaledData = getScaledData();
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
      margin: { l: 60, r: 100, t: 80, b: 60 }
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
        dragmode: activeTool === 'pan' ? 'pan' : activeTool === 'zoom' ? 'zoom' : activeTool === 'orbit' ? 'orbit' : 'select'
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

  }, [data, activeTool, getScaledData, is3D, title, onSelectionChange]);

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

  // Zoom to selected area with scaling
  const zoomToSelection = () => {
    if (!plotRef.current || !plotReady || !selectedArea) return;
    
    const padding = 0.1;
    const xRange = selectedArea.xmax - selectedArea.xmin;
    const yRange = selectedArea.ymax - selectedArea.ymin;
    
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

  // Focus on specific cluster
  const focusOnCluster = (clusterId: number) => {
    const clusterPoints = data.filter(d => d.cluster === clusterId);
    if (clusterPoints.length === 0) return;

    // Calculate bounding box of cluster
    const xs = clusterPoints.map(p => p.x);
    const ys = clusterPoints.map(p => p.y);
    const zs = is3D ? clusterPoints.map(p => p.z || 0) : [];

    const area = {
      xmin: Math.min(...xs),
      xmax: Math.max(...xs),
      ymin: Math.min(...ys),
      ymax: Math.max(...ys),
      ...(is3D && zs.length > 0 && {
        zmin: Math.min(...zs),
        zmax: Math.max(...zs)
      })
    };

    setSelectedArea(area);
    setSelectedPoints(clusterPoints);
    onSelectionChange?.(clusterPoints);
    saveZoomState();
    
    setTimeout(() => {
      zoomToSelection();
    }, 100);
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
    <div className="w-full space-y-4" ref={containerRef}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>{title}</span>
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
                  variant={activeTool === "select" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("select")}
                  className="rounded-r-none"
                  title="Box Select Tool"
                  data-testid="tool-select"
                >
                  <Square className="h-4 w-4" />
                </Button>
                {is3D && (
                  <Button
                    variant={activeTool === "orbit" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTool("orbit")}
                    className="rounded-none border-l border-r"
                    title="Orbit Tool"
                    data-testid="tool-orbit"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant={activeTool === "pan" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("pan")}
                  className={`${is3D ? 'rounded-none border-l border-r' : 'rounded-none border-l border-r'}`}
                  title="Pan Tool"
                  data-testid="tool-pan"
                >
                  <Move className="h-4 w-4" />
                </Button>
                <Button
                  variant={activeTool === "zoom" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("zoom")}
                  className="rounded-l-none"
                  title="Zoom Tool"
                  data-testid="tool-zoom"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              {/* Action Buttons */}
              {selectedArea && (
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={zoomToSelection}
                    title="Zoom to selected area"
                    data-testid="zoom-to-selection"
                  >
                    <Target className="h-4 w-4 mr-1" />
                    Zoom In
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={applySmartScaling}
                    title="Apply smart scaling to enhance visual separation"
                    data-testid="smart-scale"
                  >
                    <Expand className="h-4 w-4 mr-1" />
                    Smart Scale
                  </Button>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-1">
                {zoomHistory.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goBackZoom}
                    title="Go back to previous zoom"
                    data-testid="zoom-back"
                  >
                    ← Back
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetZoom}
                  title="Reset to original view"
                  data-testid="reset-zoom"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
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
          {/* Controls Panel */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
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
                  className="flex-1"
                  data-testid="scale-slider"
                />
              </div>
            )}

            {/* Cluster Quick Select */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Quick Focus:</span>
              <div className="flex gap-1">
                {clusters.slice(0, 6).map((clusterId, index) => (
                  <Button
                    key={clusterId}
                    variant="outline"
                    size="sm"
                    onClick={() => focusOnCluster(clusterId)}
                    style={{ 
                      backgroundColor: selectedPoints.some(p => p.cluster === clusterId) 
                        ? colors[index % colors.length] 
                        : 'transparent',
                      color: selectedPoints.some(p => p.cluster === clusterId) ? 'white' : undefined
                    }}
                    title={`Focus on Cluster ${clusterId}`}
                    data-testid={`focus-cluster-${clusterId}`}
                  >
                    C{clusterId}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Info Panel */}
          {selectedArea && selectedPoints.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Selection Info:</strong><br/>
                  {selectedPoints.length} points selected<br/>
                  Range X: [{selectedArea.xmin.toFixed(2)}, {selectedArea.xmax.toFixed(2)}]<br/>
                  Range Y: [{selectedArea.ymin.toFixed(2)}, {selectedArea.ymax.toFixed(2)}]
                  {is3D && selectedArea.zmin !== undefined && selectedArea.zmax !== undefined && (
                    <>Range Z: [{selectedArea.zmin.toFixed(2)}, {selectedArea.zmax.toFixed(2)}]</>
                  )}
                </div>
                <div>
                  <strong>Clusters in Selection:</strong><br/>
                  {Array.from(new Set(selectedPoints.map(p => p.cluster))).sort().map(c => (
                    <Badge key={c} variant="outline" className="mr-1 mb-1">
                      C{c}: {selectedPoints.filter(p => p.cluster === c).length}
                    </Badge>
                  ))}
                </div>
                <div>
                  <strong>Scale Settings:</strong><br/>
                  Current Scale: {scaleFactor[0].toFixed(1)}x<br/>
                  Zoom History: {zoomHistory.length} levels
                </div>
              </div>
            </div>
          )}

          {/* Plot Container */}
          <div 
            className="border border-gray-200 rounded overflow-hidden" 
            style={{ width: '100%', height: `${height}px` }}
          >
            <div
              ref={plotRef}
              className="w-full h-full"
              data-testid="interactive-zoom-space"
            />
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
            <strong>Instructions:</strong> 
            Use the Box Select tool to select a region → Click "Zoom In" to focus on the area → 
            Adjust "Scale Factor" slider to increase visual separation between points → 
            Use "Smart Scale" for automatic optimal scaling → Click cluster buttons for quick focus
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
