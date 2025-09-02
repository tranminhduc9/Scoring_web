
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileImage } from "lucide-react";
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
  vcsh?: number; // VCSH metric
  tttdm?: number; // TTTDM metric
  tts?: number; // TTS metric
  empl?: number; // EMPL metric
  marker_size?: number; // Calculated marker size
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedSector, setHighlightedSector] = useState<string | null>(null);

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
          console.log('Creating Industry Sector Groups from clustering data...');

          // Group ALL enterprises by sector_name (regardless of company)
          const sectorMap = new Map<string, {
            name: string;
            code: string;
            enterprises: any[];
            x_sum: number;
            y_sum: number;
            count: number;
            vcsh_sum: number;
            tttdm_sum: number;
            tts_sum: number;
            empl_sum: number;
          }>();

          // Collect ALL enterprises across all companies that have the same sector_name
          clusterResults.clusterResult.companies.forEach((company: any) => {
            if (company.enterprise && Array.isArray(company.enterprise)) {
              company.enterprise.forEach((enterprise: any) => {
                const sectorName = enterprise.sector_name || company.sector_name || 'Unknown';
                const sectorCode = enterprise.sector_unique_id?.toString() || company.sector_unique_id?.toString() || sectorName;

                // Only include enterprises with valid coordinates
                if (enterprise.pca2_x !== undefined && enterprise.pca2_y !== undefined) {
                  if (!sectorMap.has(sectorName)) {
                    sectorMap.set(sectorName, {
                      name: sectorName,
                      code: sectorCode,
                      enterprises: [],
                      x_sum: 0,
                      y_sum: 0,
                      count: 0,
                      vcsh_sum: 0,
                      tttdm_sum: 0,
                      tts_sum: 0,
                      empl_sum: 0
                    });
                  }

                  console.log(`Adding enterprise: ${enterprise.name || 'Unknown'} to sector: ${sectorName}`);
                  const sector = sectorMap.get(sectorName)!;
                  sector.enterprises.push(enterprise);
                  sector.x_sum += parseFloat(enterprise.pca2_x) || 0;
                  sector.y_sum += parseFloat(enterprise.pca2_y) || 0;
                  sector.vcsh_sum += parseFloat(enterprise.vcsh || 0) || 0;
                  sector.tttdm_sum += parseFloat(enterprise.tttdm || 0) || 0;
                  sector.tts_sum += parseFloat(enterprise.tts || 0) || 0;
                  sector.empl_sum += parseFloat(enterprise.empl || 0) || 0;
                  sector.count += 1;
                }
              });
            }
          });

          // Helper function to shorten industry names - more concise
          const shortenIndustryName = (name: string, maxLength: number = 12): string => {
            if (name.length <= maxLength) return name;

            // First, try common industry abbreviations
            const abbreviations = [
              ['Technology', 'Tech'],
              ['Manufacturing', 'Mfg'],
              ['Construction', 'Constr'],
              ['Financial', 'Fin'],
              ['Education', 'Edu'],
              ['Healthcare', 'Health'],
              ['Information', 'Info'],
              ['Services', 'Svc'],
              ['Development', 'Dev'],
              ['Engineering', 'Eng'],
              ['Management', 'Mgmt'],
              ['Transportation', 'Transport']
            ];

            let shortened = name;
            abbreviations.forEach(([full, abbr]) => {
              shortened = shortened.replace(new RegExp(full, 'gi'), abbr);
            });

            if (shortened.length <= maxLength) return shortened;

            // Try to break at natural breakpoints (spaces)
            const words = shortened.split(' ');
            for (let i = words.length - 1; i > 0; i--) {
              const shortName = words.slice(0, i).join(' ');
              if (shortName.length <= maxLength - 2) {
                return shortName + '..';
              }
            }

            // If no good breakpoint, just truncate with single character
            return shortened.substring(0, maxLength - 1) + '.';
          };

          // Convert sector data to centroid-based industry points
          const industryPoints: IndustryDataPoint[] = [];
          Array.from(sectorMap.values())
            .filter(sector => sector.count > 0)
            .forEach(sector => {
              // Calculate averages for metrics
              const avgVcsh = sector.vcsh_sum / sector.count;
              const avgTttdm = sector.tttdm_sum / sector.count;
              const avgTts = sector.tts_sum / sector.count;
              const avgEmpl = sector.empl_sum / sector.count;

              // Calculate marker size based on formula: 0.3*(VCSH+TTTDM+TTS) + 0.1*EMPL
              const markerSize = 0.3 * (avgVcsh + avgTttdm + avgTts) + 0.1 * avgEmpl;

              // Fallback: if no metrics available, use company count as size indicator
              const fallbackSize = Math.max(5, Math.min(20, sector.count * 0.8));
              const clampedSize = Math.max(5, Math.min(50, isNaN(markerSize) || markerSize <= 0 ? fallbackSize : markerSize));

              console.log(`${sector.name}: VCSH=${avgVcsh}, TTTDM=${avgTttdm}, TTS=${avgTts}, EMPL=${avgEmpl}, markerSize=${clampedSize}, fallback=${fallbackSize}`);

              industryPoints.push({
                sector_code: sector.code,
                full_id: sector.code,
                field_name: `${sector.name} (${sector.count} doanh nghiệp)`,
                labels: sector.name, // Full name for hover
                name_short: shortenIndustryName(sector.name), // Short name for display
                emb_x: sector.x_sum / sector.count, // Centroid X
                emb_y: sector.y_sum / sector.count,  // Centroid Y
                vcsh: avgVcsh,
                tttdm: avgTttdm,
                tts: avgTts,
                empl: avgEmpl,
                marker_size: clampedSize
              });
            });

          if (industryPoints.length > 0) {
            console.log(`📊 Created ${industryPoints.length} industry centroids from ${clusterResults.clusterResult.companies.length} companies:`);
            industryPoints.forEach(pt => {
              console.log(`  - ${pt.labels}: ${pt.field_name}`);
            });

            setIndustryData(industryPoints);
            setLoading(false);
            return;
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
  }, [clusterResults]);

  // Hover handler for 2D scatter plot - trigger sector selection on hover
  const handlePlotHover = useCallback((data: any) => {
    try {
      if (data.points && data.points.length > 0) {
        const point = data.points[0];
        const x = point.x;
        const y = point.y;

        // Find the closest point to the hover position
        let closestPoint: IndustryDataPoint | null = null;
        let minDistance = Infinity;

        for (const industryPoint of industryData) {
          const distance = Math.sqrt(
            Math.pow(industryPoint.emb_x - x, 2) + Math.pow(industryPoint.emb_y - y, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = industryPoint;
          }
        }

        if (closestPoint) {
          // Trigger sector code change if callback is provided
          if (onSectorCodeChange && closestPoint.sector_code) {
            onSectorCodeChange(closestPoint.sector_code);
          }
        }
      }
    } catch (hoverError) {
      console.warn('Error handling plot hover:', hoverError);
    }
  }, [industryData, onSectorCodeChange]);

  // Clear selection when mouse leaves a point
  const handlePlotUnhover = useCallback(() => {
    // Optionally clear sector code on unhover
    // if (onSectorCodeChange) {
    //   onSectorCodeChange("");
    // }
  }, []);

  // 2D Scatter Plot creation
  useEffect(() => {
    if (!plotRef.current || !industryData.length || loading) return;

    try {
      // Create color palette for different sector codes
      const uniqueSectorCodes = Array.from(new Set(industryData.map(d => d.sector_code)));
      const colorPalette = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
        '#00C887', '#FF7675', '#FDCB6E', '#E17055'
      ];

      const getSectorColor = (sectorCode: string) => {
        const index = uniqueSectorCodes.indexOf(sectorCode) % colorPalette.length;
        return colorPalette[index];
      };

      // Create scatter plot trace
      const scatterTrace = {
        x: industryData.map(point => point.emb_x),
        y: industryData.map(point => point.emb_y),
        mode: 'markers+text' as const,
        type: 'scatter' as const,
        text: industryData.map(point => point.name_short), // Shortened name on plot
        textposition: 'top right' as const,
        textfont: {
          family: 'Arial, sans-serif',
          size: 11,
          color: '#333'
        },
        marker: {
          color: industryData.map(point => getSectorColor(point.sector_code)),
          size: industryData.map(point => point.marker_size || 8),
          opacity: 0.8,
          line: {
            color: '#FFFFFF',
            width: 2
          }
        },
        hovertemplate:
          '<b>%{customdata}</b><br>' +
          'X: %{x:.3f}, Y: %{y:.3f}<br>' +
          '<extra></extra>',
        customdata: industryData.map(point => point.labels), // Full name for hover
        showlegend: false
      };

      const layout = {
        title: {
          text: 'Industry 2D Scatter Plot',
          font: { size: 20, color: '#333', family: 'Arial, sans-serif' },
          x: 0.5,
          xanchor: 'center'
        },
        xaxis: {
          title: {
            text: 'Embedding X',
            font: { size: 14 },
            standoff: 15
          },
          gridcolor: '#f0f0f0',
          zerolinecolor: '#d0d0d0',
          showgrid: true,
          zeroline: true,
          tickfont: { size: 12 }
        },
        yaxis: {
          title: {
            text: 'Embedding Y',
            font: { size: 14 },
            standoff: 15
          },
          gridcolor: '#f0f0f0',
          zerolinecolor: '#d0d0d0',
          showgrid: true,
          zeroline: true,
          tickfont: { size: 12 }
        },
        hovermode: 'closest',
        showlegend: false,
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        margin: { l: 70, r: 70, t: 80, b: 70 },
        autosize: true
      };

      const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['pan2d', 'zoom2d', 'select2d', 'lasso2d', 'autoScale2d'],
        displaylogo: false,
        responsive: true,
        doubleClick: 'autosize'
      };

      // Clear existing plot and create new scatter plot
      Plotly.purge(plotRef.current);

      Plotly.newPlot(plotRef.current, [scatterTrace], layout, config).then(() => {
        setPlotReady(true);
        console.log('2D Scatter plot rendered successfully with', industryData.length, 'industry points');

        // Add hover event listeners
        if (plotRef.current) {
          (plotRef.current as any).on('plotly_hover', handlePlotHover);
          (plotRef.current as any).on('plotly_unhover', handlePlotUnhover);
        }
      }).catch((plotError: any) => {
        console.error('Error creating scatter plot:', plotError);
        const errorMsg = plotError instanceof Error ? plotError.message : 'Unknown plot error';
        setError(`Failed to render 2D scatter plot: ${errorMsg}`);
      });

    } catch (renderError) {
        console.error('Error in scatter plot rendering:', renderError);
      setError('2D Scatter plot rendering error');
    }

    // Cleanup function
    return () => {
      if (plotRef.current) {
        try {
          (plotRef.current as any).removeAllListeners?.('plotly_hover');
          (plotRef.current as any).removeAllListeners?.('plotly_unhover');
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
    };

  }, [industryData, loading, handlePlotHover, handlePlotUnhover]);

  // Download functions for 2D scatter plot
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
        filename: 'industry_2d_scatter_plot'
      }).catch((error: any) => {
        console.error('Error downloading PNG:', error);
      });
    } catch (error: any) {
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
        filename: 'industry_2d_scatter_plot'
      }).catch((error: any) => {
        console.error('Error downloading SVG:', error);
      });
    } catch (error: any) {
      console.error('SVG download error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading industry data and creating 2D scatter plot...</p>
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

  if (industryData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No industry data available</p>
          <p className="text-sm text-muted-foreground mb-4">Please run clustering analysis first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Download Options */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPNG}
            disabled={!plotReady}
            data-testid="download-scatter-png"
          >
            <Download className="h-4 w-4 mr-1" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSVG}
            disabled={!plotReady}
            data-testid="download-scatter-svg"
          >
            <FileImage className="h-4 w-4 mr-1" />
            SVG
          </Button>
        </div>
      </div>

      {/* Chart Info */}
      <div className="text-sm text-muted-foreground">
        Displaying {industryData.length} industry sectors in 2D space.
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
        {" "}Hover over points to view details.
      </div>

      {/* Plot */}
      <div
        ref={plotRef}
        className="border border-gray-200 rounded"
        style={{ width: '100%', height: `${height}px` }}
        data-testid="scatter-plot"
      />
    </div>
  );
}
