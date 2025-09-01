import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileImage, Maximize, Move, ZoomIn, Lasso, Square } from "lucide-react";
import Papa from 'papaparse';

interface IndustryDataPoint {
  sector_code: string;
  full_id: string;
  field_name: string;
  labels: string;
  emb_x: number;
  emb_y: number;
}

interface IndustryScatterPlotProps {
  width?: number;
  height?: number;
}

export default function IndustryScatterPlot({ 
  width = 800, 
  height = 600 
}: IndustryScatterPlotProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [industryData, setIndustryData] = useState<IndustryDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"pan" | "zoom" | "lasso" | "select">("lasso");
  const [selectedArea, setSelectedArea] = useState<{xmin: number, xmax: number, ymin: number, ymax: number} | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load and parse industry data
  useEffect(() => {
    const loadIndustryData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/attached_assets/industry_data.csv');
        if (!response.ok) {
          throw new Error(`Failed to load data: ${response.statusText}`);
        }
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          quoteChar: '"',
          escapeChar: '"',
          transformHeader: (header) => header.trim(),
          transform: (value, header) => {
            if (header === 'emb_x' || header === 'emb_y') {
              return parseFloat(value);
            }
            return value;
          },
          complete: (results) => {
            if (results.errors.length > 0) {
              console.error('CSV parsing errors:', results.errors);
            }
            
            const validData = results.data.filter((row: any) => 
              row.sector_code && 
              row.field_name && 
              !isNaN(row.emb_x) && 
              !isNaN(row.emb_y)
            ) as IndustryDataPoint[];
            
            console.log('Loaded industry data:', validData.length, 'points');
            setIndustryData(validData);
            setLoading(false);
          },
          error: (error: any) => {
            console.error('Error parsing CSV:', error);
            setError('Failed to parse industry data');
            setLoading(false);
          }
        });
      } catch (err) {
        console.error('Error loading industry data:', err);
        setError('Failed to load industry data');
        setLoading(false);
      }
    };

    loadIndustryData();
  }, []);

  // Create plot when data is loaded
  useEffect(() => {
    if (!plotRef.current || !industryData.length || loading) return;

    // Group data by sector labels
    const sectors = Array.from(new Set(industryData.map(d => d.labels))).sort();
    
    // Color palette for different sectors
    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
      '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
      '#16a085', '#27ae60', '#2980b9', '#8e44ad',
      '#2c3e50', '#f1c40f', '#e67e22', '#95a5a6'
    ];

    // Create traces for each sector
    const traces = sectors.map((sectorLabel, index) => {
      const sectorPoints = industryData.filter(d => d.labels === sectorLabel);
      
      return {
        x: sectorPoints.map(d => d.emb_x),
        y: sectorPoints.map(d => d.emb_y),
        mode: 'markers' as const,
        type: 'scatter' as const,
        name: `Sector ${sectorLabel}`,
        marker: {
          color: colors[index % colors.length],
          size: 8,
          opacity: 0.7,
          line: {
            color: '#333',
            width: 1
          }
        },
        text: sectorPoints.map(d => 
          `${d.field_name}<br>Code: ${d.sector_code}<br>Sector: ${d.labels}<br>Position: (${d.emb_x.toFixed(3)}, ${d.emb_y.toFixed(3)})`
        ),
        hovertemplate: '%{text}<extra></extra>',
      };
    });

    const layout = {
      title: {
        text: 'Industry Sector Mapping',
        font: { size: 18, color: '#333' }
      },
      xaxis: {
        title: 'Embedding X',
        gridcolor: '#e0e0e0',
        zerolinecolor: '#bdbdbd',
      },
      yaxis: {
        title: 'Embedding Y',
        gridcolor: '#e0e0e0',
        zerolinecolor: '#bdbdbd',
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        x: 1,
        y: 1,
        xanchor: 'left',
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#333',
        borderwidth: 1
      },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      margin: { l: 60, r: 60, t: 80, b: 60 },
      dragmode: activeTool === 'pan' ? 'pan' : activeTool === 'zoom' ? 'zoom' : activeTool === 'select' ? 'select' : 'lasso'
    };

    const config = {
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'zoom2d', 'select2d', 'lasso2d'],
      displaylogo: false,
      responsive: true,
    };

    Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      setPlotReady(true);
      console.log('Industry plot rendered successfully');
      
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

    
    // Cleanup function
    return () => {
      if (plotRef.current) {
        try {
          (plotRef.current as any).removeAllListeners('plotly_selected');
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };

  }, [industryData, loading, activeTool]);

  // Download functions
  const downloadPNG = () => {
    if (!plotRef.current || !plotReady) return;
    Plotly.downloadImage(plotRef.current, {
      format: 'png',
      width: 1200,
      height: 800,
      filename: 'industry_sector_map'
    });
  };

  const downloadSVG = () => {
    if (!plotRef.current || !plotReady) return;
    Plotly.downloadImage(plotRef.current, {
      format: 'svg',
      width: 1200,
      height: 800,
      filename: 'industry_sector_map'
    });
  };

  const zoomToSelection = (area: {xmin: number, xmax: number, ymin: number, ymax: number}) => {
    if (!plotRef.current || !plotReady) return;
    
    const xRange = area.xmax - area.xmin;
    const yRange = area.ymax - area.ymin;
    const padding = 0.1;
    
    const update = {
      'xaxis.range': [area.xmin - xRange * padding, area.xmax + xRange * padding],
      'yaxis.range': [area.ymin - yRange * padding, area.ymax + yRange * padding],
    };
    
    Plotly.relayout(plotRef.current, update);
  };

  const resetZoom = () => {
    if (!plotRef.current || !plotReady) return;
    
    const update = {
      'xaxis.range': null,
      'yaxis.range': null,
    };
    
    Plotly.relayout(plotRef.current, update);
    setSelectedArea(null);
  };

  const scaleBetweenPoints = () => {
    if (!plotRef.current || !plotReady || !selectedArea) return;
    
    const pointsInArea = industryData.filter(point => 
      point.emb_x >= selectedArea.xmin && point.emb_x <= selectedArea.xmax &&
      point.emb_y >= selectedArea.ymin && point.emb_y <= selectedArea.ymax
    );
    
    if (pointsInArea.length === 0) return;

    let totalDistance = 0;
    let pairCount = 0;
    
    for (let i = 0; i < pointsInArea.length; i++) {
      for (let j = i + 1; j < pointsInArea.length; j++) {
        const distance = Math.sqrt(
          Math.pow(pointsInArea[i].emb_x - pointsInArea[j].emb_x, 2) + 
          Math.pow(pointsInArea[i].emb_y - pointsInArea[j].emb_y, 2)
        );
        totalDistance += distance;
        pairCount++;
      }
    }
    
    if (pairCount === 0) return;

    const avgDistance = totalDistance / pairCount;
    const scaleFactor = Math.max(2, Math.min(10, 1 / avgDistance));
    
    const centerX = (selectedArea.xmin + selectedArea.xmax) / 2;
    const centerY = (selectedArea.ymin + selectedArea.ymax) / 2;
    const rangeX = (selectedArea.xmax - selectedArea.xmin) / scaleFactor;
    const rangeY = (selectedArea.ymax - selectedArea.ymin) / scaleFactor;
    
    const update = {
      'xaxis.range': [centerX - rangeX/2, centerX + rangeX/2],
      'yaxis.range': [centerY - rangeY/2, centerY + rangeY/2],
    };
    
    Plotly.relayout(plotRef.current, update);
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
      setTimeout(() => {
        if (plotRef.current && (Plotly as any).Plots && (Plotly as any).Plots.resize) {
          try { (Plotly as any).Plots.resize(plotRef.current); } catch (e) { /* noop */ }
        }
      }, 200);
    } catch (err) {
      // ignore fullscreen errors
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-muted-foreground">Loading industry data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-red-500 mb-2">Error: {error}</p>
            <p className="text-muted-foreground">Please check that the industry data file is available.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4" ref={containerRef}>
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Industry Sector Visualization</span>
            <div className="flex items-center gap-2">
              {/* Tool Selection */}
              <div className="flex border rounded-md">
                <Button
                  variant={activeTool === "lasso" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("lasso")}
                  className="rounded-r-none"
                  data-testid="tool-lasso"
                >
                  <Lasso className="h-4 w-4" />
                </Button>
                <Button
                  variant={activeTool === "pan" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("pan")}
                  className="rounded-none border-l border-r"
                  data-testid="tool-pan"
                >
                  <Move className="h-4 w-4" />
                </Button>
                <Button
                  variant={activeTool === "zoom" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTool("zoom")}
                  className="rounded-none border-l border-r"
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

              {/* Download Options */}
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPNG}
                disabled={!plotReady}
                data-testid="download-industry-png"
              >
                <Download className="h-4 w-4 mr-1" />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSVG}
                disabled={!plotReady}
                data-testid="download-industry-svg"
              >
                <FileImage className="h-4 w-4 mr-1" />
                SVG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                data-testid="fullscreen-industry"
              >
                <Maximize className="h-4 w-4 mr-1" />
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Displaying {industryData.length} industry sectors across {Array.from(new Set(industryData.map(d => d.labels))).length} major categories.
            {selectedArea && (
              <span className="text-blue-600 font-medium ml-2">
                Vùng đã chọn: ({selectedArea.xmin.toFixed(2)}, {selectedArea.ymin.toFixed(2)}) to ({selectedArea.xmax.toFixed(2)}, {selectedArea.ymax.toFixed(2)})
              </span>
            )}
          </div>
          <div
            ref={plotRef}
            className="border border-gray-200 rounded"
            style={{ width: '100%', height: `${height}px` }}
            data-testid="industry-scatter-plot"
          />
        </CardContent>
      </Card>
    </div>
  );
}