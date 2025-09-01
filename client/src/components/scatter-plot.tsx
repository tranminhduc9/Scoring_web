import { useEffect, useRef, useState } from "react";
import { useClusteringStore } from "@/lib/clustering-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Move, ZoomIn, Lasso, Maximize, ExternalLink, Download, FileImage } from "lucide-react";
import Plotly from "plotly.js-dist";

export default function ScatterPlot() {
  const { results, isRunning, selectedProjectionType } = useClusteringStore();
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);
  const [selectedClusters, setSelectedClusters] = useState<number[]>([]);
  const [activeTool, setActiveTool] = useState<"pan" | "zoom" | "lasso">("lasso");

  // Check if we should show projection image
  const shouldShowProjectionImage = (results as any)?.projectionImages && 
    selectedProjectionType && 
    (results as any).projectionImages[selectedProjectionType];

  // Render projection image view
  const renderProjectionImage = () => (
    <div className="flex-1 flex flex-col bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {selectedProjectionType.toUpperCase()} Projection
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = (results as any).projectionImages[selectedProjectionType];
                link.download = `${selectedProjectionType}_projection.png`;
                link.click();
              }}
              data-testid="download-projection-png"
            >
              <Download className="w-4 h-4 mr-2" />
              PNG
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="max-w-full max-h-full overflow-auto">
          <img 
            src={(results as any).projectionImages[selectedProjectionType]} 
            alt={`${selectedProjectionType} projection`}
            className="max-w-full max-h-full object-contain bg-white rounded-lg shadow-lg"
            onError={(e) => {
              console.error(`Failed to load ${selectedProjectionType} image:`, e);
            }}
          />
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!plotRef.current) return;

    // Transform API data for visualization
    let processedData;
    
    if (results?.clusterResult?.companies && Array.isArray(results.clusterResult.companies)) {
      // Process new API format with companies array
      processedData = [];
      let pointIndex = 0;
      
      results.clusterResult.companies.forEach((company: any) => {
        if (company.enterprise && Array.isArray(company.enterprise)) {
          company.enterprise.forEach((enterprise: any) => {
            const clusterLabel = enterprise.cluster || enterprise.Label || 0;
            const embedding = enterprise.embedding || [0, 0];
            
            // Calculate size as length of embedding vector excluding last 4 elements
            let calculatedSize = 0.1; // default minimum size
            if (enterprise.embedding && Array.isArray(enterprise.embedding) && enterprise.embedding.length > 4) {
              const embeddingSubset = enterprise.embedding.slice(0, -4); // exclude last 4 elements
              calculatedSize = Math.sqrt(embeddingSubset.reduce((sum: number, val: number) => sum + val * val, 0)); // vector length
              calculatedSize = Math.max(0.1, calculatedSize); // ensure minimum size
            }
            
            processedData.push({
              id: `company-${pointIndex}`,
              info: {
                name: enterprise.name || 'Unknown Company',
                taxcode: enterprise.taxcode || '',
                sector: enterprise.sector_name || '',
                sector_unique_id: enterprise.sector_unique_id || company.sector_unique_id || '',
                employees: enterprise.empl_qtty || 0
              },
              embedding: embedding,
              pca: {
                x: embedding[0],
                y: embedding[1],
                z: calculatedSize
              },
              cluster: clusterLabel
            });
            pointIndex++;
          });
        }
      });
    } else if (results?.clusterResult?.embedding && results?.clusterResult?.labels && results?.clusterResult?.size) {
      // Process legacy API format
      processedData = results.clusterResult.embedding.map((coords: number[], i: number) => ({
        id: `point-${i}`,
        info: {},
        embedding: coords,
        pca: {
          x: coords[0],
          y: coords[1],
          z: results.clusterResult.size![i] || 0
        },
        cluster: results.clusterResult.labels![i] || 0
      }));
    } else {
      // No data available
      processedData = [];
    }

    const dataPoints = processedData;
    
    console.log("🔍 Debug visualization data:");
    console.log("📊 Total dataPoints:", dataPoints.length);
    console.log("🏷️ All cluster values:", dataPoints.map(d => d.cluster));
    
    const clusters = Array.from(new Set(dataPoints.map(d => d.cluster).filter(c => c !== null && c !== undefined))).sort();
    console.log("🎯 Unique clusters found:", clusters);
    
    // Color palette for clusters
    const colors = [
      '#1976D2', '#4CAF50', '#F44336', '#FF9800', '#9C27B0', '#FF5722',
      '#607D8B', '#795548', '#E91E63', '#00BCD4', '#8BC34A', '#FFC107'
    ];

    // Create 3D mesh column traces for each cluster
    const traces: any[] = [];
    
    clusters.forEach((clusterId, index) => {
      const clusterPoints = dataPoints.filter(d => d.cluster === clusterId);
      const showCluster = selectedClusters.length === 0 || selectedClusters.includes(clusterId!);
      const clusterColor = colors[index % colors.length];
      
      console.log(`🎨 Cluster ${clusterId}: ${clusterPoints.length} points`);
      
      clusterPoints.forEach((point, pointIndex) => {
        const x = point.pca?.x || 0;
        const y = point.pca?.y || 0;
        const height = Math.max(0.1, (point.pca?.z || ((point as any).size || 0)) * 2);
        const columnWidth = 0.01; // 1px equivalent for compact visualization
        const w = columnWidth / 2;
        
        // Create detailed hover text with all company information
        const enterpriseName = point.info?.name || 'N/A';
        const sectorId = point.info?.sector_unique_id || 'N/A';
        const sectorName = point.info?.sector || 'N/A';
        const taxCode = point.info?.taxcode || 'N/A';
        const employees = point.info?.employees || 0;
        const size = point.pca?.z || 0;
        
        let hoverText = `<b>${enterpriseName}</b><br>`;
        hoverText += `Tọa độ: (${x.toFixed(3)}, ${y.toFixed(3)})<br>`;
        hoverText += `Kích thước quy mô: ${size.toFixed(2)}<br>`;
        hoverText += `Mã số thuế: ${taxCode}<br>`;
        hoverText += `Tên ngành: ${sectorName}<br>`;
        hoverText += `Sector ID: ${sectorId}<br>`;
        hoverText += `Số nhân viên: ${employees.toLocaleString()}`;
        
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
          opacity: showCluster ? 0.9 : 0.1,
          showlegend: pointIndex === 0,
          name: pointIndex === 0 ? `Cluster ${clusterId} (${clusterPoints.length})` : undefined,
          text: hoverText,
          hoverinfo: 'text',
          visible: showCluster,
          lighting: {
            ambient: 0.6,
            diffuse: 0.9,
            specular: 0.3,
            roughness: 0.1
          }
        });
      });
    });

    const layout = {
      title: {
        text: '3D Cluster Visualization',
        font: { size: 16 }
      },
      scene: {
        xaxis: {
          title: {
            text: 'Embedding X',
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
            text: 'Embedding Y',
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
            text: 'Size',
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
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        }
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white',
      margin: { l: 0, r: 0, t: 50, b: 0 },
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
      displayModeBar: false, // We'll use our own toolbar
      doubleClick: 'reset',
    };

    Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      setPlotReady(true);
    });

    // Set up tool interactions
    if (plotRef.current) {
      const plotDiv = plotRef.current as any;
      
      switch (activeTool) {
        case 'pan':
          Plotly.relayout(plotDiv, { 'scene.dragmode': 'pan' });
          break;
        case 'zoom':
          Plotly.relayout(plotDiv, { 'scene.dragmode': 'zoom' });
          break;
        case 'lasso':
          Plotly.relayout(plotDiv, { 'scene.dragmode': 'lasso' });
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
        filename: 'cluster-visualization'
      });
    }
  };

  const downloadPlotAsSVG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'svg',
        width: 1200,
        height: 800,
        filename: 'cluster-visualization'
      });
    }
  };

  // Render scatter plot view
  const renderScatterPlot = () => {
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

    if (!results || !results.dataPoints || results.dataPoints.length === 0) {
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
    return (
      <div className="flex-1 flex flex-col bg-card">
        {/* Toolbar */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Cluster Visualization</h2>
            
            <div className="flex items-center gap-2">
              {/* Cluster Filter */}
              <Select
                value={selectedClusters.length === 0 ? "all" : selectedClusters.join(",")}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedClusters([]);
                  } else {
                    setSelectedClusters(value.split(",").map(Number));
                  }
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter clusters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clusters</SelectItem>
                  {Array.from(new Set(results.dataPoints.map(d => d.cluster).filter(c => c !== null && c !== undefined))).sort().map(cluster => (
                    <SelectItem key={cluster} value={cluster!.toString()}>
                      Cluster {cluster}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tools */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant={activeTool === "pan" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("pan")}
              title="Pan"
              data-testid="tool-pan"
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "zoom" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("zoom")}
              title="Zoom"
              data-testid="tool-zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTool === "lasso" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTool("lasso")}
              title="Lasso Select"
              data-testid="tool-lasso"
            >
              <Lasso className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              title="Reset Zoom"
              data-testid="tool-reset"
            >
              <Maximize className="h-4 w-4" />
            </Button>
            
            {/* Download buttons */}
            <div className="border-l border-border pl-2 ml-2 flex items-center gap-1">
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
            </div>
          </div>
        </div>

        {/* Plot Container */}
        <Card className="flex-1 p-4">
          <div
            ref={plotRef}
            className="w-full h-full"
            data-testid="scatter-plot"
          />
        </Card>
      </div>
    );
  };

  // Return appropriate view based on state
  if (shouldShowProjectionImage) {
    return renderProjectionImage();
  }

  return renderScatterPlot();
}
