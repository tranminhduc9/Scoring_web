
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileImage, Maximize } from "lucide-react";
import { useClusteringStore } from "@/lib/clustering-store";

interface VoronoiDataPoint {
  x: number;
  y: number;
  sector_name: string;
  sector_unique_id: string;
  enterprise_name: string;
  taxcode: string;
  employees: number;
  color: string;
}

interface IndustryVoronoiDiagramProps {
  height?: number;
}

export default function IndustryVoronoiDiagram({ height = 600 }: IndustryVoronoiDiagramProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [voronoiData, setVoronoiData] = useState<VoronoiDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { results: clusterResults } = useClusteringStore();

  // Vibrant color palette similar to the image
  const colorPalette = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', 
    '#54A0FF', '#5F27CD', '#00C887', '#FF7675', '#FDCB6E', '#E17055',
    '#A29BFE', '#6C5CE7', '#FD79A8', '#FDCB6E', '#55A3FF', '#00B894',
    '#E84393', '#00CEC9', '#FDCB6E', '#FF7675', '#74B9FF', '#A29BFE',
    '#FF6B9D', '#C44569', '#F8B500', '#3B3B98', '#1B9CFC', '#55A3FF',
    '#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#795548',
    '#607D8B', '#E91E63', '#009688', '#FF5722', '#8BC34A', '#CDDC39',
    '#FFC107', '#FF9800', '#F44336', '#3F51B5', '#2196F3', '#00BCD4'
  ];

  // Load and process data
  useEffect(() => {
    const loadVoronoiData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (clusterResults?.clusterResult?.companies && Array.isArray(clusterResults.clusterResult.companies)) {
          console.log('Creating Voronoi data from clustering results...');

          // Collect all enterprises with their sector information
          const enterprises: VoronoiDataPoint[] = [];
          const sectorColorMap = new Map<string, string>();
          let colorIndex = 0;

          clusterResults.clusterResult.companies.forEach((company: any) => {
            if (company.enterprise && Array.isArray(company.enterprise)) {
              company.enterprise.forEach((enterprise: any) => {
                const sectorName = enterprise.sector_name || company.sector_name || 'Unknown';
                const sectorUniqueId = enterprise.sector_unique_id?.toString() || 
                                     company.sector_unique_id?.toString() || 
                                     sectorName;

                // Assign consistent color to each sector
                if (!sectorColorMap.has(sectorName)) {
                  sectorColorMap.set(sectorName, colorPalette[colorIndex % colorPalette.length]);
                  colorIndex++;
                }

                // Only include enterprises with valid coordinates
                if (enterprise.pca2_x !== undefined && 
                    enterprise.pca2_y !== undefined &&
                    !isNaN(enterprise.pca2_x) && 
                    !isNaN(enterprise.pca2_y)) {
                  
                  enterprises.push({
                    x: parseFloat(enterprise.pca2_x),
                    y: parseFloat(enterprise.pca2_y),
                    sector_name: sectorName,
                    sector_unique_id: sectorUniqueId,
                    enterprise_name: enterprise.name || 'Unknown Enterprise',
                    taxcode: enterprise.taxcode || '',
                    employees: parseInt(enterprise.empl_qtty || 0),
                    color: sectorColorMap.get(sectorName)!
                  });
                }
              });
            }
          });

          if (enterprises.length > 0) {
            console.log(`📊 Created Voronoi data with ${enterprises.length} enterprises across ${sectorColorMap.size} sectors`);
            setVoronoiData(enterprises);
          } else {
            throw new Error('No valid enterprise data found for Voronoi diagram');
          }
        } else {
          throw new Error('No clustering results available. Please run clustering analysis first.');
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading Voronoi data:', err);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(`Loading error: ${errorMsg}`);
        setLoading(false);
      }
    };

    loadVoronoiData();
  }, [clusterResults]);

  // Create Voronoi diagram
  useEffect(() => {
    if (!plotRef.current || !voronoiData.length || loading) return;

    try {
      // Group data by sector for creating separate traces
      const sectorGroups = new Map<string, VoronoiDataPoint[]>();
      voronoiData.forEach(point => {
        if (!sectorGroups.has(point.sector_name)) {
          sectorGroups.set(point.sector_name, []);
        }
        sectorGroups.get(point.sector_name)!.push(point);
      });

      // Create traces for each sector
      const traces: any[] = [];
      
      Array.from(sectorGroups.entries()).forEach(([sectorName, points]) => {
        // Create scatter trace for each sector
        traces.push({
          x: points.map(p => p.x),
          y: points.map(p => p.y),
          mode: 'markers',
          type: 'scatter',
          name: sectorName,
          marker: {
            color: points[0].color,
            size: 12,
            opacity: 0.8,
            line: {
              color: 'white',
              width: 2
            }
          },
          text: points.map(p => 
            `${p.enterprise_name}<br>` +
            `Sector: ${p.sector_name}<br>` +
            `Tax Code: ${p.taxcode}<br>` +
            `Employees: ${p.employees}<br>` +
            `Position: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`
          ),
          hovertemplate: '%{text}<extra></extra>',
          showlegend: true
        });
      });

      // Calculate bounds for Voronoi mesh
      const allX = voronoiData.map(p => p.x);
      const allY = voronoiData.map(p => p.y);
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);
      
      // Add padding
      const padX = (maxX - minX) * 0.2;
      const padY = (maxY - minY) * 0.2;
      const boundedMinX = minX - padX;
      const boundedMaxX = maxX + padX;
      const boundedMinY = minY - padY;
      const boundedMaxY = maxY + padY;

      // Create Voronoi-like visualization using contour plots
      // We'll create a background contour that approximates Voronoi cells
      const gridSize = 100;
      const xStep = (boundedMaxX - boundedMinX) / gridSize;
      const yStep = (boundedMaxY - boundedMinY) / gridSize;
      
      const zData: number[][] = [];
      const colorData: string[][] = [];

      for (let i = 0; i <= gridSize; i++) {
        const row: number[] = [];
        const colorRow: string[] = [];
        const y = boundedMinY + i * yStep;
        
        for (let j = 0; j <= gridSize; j++) {
          const x = boundedMinX + j * xStep;
          
          // Find closest sector point
          let closestPoint = voronoiData[0];
          let minDistance = Infinity;
          
          voronoiData.forEach(point => {
            const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
            if (distance < minDistance) {
              minDistance = distance;
              closestPoint = point;
            }
          });
          
          // Use sector index as z-value for coloring
          const sectorIndex = Array.from(sectorGroups.keys()).indexOf(closestPoint.sector_name);
          row.push(sectorIndex);
          colorRow.push(closestPoint.color);
        }
        zData.push(row);
        colorData.push(colorRow);
      }

      // Create custom colorscale based on our sectors
      const uniqueSectors = Array.from(sectorGroups.keys());
      const colorscale: [number, string][] = uniqueSectors.map((sectorName, index) => {
        const point = sectorGroups.get(sectorName)![0];
        return [index / (uniqueSectors.length - 1), point.color];
      });

      // Add Voronoi background using heatmap
      const voronoiTrace = {
        x: Array.from({ length: gridSize + 1 }, (_, i) => boundedMinX + i * xStep),
        y: Array.from({ length: gridSize + 1 }, (_, i) => boundedMinY + i * yStep),
        z: zData,
        type: 'heatmap',
        colorscale: colorscale,
        showscale: false,
        hoverinfo: 'skip',
        opacity: 0.7
      };

      // Add the heatmap first, then scatter points
      const allTraces = [voronoiTrace, ...traces];

      const layout = {
        title: {
          text: 'Voronoi Diagram - Industry Sectors',
          font: { size: 20, color: '#333', family: 'Arial, sans-serif' },
          x: 0.5,
          xanchor: 'center'
        },
        xaxis: {
          title: {
            text: 'PCA Dimension 1',
            font: { size: 14 }
          },
          range: [boundedMinX, boundedMaxX],
          showgrid: false,
          zeroline: false
        },
        yaxis: {
          title: {
            text: 'PCA Dimension 2',
            font: { size: 14 }
          },
          range: [boundedMinY, boundedMaxY],
          showgrid: false,
          zeroline: false
        },
        hovermode: 'closest',
        showlegend: true,
        legend: {
          x: 1.02,
          y: 1,
          xanchor: 'left',
          bgcolor: 'rgba(255,255,255,0.9)',
          bordercolor: '#333',
          borderwidth: 1,
          font: { size: 10 }
        },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        margin: { l: 60, r: 200, t: 80, b: 60 },
        autosize: true
      };

      const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'zoom2d', 'select2d', 'lasso2d'],
        displaylogo: false,
        responsive: true
      };

      // Clear existing plot and create new one
      Plotly.purge(plotRef.current);
      
      Plotly.newPlot(plotRef.current, allTraces, layout, config).then(() => {
        setPlotReady(true);
        console.log('Voronoi diagram rendered successfully with', voronoiData.length, 'enterprise points');
      }).catch((plotError: any) => {
        console.error('Error creating Voronoi diagram:', plotError);
        setError(`Failed to render Voronoi diagram: ${plotError.message || 'Unknown plot error'}`);
      });

    } catch (renderError) {
      console.error('Error in Voronoi diagram rendering:', renderError);
      setError('Voronoi diagram rendering error');
    }
  }, [voronoiData, loading]);

  // Download functions
  const downloadPNG = () => {
    if (!plotRef.current || !plotReady) return;
    Plotly.downloadImage(plotRef.current, {
      format: 'png',
      width: 1400,
      height: 800,
      filename: 'industry_voronoi_diagram'
    });
  };

  const downloadSVG = () => {
    if (!plotRef.current || !plotReady) return;
    Plotly.downloadImage(plotRef.current, {
      format: 'svg',
      width: 1400,
      height: 800,
      filename: 'industry_voronoi_diagram'
    });
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
      console.warn('Fullscreen error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-muted-foreground">Creating Voronoi diagram...</p>
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

  if (voronoiData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No enterprise data available</p>
          <p className="text-sm text-muted-foreground">Please run clustering analysis first.</p>
        </div>
      </div>
    );
  }

  const uniqueSectors = Array.from(new Set(voronoiData.map(d => d.sector_name)));

  return (
    <div className="w-full space-y-4" ref={containerRef}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Voronoi Diagram - Industry Sectors</span>
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
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                data-testid="fullscreen-voronoi"
              >
                <Maximize className="h-4 w-4 mr-1" />
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Displaying {voronoiData.length} enterprises across {uniqueSectors.length} industry sectors. 
            Each colored polygon represents the territory of an industry sector in the embedding space.
          </div>
          <div
            ref={plotRef}
            className="border border-gray-200 rounded"
            style={{ width: '100%', height: `${height}px` }}
            data-testid="voronoi-diagram"
          />
        </CardContent>
      </Card>
    </div>
  );
}
