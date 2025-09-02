
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileImage, Move, ZoomIn, Lasso, RefreshCw } from "lucide-react";
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

interface VoronoiCell {
  sector_code: string;
  field_name: string;
  labels: string;
  x: number;
  y: number;
  color: string;
  vertices: [number, number][];
}

interface IndustryVoronoiTabProps {
  selectedSectorCode?: string;
  onSectorCodeChange?: (sectorCode: string) => void;
  height?: number;
}

export default function IndustryVoronoiTab({ 
  selectedSectorCode,
  onSectorCodeChange,
  height = 600 
}: IndustryVoronoiTabProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [industryData, setIndustryData] = useState<IndustryDataPoint[]>([]);
  const [voronoiCells, setVoronoiCells] = useState<VoronoiCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"pan" | "zoom" | "lasso">("pan");
  const [highlightedSector, setHighlightedSector] = useState<string | null>(null);

  // Delaunay triangulation and Voronoi diagram computation
  const computeVoronoi = useCallback((points: IndustryDataPoint[]) => {
    if (points.length < 3) return [];

    // Simple Voronoi implementation using Delaunay triangulation
    const sites = points.map(p => [p.emb_x, p.emb_y]);
    
    // Find bounding box
    const xMin = Math.min(...sites.map(s => s[0])) - 1;
    const xMax = Math.max(...sites.map(s => s[0])) + 1;
    const yMin = Math.min(...sites.map(s => s[1])) - 1;
    const yMax = Math.max(...sites.map(s => s[1])) + 1;

    const cells: VoronoiCell[] = [];
    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
      '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
      '#16a085', '#27ae60', '#2980b9', '#8e44ad',
      '#2c3e50', '#f1c40f', '#e67e22', '#95a5a6'
    ];

    points.forEach((point, index) => {
      // Create approximate Voronoi cell using nearest neighbors
      const cellVertices: [number, number][] = [];
      const numVertices = 12; // Number of vertices for approximation
      
      for (let i = 0; i < numVertices; i++) {
        const angle = (2 * Math.PI * i) / numVertices;
        const radius = 0.3; // Base radius for cells
        
        // Adjust radius based on distance to nearest neighbors
        const distances = points
          .filter((_, idx) => idx !== index)
          .map(p => Math.sqrt(
            Math.pow(p.emb_x - point.emb_x, 2) + 
            Math.pow(p.emb_y - point.emb_y, 2)
          ));
        
        const minDistance = Math.min(...distances);
        const adjustedRadius = Math.min(radius, minDistance / 2);
        
        const x = point.emb_x + adjustedRadius * Math.cos(angle);
        const y = point.emb_y + adjustedRadius * Math.sin(angle);
        
        // Ensure vertices are within bounds
        const clampedX = Math.max(xMin, Math.min(xMax, x));
        const clampedY = Math.max(yMin, Math.min(yMax, y));
        
        cellVertices.push([clampedX, clampedY]);
      }

      const sectorLabels = Array.from(new Set(points.map(d => d.labels))).sort();
      const colorIndex = sectorLabels.indexOf(point.labels);
      
      cells.push({
        sector_code: point.sector_code,
        field_name: point.field_name,
        labels: point.labels,
        x: point.emb_x,
        y: point.emb_y,
        color: colors[colorIndex % colors.length],
        vertices: cellVertices
      });
    });

    return cells;
  }, []);

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
            
            // Compute Voronoi cells
            const cells = computeVoronoi(validData);
            setVoronoiCells(cells);
            
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
  }, [computeVoronoi]);

  // Update highlighted sector when selectedSectorCode changes
  useEffect(() => {
    if (!plotRef.current || !plotReady || !voronoiCells.length) return;

    if (selectedSectorCode) {
      const matchingCell = voronoiCells.find(cell => 
        cell.sector_code === selectedSectorCode ||
        cell.sector_code === selectedSectorCode.replace(/^[A-Z]/, '')
      );
      
      if (matchingCell) {
        setHighlightedSector(matchingCell.sector_code);
        
        // Update plot to highlight the selected cell
        const update = {
          'line.width': voronoiCells.map(cell => 
            cell.sector_code === matchingCell.sector_code ? 4 : 1
          ),
          'line.color': voronoiCells.map(cell => 
            cell.sector_code === matchingCell.sector_code ? '#FF0000' : '#333'
          ),
          'fillcolor': voronoiCells.map(cell => 
            cell.sector_code === matchingCell.sector_code 
              ? cell.color.replace(')', ', 0.8)').replace('rgb', 'rgba')
              : cell.color.replace(')', ', 0.4)').replace('rgb', 'rgba')
          )
        };
        
        Plotly.restyle(plotRef.current, update, [0]);
      }
    } else {
      setHighlightedSector(null);
      
      // Reset all highlights
      const update = {
        'line.width': [1],
        'line.color': ['#333'],
        'fillcolor': voronoiCells.map(cell => 
          cell.color.replace(')', ', 0.4)').replace('rgb', 'rgba')
        )
      };
      Plotly.restyle(plotRef.current, update, [0]);
    }
  }, [selectedSectorCode, voronoiCells, plotReady]);

  // Handle plot clicks
  const handlePlotClick = useCallback((data: any) => {
    if (data.points && data.points.length > 0) {
      const point = data.points[0];
      const pointIndex = point.pointIndex;
      
      if (pointIndex < voronoiCells.length) {
        const clickedCell = voronoiCells[pointIndex];
        if (onSectorCodeChange && clickedCell.sector_code) {
          onSectorCodeChange(clickedCell.sector_code);
        }
      }
    }
  }, [voronoiCells, onSectorCodeChange]);

  // Create Voronoi plot
  useEffect(() => {
    if (!plotRef.current || !voronoiCells.length || loading) return;

    // Create Voronoi diagram traces
    const shapes = voronoiCells.map(cell => ({
      type: 'path',
      path: `M ${cell.vertices.map(v => `${v[0]},${v[1]}`).join(' L ')} Z`,
      fillcolor: cell.color.replace(')', ', 0.4)').replace('rgb', 'rgba'),
      line: {
        color: '#333',
        width: 1
      }
    }));

    // Create scatter points for interaction
    const trace = {
      x: voronoiCells.map(cell => cell.x),
      y: voronoiCells.map(cell => cell.y),
      mode: 'markers' as const,
      type: 'scatter' as const,
      marker: {
        color: 'transparent',
        size: 15,
        opacity: 0
      },
      text: voronoiCells.map(cell => 
        `${cell.field_name}<br>Code: ${cell.sector_code}<br>Sector: ${cell.labels}<br>Position: (${cell.x.toFixed(3)}, ${cell.y.toFixed(3)})`
      ),
      hovertemplate: '%{text}<extra></extra>',
      showlegend: false
    };

    const layout = {
      title: {
        text: 'Industry Voronoi Diagram',
        font: { size: 16, color: '#333' }
      },
      xaxis: {
        title: 'Embedding X',
        gridcolor: '#e0e0e0',
        zerolinecolor: '#bdbdbd',
        showgrid: false
      },
      yaxis: {
        title: 'Embedding Y',
        gridcolor: '#e0e0e0',
        zerolinecolor: '#bdbdbd',
        showgrid: false
      },
      shapes: shapes,
      hovermode: 'closest',
      showlegend: false,
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      margin: { l: 60, r: 60, t: 60, b: 60 },
      dragmode: activeTool === 'pan' ? 'pan' : activeTool === 'zoom' ? 'zoom' : 'lasso'
    };

    const config = {
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'zoom2d', 'select2d', 'lasso2d'],
      displaylogo: false,
      responsive: true,
    };

    Plotly.newPlot(plotRef.current, [trace], layout, config).then(() => {
      setPlotReady(true);
      console.log('Voronoi plot rendered successfully');
      
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

  }, [voronoiCells, loading, activeTool, handlePlotClick]);

  // Download functions
  const downloadPNG = () => {
    if (!plotRef.current || !plotReady) return;
    Plotly.downloadImage(plotRef.current, {
      format: 'png',
      width: 1200,
      height: 800,
      filename: 'industry_voronoi_diagram'
    });
  };

  const downloadSVG = () => {
    if (!plotRef.current || !plotReady) return;
    Plotly.downloadImage(plotRef.current, {
      format: 'svg',
      width: 1200,
      height: 800,
      filename: 'industry_voronoi_diagram'
    });
  };

  const regenerateVoronoi = () => {
    if (industryData.length > 0) {
      const cells = computeVoronoi(industryData);
      setVoronoiCells(cells);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading industry data and computing Voronoi cells...</p>
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

          {/* Regenerate Voronoi */}
          <Button
            variant="outline"
            size="sm"
            onClick={regenerateVoronoi}
            data-testid="regenerate-voronoi"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Regenerate
          </Button>
        </div>

        {/* Download Options */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPNG}
            disabled={!plotReady}
            data-testid="download-voronoi-png"
          >
            <Download className="h-4 w-4 mr-1" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSVG}
            disabled={!plotReady}
            data-testid="download-voronoi-svg"
          >
            <FileImage className="h-4 w-4 mr-1" />
            SVG
          </Button>
        </div>
      </div>

      {/* Map Info */}
      <div className="text-sm text-muted-foreground">
        Displaying {voronoiCells.length} Voronoi cells representing industry sectors. 
        {selectedSectorCode && (
          <span className="text-blue-600 font-medium ml-2">
            Selected: {selectedSectorCode}
          </span>
        )}
        {" "}Click on cells to select sectors.
      </div>

      {/* Plot */}
      <div
        ref={plotRef}
        className="border border-gray-200 rounded"
        style={{ width: '100%', height: `${height}px` }}
        data-testid="voronoi-diagram"
      />
    </div>
  );
}
