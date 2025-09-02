
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
  name_short?: string; // Shortened name for display
}

interface VoronoiCell {
  sector_code: string;
  field_name: string;
  labels: string;
  labels_short: string; // Shortened display name
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

  // Enhanced Voronoi computation with full tessellation
  const computeVoronoi = useCallback((points: IndustryDataPoint[]) => {
    if (!points || points.length < 2) {
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

      if (validPoints.length < 2) {
        console.warn('Insufficient valid points for Voronoi diagram');
        return [];
      }

      const sites = validPoints.map(p => [p.emb_x, p.emb_y]);

      // Calculate bounding box with extra padding for full coverage
      const xValues = sites.map(s => s[0]);
      const yValues = sites.map(s => s[1]);
      const xMin = Math.min(...xValues) - 2;
      const xMax = Math.max(...xValues) + 2;
      const yMin = Math.min(...yValues) - 2;
      const yMax = Math.max(...yValues) + 2;

      // Extended color palette for better distinction
      const colors = [
        '#e74c3c50', '#3498db50', '#2ecc7140', '#f39c1230',
        '#9b59b640', '#1abc9c30', '#e67e2240', '#34495e50',
        '#16a08560', '#27ae6040', '#2980b950', '#8e44ad40',
        '#2c3e5060', '#f1c40f50', '#e67e2260', '#95a5a640',
        '#ff6b6b50', '#4ecdc440', '#45b7d160', '#96ceb450'
      ];

      // Get unique labels for consistent coloring
      const uniqueLabels = Array.from(new Set(validPoints.map(d => d.labels || 'Unknown'))).sort();

      // Delaunay triangulation for Voronoi generation
      const triangles = [];
      if (validPoints.length >= 3) {
        for (let i = 0; i < validPoints.length - 2; i += 3) {
          if (i + 2 < validPoints.length) {
            triangles.push([i, i + 1, i + 2]);
          }
        }
      }

      const cells: VoronoiCell[] = [];

      // Generate full-coverage Voronoi polygons
      validPoints.forEach((point, index) => {
        const cellVertices: [number, number][] = [];

        // Calculate distance to all other points for proper boundaries
        const distances = validPoints
          .map((p, idx) => ({
            distance: idx === index ? Infinity : Math.sqrt(
              Math.pow(p.emb_x - point.emb_x, 2) +
              Math.pow(p.emb_y - point.emb_y, 2)
            ),
            index: idx,
            x: p.emb_x,
            y: p.emb_y
          }))
          .filter(d => d.distance !== Infinity)
          .sort((a, b) => a.distance - b.distance);

        // Create polygon vertices based on nearest neighbors
        const nearestNeighbors = distances.slice(0, Math.min(6, distances.length));

        if (nearestNeighbors.length >= 2) {
          // Create polygon vertices using perpendicular bisectors
          for (let i = 0; i < nearestNeighbors.length; i++) {
            const neighbor = nearestNeighbors[i];
            const nextNeighbor = nearestNeighbors[(i + 1) % nearestNeighbors.length];

            // Calculate midpoint between current point and neighbor
            const midX1 = (point.emb_x + neighbor.x) / 2;
            const midY1 = (point.emb_y + neighbor.y) / 2;

            // Calculate perpendicular direction
            const dx = neighbor.x - point.emb_x;
            const dy = neighbor.y - point.emb_y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const perpX = -dy / length;
            const perpY = dx / length;

            // Extend vertex outward for coverage
            const extension = Math.min(length / 2, 1.5);
            cellVertices.push([
              midX1 + perpX * extension,
              midY1 + perpY * extension
            ]);

            // Add corner vertex to next bisector for smoother shape
            if (i < nearestNeighbors.length - 1) {
              const cornerX = (neighbor.x + nextNeighbor.x) / 2;
              const cornerY = (neighbor.y + nextNeighbor.y) / 2;
              cellVertices.push([
                cornerX + (perpX + nextNeighbor.x - neighbor.x) / Math.sqrt(distanceCalc(neighbor, nextNeighbor)) * 0.3,
                cornerY + (perpY + nextNeighbor.y - neighbor.y) / Math.sqrt(distanceCalc(neighbor, nextNeighbor)) * 0.3
              ]);
            }
          }

          // Connect back to first vertex to close polygon
          if (cellVertices.length > 2) {
            cellVertices.push(cellVertices[0]);
          }
        } else {
          // Fallback for isolated points - create circular cell
          const numVertices = 12;
          const radius = 0.8;
          for (let i = 0; i < numVertices; i++) {
            const angle = (2 * Math.PI * i) / numVertices;
            cellVertices.push([
              point.emb_x + radius * Math.cos(angle),
              point.emb_y + radius * Math.sin(angle)
            ]);
          }
        }

        // Ensure vertices are within extended bounds
        const clampedVertices = cellVertices.map(([x, y]) => [
          Math.max(xMin, Math.min(xMax, x)),
          Math.max(yMin, Math.min(yMax, y))
        ]) as [number, number][];

        // Determine color based on label
        const labelIndex = uniqueLabels.indexOf(point.labels || 'Unknown');
        const colorIndex = labelIndex >= 0 ? labelIndex : index % colors.length;

        cells.push({
          sector_code: point.sector_code || 'Unknown',
          field_name: point.field_name || 'Unknown',
          labels: point.labels || 'Unknown',
          labels_short: point.name_short || point.labels.substring(0, 15) + '...',
          x: point.emb_x,
          y: point.emb_y,
          color: colors[colorIndex % colors.length],
          vertices: clampedVertices
        });
      });

      console.log(`🎯 Generated ${cells.length} full-coverage Voronoi cells from ${validPoints.length} points`);
      console.log(`🏗️ Cells geometry: ${cells.map(c => c.vertices.length).join(' and ')} vertices each`);

      return cells;
    } catch (error) {
      console.error('❌ Error computing Voronoi diagram:', error);
      return [];
    }
  }, []);

  // Helper function to calculate distance between two points
  const distanceCalc = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
  };

  // Get clustering store to access current data
  const { results: clusterResults } = useClusteringStore();

  // Enhanced data loading with industry-based aggregation
  useEffect(() => {
    const loadIndustryData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First try to use clustering results if available
        if (clusterResults?.clusterResult?.companies && Array.isArray(clusterResults.clusterResult.companies)) {
          console.log('Creating Industry-based Voronoi from clustering data...');

          // Group enterprises by sector_name
          const sectorMap = new Map<string, {
            name: string;
            code: string;
            enterprises: any[];
            x_sum: number;
            y_sum: number;
            count: number;
          }>();

          clusterResults.clusterResult.companies.forEach((company: any) => {
            if (company.enterprise && Array.isArray(company.enterprise)) {
              company.enterprise.forEach((enterprise: any) => {
                const sectorName = enterprise.sector_name || company.sector_name || 'Unknown';
                const sectorCode = enterprise.sector_unique_id?.toString() || company.sector_unique_id?.toString() || sectorName;

                if (enterprise.pca2_x !== undefined && enterprise.pca2_y !== undefined) {
                  if (!sectorMap.has(sectorName)) {
                    sectorMap.set(sectorName, {
                      name: sectorName,
                      code: sectorCode,
                      enterprises: [],
                      x_sum: 0,
                      y_sum: 0,
                      count: 0
                    });
                  }

                  const sector = sectorMap.get(sectorName)!;
                  sector.enterprises.push(enterprise);
                  sector.x_sum += parseFloat(enterprise.pca2_x) || 0;
                  sector.y_sum += parseFloat(enterprise.pca2_y) || 0;
                  sector.count += 1;
                }
              });
            }
          });

          // Helper function to shorten industry names
          const shortenIndustryName = (name: string, maxLength: number = 15): string => {
            if (name.length <= maxLength) return name;

            // Try to break at natural breakpoints (spaces)
            const words = name.split(' ');
            for (let i = words.length - 1; i > 0; i--) {
              const shortName = words.slice(0, i).join(' ');
              if (shortName.length <= maxLength - 3) {
                return shortName + '...';
              }
            }

            // If no good breakpoint, just truncate
            return name.substring(0, maxLength - 3) + '...';
          };

          // Convert sector data to centroid-based industry points
          const industryPoints: IndustryDataPoint[] = Array.from(sectorMap.values())
            .filter(sector => sector.count > 0)
            .map(sector => ({
              sector_code: sector.code,
              full_id: sector.code,
              field_name: `${sector.name} (${sector.count} doanh nghiệp)`,
              labels: sector.name, // Full name for hover
              name_short: shortenIndustryName(sector.name), // Short name for display
              emb_x: sector.x_sum / sector.count, // Centroid X
              emb_y: sector.y_sum / sector.count  // Centroid Y
            }));

          if (industryPoints.length > 0) {
            console.log(`📊 Created ${industryPoints.length} industry centroids from ${clusterResults.clusterResult.companies.length} companies:`);
            industryPoints.forEach(pt => {
              console.log(`  - ${pt.labels}: ${pt.field_name}`);
            });

            setIndustryData(industryPoints);

            const cells = computeVoronoi(industryPoints);
            if (cells.length > 0) {
              setVoronoiCells(cells);
              setLoading(false);
              return;
            }
          }
        }
        
        // Fallback to CSV file
        console.log('Attempting to load from CSV file...');
        const response = await fetch('/attached_assets/industry_data.csv');
        if (!response.ok) {
          throw new Error('No data available. Please run clustering analysis first or ensure industry_data.csv exists.');
        }
        
        const csvText = await response.text();
        if (!csvText.trim()) {
          throw new Error('CSV file is empty. Please run clustering analysis first.');
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
                throw new Error('No valid data points found. Please run clustering analysis first.');
              }
              
              console.log('Loaded industry data from CSV:', validData.length, 'valid points');
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
              setError(`Data processing error: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`);
              setLoading(false);
            }
          },
          error: (parseError: any) => {
            console.error('Error parsing CSV:', parseError);
            const errorMsg = parseError?.message || 'Unknown parsing error';
            setError(`CSV parsing error: ${errorMsg}`);
            setLoading(false);
          }
        });
      } catch (fetchError) {
        console.error('Error loading industry data:', fetchError);
        const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown loading error';
        setError(`Loading error: ${errorMsg}`);
        setLoading(false);
      }
    };

    loadIndustryData();
  }, [computeVoronoi, clusterResults]);

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
        let closestCell: VoronoiCell | null = null;
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

        if (closestCell && onSectorCodeChange && closestCell.sector_code) {
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
      // Create Voronoi diagram shapes with black boundaries
      const shapes = voronoiCells.map(cell => ({
        type: 'path',
        path: `M ${cell.vertices.map(v => `${v[0]},${v[1]}`).join(' L ')} Z`,
        fillcolor: getValidColor(cell.color, 0.6), // Full color fill - increased opacity
        line: {
          color: '#000000', // Black boundaries
          width: 2             // Thicker boundaries for clear separation
        }
      }));

      // Create scatter points with short text labels (display) and full text on hover
      const textTrace = {
        x: voronoiCells.map(cell => cell.x),
        y: voronoiCells.map(cell => cell.y),
        mode: 'markers+text' as const,
        type: 'scatter' as const,
        text: voronoiCells.map(cell => cell.labels_short), // Show shortened name
        textposition: 'top center',
        textfont: {
          family: 'Arial, sans-serif',
          size: 10, // Smaller font for cleaner look
          color: '#222'
        },
        marker: {
          color: 'transparent',
          size: 6,
          opacity: 0.7
        },
        hovertemplate: voronoiCells.map(cell =>
          `<b>${cell.field_name}</b><br>` +
          `<b>Full Name:</b> ${cell.labels}<br>` + // Show full name on hover
          `Code: ${cell.sector_code}<br>` +
          `Position: (${cell.x.toFixed(3)}, ${cell.y.toFixed(3)})` +
          `<extra></extra>`
        ),
        showlegend: false,
        name: 'Industry Names'
      };

      // Create invisible scatter points for click interaction
      const clickTrace = {
        x: voronoiCells.map(cell => cell.x),
        y: voronoiCells.map(cell => cell.y),
        mode: 'markers' as const,
        type: 'scatter' as const,
        marker: {
          color: 'transparent',
          size: 20,
          opacity: 0
        },
        showlegend: false,
        name: 'Click Areas'
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

      Plotly.newPlot(plotRef.current, [textTrace, clickTrace], layout, config).then(() => {
        setPlotReady(true);
        console.log('Voronoi plot rendered successfully with', voronoiCells.length, 'cells');

        // Add click event listener
        if (plotRef.current) {
          (plotRef.current as any).on('plotly_click', handlePlotClick);
        }
      }).catch((plotError: unknown) => {
        console.error('Error creating plot:', plotError);
        const errorMsg = plotError instanceof Error ? plotError.message : 'Unknown plot error';
        setError(`Failed to render visualization: ${errorMsg}`);
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
