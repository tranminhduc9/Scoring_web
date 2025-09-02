
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

  // Improved color handling
  const getValidColor = (colorStr: string, alpha: number = 0.4): string => {
    try {
      // Ensure we have valid hex colors
      const colors = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
        '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
        '#16a085', '#27ae60', '#2980b9', '#8e44ad',
        '#2c3e50', '#f1c40f', '#e67e22', '#95a5a6',
        '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
        '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
      ];
      
      if (colorStr.startsWith('#')) {
        // Convert hex to rgba
        const hex = colorStr.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      
      // Fallback to default color
      return `rgba(52, 152, 219, ${alpha})`;
    } catch (e) {
      console.warn('Color conversion error:', e);
      return `rgba(52, 152, 219, ${alpha})`;
    }
  };

  // Improved Voronoi computation with better error handling
  const computeVoronoi = useCallback((points: IndustryDataPoint[]) => {
    if (!points || points.length < 3) {
      console.warn('Insufficient points for Voronoi diagram');
      return [];
    }

    try {
      // Validate points
      const validPoints = points.filter(p => 
        p && 
        typeof p.emb_x === 'number' && 
        typeof p.emb_y === 'number' && 
        !isNaN(p.emb_x) && 
        !isNaN(p.emb_y) &&
        isFinite(p.emb_x) && 
        isFinite(p.emb_y)
      );

      if (validPoints.length < 3) {
        console.warn('Insufficient valid points for Voronoi diagram');
        return [];
      }

      const sites = validPoints.map(p => [p.emb_x, p.emb_y]);
      
      // Find bounding box with padding
      const xValues = sites.map(s => s[0]);
      const yValues = sites.map(s => s[1]);
      const xMin = Math.min(...xValues) - 1;
      const xMax = Math.max(...xValues) + 1;
      const yMin = Math.min(...yValues) - 1;
      const yMax = Math.max(...yValues) + 1;

      const cells: VoronoiCell[] = [];
      const colors = [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
        '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
        '#16a085', '#27ae60', '#2980b9', '#8e44ad',
        '#2c3e50', '#f1c40f', '#e67e22', '#95a5a6',
        '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
        '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
      ];

      // Get unique labels for consistent coloring
      const uniqueLabels = Array.from(new Set(validPoints.map(d => d.labels || 'Unknown'))).sort();

      validPoints.forEach((point, index) => {
        try {
          // Create approximate Voronoi cell using nearest neighbors
          const cellVertices: [number, number][] = [];
          const numVertices = 16; // Increased for smoother cells
          
          // Calculate distances to all other points
          const distances = validPoints
            .map((p, idx) => ({
              distance: idx === index ? Infinity : Math.sqrt(
                Math.pow(p.emb_x - point.emb_x, 2) + 
                Math.pow(p.emb_y - point.emb_y, 2)
              ),
              index: idx
            }))
            .filter(d => d.distance !== Infinity)
            .sort((a, b) => a.distance - b.distance);
          
          // Use nearest neighbors to determine cell size
          const nearestDistance = distances.length > 0 ? distances[0].distance : 1;
          const baseRadius = Math.min(0.4, nearestDistance / 3); // Adaptive radius
          
          for (let i = 0; i < numVertices; i++) {
            const angle = (2 * Math.PI * i) / numVertices;
            
            // Variable radius based on nearby points
            let radius = baseRadius;
            const direction = [Math.cos(angle), Math.sin(angle)];
            
            // Check for nearby points in this direction
            for (const { distance } of distances.slice(0, 3)) {
              if (distance < baseRadius * 2) {
                radius = Math.min(radius, distance / 2.5);
              }
            }
            
            const x = point.emb_x + radius * direction[0];
            const y = point.emb_y + radius * direction[1];
            
            // Ensure vertices are within bounds
            const clampedX = Math.max(xMin, Math.min(xMax, x));
            const clampedY = Math.max(yMin, Math.min(yMax, y));
            
            cellVertices.push([clampedX, clampedY]);
          }

          // Determine color based on label
          const labelIndex = uniqueLabels.indexOf(point.labels || 'Unknown');
          const colorIndex = labelIndex >= 0 ? labelIndex : 0;
          
          cells.push({
            sector_code: point.sector_code || 'Unknown',
            field_name: point.field_name || 'Unknown',
            labels: point.labels || 'Unknown',
            x: point.emb_x,
            y: point.emb_y,
            color: colors[colorIndex % colors.length],
            vertices: cellVertices
          });
        } catch (cellError) {
          console.warn(`Error creating cell for point ${index}:`, cellError);
        }
      });

      console.log(`Generated ${cells.length} Voronoi cells from ${validPoints.length} points`);
      return cells;
    } catch (error) {
      console.error('Error computing Voronoi diagram:', error);
      return [];
    }
  }, []);

  // Improved data loading with better error handling
  useEffect(() => {
    const loadIndustryData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if file exists first
        const response = await fetch('/attached_assets/industry_data.csv');
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Industry data file not found. Please ensure industry_data.csv exists in attached_assets/');
          }
          throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        if (!csvText.trim()) {
          throw new Error('Industry data file is empty');
        }
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          quoteChar: '"',
          escapeChar: '"',
          transformHeader: (header) => header.trim().toLowerCase(),
          transform: (value, header) => {
            if (header === 'emb_x' || header === 'emb_y') {
              const num = parseFloat(value);
              return isNaN(num) ? 0 : num;
            }
            return value ? value.trim() : '';
          },
          complete: (results) => {
            try {
              if (results.errors && results.errors.length > 0) {
                console.warn('CSV parsing warnings:', results.errors);
              }
              
              const validData = results.data.filter((row: any) => {
                return row && 
                       row.sector_code && 
                       row.field_name && 
                       typeof row.emb_x === 'number' && 
                       typeof row.emb_y === 'number' &&
                       !isNaN(row.emb_x) && 
                       !isNaN(row.emb_y);
              }) as IndustryDataPoint[];
              
              if (validData.length === 0) {
                throw new Error('No valid data points found in CSV file');
              }
              
              console.log('Loaded industry data:', validData.length, 'valid points');
              setIndustryData(validData);
              
              // Compute Voronoi cells
              const cells = computeVoronoi(validData);
              if (cells.length === 0) {
                throw new Error('Failed to generate Voronoi cells');
              }
              
              setVoronoiCells(cells);
              setLoading(false);
            } catch (processingError) {
              console.error('Error processing CSV data:', processingError);
              setError(`Data processing error: ${processingError.message}`);
              setLoading(false);
            }
          },
          error: (parseError: any) => {
            console.error('Error parsing CSV:', parseError);
            setError(`CSV parsing error: ${parseError.message || 'Unknown parsing error'}`);
            setLoading(false);
          }
        });
      } catch (fetchError) {
        console.error('Error loading industry data:', fetchError);
        setError(`Loading error: ${fetchError.message}`);
        setLoading(false);
      }
    };

    loadIndustryData();
  }, [computeVoronoi]);

  // Improved sector highlighting
  useEffect(() => {
    if (!plotRef.current || !plotReady || !voronoiCells.length) return;

    try {
      if (selectedSectorCode) {
        const matchingCell = voronoiCells.find(cell => {
          if (!cell.sector_code) return false;
          const normalizedSelected = selectedSectorCode.toLowerCase().trim();
          const normalizedCell = cell.sector_code.toLowerCase().trim();
          return normalizedCell === normalizedSelected ||
                 normalizedCell === normalizedSelected.replace(/^[a-z]/, '') ||
                 normalizedCell.includes(normalizedSelected) ||
                 normalizedSelected.includes(normalizedCell);
        });
        
        if (matchingCell) {
          setHighlightedSector(matchingCell.sector_code);
          
          // Update plot with improved highlighting
          const shapes = voronoiCells.map(cell => ({
            type: 'path',
            path: `M ${cell.vertices.map(v => `${v[0]},${v[1]}`).join(' L ')} Z`,
            fillcolor: cell.sector_code === matchingCell.sector_code 
              ? getValidColor(cell.color, 0.8)
              : getValidColor(cell.color, 0.3),
            line: {
              color: cell.sector_code === matchingCell.sector_code ? '#FF0000' : '#666',
              width: cell.sector_code === matchingCell.sector_code ? 3 : 1
            }
          }));
          
          Plotly.relayout(plotRef.current, { shapes });
        }
      } else {
        setHighlightedSector(null);
        
        // Reset all highlights
        const shapes = voronoiCells.map(cell => ({
          type: 'path',
          path: `M ${cell.vertices.map(v => `${v[0]},${v[1]}`).join(' L ')} Z`,
          fillcolor: getValidColor(cell.color, 0.4),
          line: {
            color: '#666',
            width: 1
          }
        }));
        
        Plotly.relayout(plotRef.current, { shapes });
      }
    } catch (updateError) {
      console.warn('Error updating sector highlight:', updateError);
    }
  }, [selectedSectorCode, voronoiCells, plotReady]);

  // Improved click handling
  const handlePlotClick = useCallback((data: any) => {
    try {
      if (data.points && data.points.length > 0) {
        const point = data.points[0];
        const x = point.x;
        const y = point.y;
        
        // Find the closest cell to the click point
        let closestCell = null;
        let minDistance = Infinity;
        
        voronoiCells.forEach(cell => {
          const distance = Math.sqrt(
            Math.pow(cell.x - x, 2) + Math.pow(cell.y - y, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestCell = cell;
          }
        });
        
        if (closestCell && onSectorCodeChange) {
          onSectorCodeChange(closestCell.sector_code);
        }
      }
    } catch (clickError) {
      console.warn('Error handling plot click:', clickError);
    }
  }, [voronoiCells, onSectorCodeChange]);

  // Improved plot creation with better error handling
  useEffect(() => {
    if (!plotRef.current || !voronoiCells.length || loading) return;

    try {
      // Create Voronoi diagram shapes
      const shapes = voronoiCells.map(cell => ({
        type: 'path',
        path: `M ${cell.vertices.map(v => `${v[0]},${v[1]}`).join(' L ')} Z`,
        fillcolor: getValidColor(cell.color, 0.4),
        line: {
          color: '#666',
          width: 1
        }
      }));

      // Create invisible scatter points for interaction
      const trace = {
        x: voronoiCells.map(cell => cell.x),
        y: voronoiCells.map(cell => cell.y),
        mode: 'markers' as const,
        type: 'scatter' as const,
        marker: {
          color: 'transparent',
          size: 20,
          opacity: 0
        },
        text: voronoiCells.map(cell => 
          `<b>${cell.field_name}</b><br>` +
          `Code: ${cell.sector_code}<br>` +
          `Sector: ${cell.labels}<br>` +
          `Position: (${cell.x.toFixed(3)}, ${cell.y.toFixed(3)})`
        ),
        hovertemplate: '%{text}<extra></extra>',
        showlegend: false,
        name: 'Industry Sectors'
      };

      const layout = {
        title: {
          text: 'Industry Voronoi Diagram',
          font: { size: 18, color: '#333', family: 'Arial, sans-serif' }
        },
        xaxis: {
          title: 'Embedding X',
          gridcolor: '#f0f0f0',
          zerolinecolor: '#d0d0d0',
          showgrid: true,
          zeroline: true
        },
        yaxis: {
          title: 'Embedding Y',
          gridcolor: '#f0f0f0',
          zerolinecolor: '#d0d0d0',
          showgrid: true,
          zeroline: true
        },
        shapes: shapes,
        hovermode: 'closest',
        showlegend: false,
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        margin: { l: 60, r: 60, t: 80, b: 60 },
        dragmode: activeTool === 'pan' ? 'pan' : activeTool === 'zoom' ? 'zoom' : 'lasso',
        autosize: true
      };

      const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'zoom2d', 'select2d', 'lasso2d', 'autoScale2d'],
        displaylogo: false,
        responsive: true,
        doubleClick: 'reset+autosize'
      };

      // Clear existing plot and create new one
      Plotly.purge(plotRef.current);
      
      Plotly.newPlot(plotRef.current, [trace], layout, config).then(() => {
        setPlotReady(true);
        console.log('Voronoi plot rendered successfully with', voronoiCells.length, 'cells');
        
        // Add click event listener
        if (plotRef.current) {
          (plotRef.current as any).on('plotly_click', handlePlotClick);
        }
      }).catch((plotError) => {
        console.error('Error creating plot:', plotError);
        setError('Failed to render visualization');
      });

    } catch (renderError) {
      console.error('Error in plot rendering:', renderError);
      setError('Visualization rendering error');
    }

    // Cleanup function
    return () => {
      if (plotRef.current) {
        try {
          (plotRef.current as any).removeAllListeners?.('plotly_click');
          // Don't purge here as it can cause issues during component updates
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
    };

  }, [voronoiCells, loading, activeTool, handlePlotClick]);

  // Improved download functions with error handling
  const downloadPNG = () => {
    if (!plotRef.current || !plotReady) {
      console.warn('Plot not ready for download');
      return;
    }
    
    try {
      Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1200,
        height: 800,
        filename: 'industry_voronoi_diagram'
      }).catch(error => {
        console.error('Error downloading PNG:', error);
      });
    } catch (error) {
      console.error('PNG download error:', error);
    }
  };

  const downloadSVG = () => {
    if (!plotRef.current || !plotReady) {
      console.warn('Plot not ready for download');
      return;
    }
    
    try {
      Plotly.downloadImage(plotRef.current, {
        format: 'svg',
        width: 1200,
        height: 800,
        filename: 'industry_voronoi_diagram'
      }).catch(error => {
        console.error('Error downloading SVG:', error);
      });
    } catch (error) {
      console.error('SVG download error:', error);
    }
  };

  const regenerateVoronoi = () => {
    try {
      if (industryData.length > 0) {
        setLoading(true);
        const cells = computeVoronoi(industryData);
        setVoronoiCells(cells);
        setLoading(false);
        console.log('Voronoi diagram regenerated');
      } else {
        console.warn('No industry data available for regeneration');
      }
    } catch (error) {
      console.error('Error regenerating Voronoi:', error);
      setError('Failed to regenerate Voronoi diagram');
      setLoading(false);
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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (voronoiCells.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No Voronoi cells generated</p>
          <Button onClick={regenerateVoronoi}>
            Try Regenerating
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
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
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
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
        {highlightedSector && highlightedSector !== selectedSectorCode && (
          <span className="text-green-600 font-medium ml-2">
            Highlighted: {highlightedSector}
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
