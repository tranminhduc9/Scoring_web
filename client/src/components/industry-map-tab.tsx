import React, { useEffect, useRef, useState, useCallback } from 'react';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileImage, Move, ZoomIn, Lasso } from "lucide-react";
import Papa from 'papaparse';
import { useClusteringStore } from "@/lib/clustering-store";

interface IndustryDataPoint {
  sector_code: string;
  full_id: string;
  field_name: string;
  labels: string;
  emb_x: number;
  emb_y: number;
}

interface IndustryMapTabProps {
  selectedSectorCode?: string;
  onSectorCodeChange?: (sectorCode: string) => void;
  height?: number;
}

export default function IndustryMapTab({ 
  selectedSectorCode,
  onSectorCodeChange,
  height = 600 
}: IndustryMapTabProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [industryData, setIndustryData] = useState<IndustryDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"pan" | "zoom" | "lasso">("lasso");
  const [highlightedSector, setHighlightedSector] = useState<string | null>(null);

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

  // Update highlighted sector when selectedSectorCode changes
  useEffect(() => {
    if (!plotRef.current || !plotReady || !industryData.length) return;

    if (selectedSectorCode && industryData.length > 0) {
      // Find matching sector in the data - handle different code formats
      const matchingSector = industryData.find(item => {
        // Direct match
        if (item.sector_code === selectedSectorCode || item.full_id === selectedSectorCode) {
          return true;
        }
        
        // Handle API code format (e.g., "A1110" -> "1110")
        const codeWithoutPrefix = selectedSectorCode.replace(/^[A-Z]/, '');
        if (item.sector_code === codeWithoutPrefix) {
          return true;
        }
        
        // Handle reverse format (e.g., "1110" -> sector with code "1110")
        return item.sector_code === selectedSectorCode;
      });
      
      if (matchingSector) {
        setHighlightedSector(matchingSector.sector_code);
        
        // Highlight the specific point
        const sectorPoint = matchingSector;
        const sectorLabel = sectorPoint.labels;
        const sectors = Array.from(new Set(industryData.map(d => d.labels))).sort();
        const traceIndex = sectors.indexOf(sectorLabel);
        
        if (traceIndex !== -1) {
          const sectorPoints = industryData.filter(d => d.labels === sectorLabel);
          const pointIndex = sectorPoints.findIndex(p => p.sector_code === matchingSector.sector_code);
          
          if (pointIndex !== -1) {
            // Highlight the specific point
            const update = {
              'marker.size': [sectorPoints.map((_, i) => i === pointIndex ? 15 : 8)],
              'marker.line.width': [sectorPoints.map((_, i) => i === pointIndex ? 3 : 1)],
              'marker.line.color': [sectorPoints.map((_, i) => i === pointIndex ? '#FF6B6B' : '#333')]
            };
            
            Plotly.restyle(plotRef.current, update, [traceIndex]);
          }
        }
      }
    } else {
      setHighlightedSector(null);
      
      // Reset all highlights
      const sectors = Array.from(new Set(industryData.map(d => d.labels))).sort();
      sectors.forEach((_, traceIndex) => {
        const update = {
          'marker.size': [8],
          'marker.line.width': [1],
          'marker.line.color': ['#333']
        };
        Plotly.restyle(plotRef.current, update, [traceIndex]);
      });
    }
  }, [selectedSectorCode, industryData, plotReady]);

  // Handle plot clicks
  const handlePlotClick = useCallback((data: any) => {
    if (data.points && data.points.length > 0) {
      const point = data.points[0];
      const traceIndex = point.curveNumber;
      const pointIndex = point.pointIndex;
      
      // Find the corresponding sector
      const sectors = Array.from(new Set(industryData.map(d => d.labels))).sort();
      const sectorLabel = sectors[traceIndex];
      const sectorPoints = industryData.filter(d => d.labels === sectorLabel);
      
      if (pointIndex < sectorPoints.length) {
        const clickedSector = sectorPoints[pointIndex];
        if (onSectorCodeChange && clickedSector.sector_code) {
          onSectorCodeChange(clickedSector.sector_code);
        }
      }
    }
  }, [industryData, onSectorCodeChange]);

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
        customdata: sectorPoints.map(d => d.sector_code), // Store sector codes for click handling
      };
    });

    const layout = {
      title: {
        text: 'Industry Sector Map',
        font: { size: 16, color: '#333' }
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
        borderwidth: 1,
        font: { size: 10 }
      },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      margin: { l: 60, r: 120, t: 60, b: 60 },
      dragmode: activeTool === 'pan' ? 'pan' : activeTool === 'zoom' ? 'zoom' : 'lasso'
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
      
      // Add click event listener
      if (plotRef.current) {
        (plotRef.current as any).on('plotly_click', handlePlotClick);
      }
    });

    // Cleanup function
    return () => {
      if (plotRef.current) {
        try {
          (plotRef.current as any).removeAllListeners('plotly_click');
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };

  }, [industryData, loading, activeTool, handlePlotClick]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading industry data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error: {error}</p>
          <p className="text-muted-foreground">Please check that the industry data file is available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
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
              className="rounded-l-none"
              data-testid="tool-zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Download Options */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Map Info */}
      <div className="text-sm text-muted-foreground">
        Displaying {industryData.length} industry sectors. 
        {selectedSectorCode && (
          <span className="text-blue-600 font-medium ml-2">
            Selected: {selectedSectorCode}
          </span>
        )}
        {" "}Click on points to select sectors.
      </div>

      {/* Plot */}
      <div
        ref={plotRef}
        className="border border-gray-200 rounded"
        style={{ width: '100%', height: `${height}px` }}
        data-testid="industry-scatter-plot"
      />
    </div>
  );
}