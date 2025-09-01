import React, { useEffect, useRef, useState } from 'react';
import { ClusterResult } from '../../../shared/schema';
import Plotly from 'plotly.js-dist';
import { Button } from "@/components/ui/button";
import { Download, FileImage } from "lucide-react";

interface SimpleClusterVisualizationProps {
  clusterResult: ClusterResult;
  width?: number;
  height?: number;
}

interface DataPoint {
  x: number;
  y: number;
  cluster: number;
  size: number;
  index: number;
}

export default function SimpleClusterVisualization({ 
  clusterResult, 
  width = 800, 
  height = 600 
}: SimpleClusterVisualizationProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotReady, setPlotReady] = useState(false);

  if (!clusterResult.embedding || !clusterResult.size || !clusterResult.labels) {
    return (
      <div className="flex items-center justify-center h-64 border border-gray-200 rounded">
        <p className="text-gray-500">No visualization data available</p>
      </div>
    );
  }

  // Prepare data points
  const data: DataPoint[] = clusterResult.embedding.map((coords: number[], i: number) => ({
    x: coords[0],
    y: coords[1],
    cluster: clusterResult.labels![i] || 0,
    size: clusterResult.size![i] || 0,
    index: i
  }));

  const clusters = Array.from(new Set(data.map(d => d.cluster))).sort();
  
  // Color palette for clusters
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
  ];

  useEffect(() => {
    if (!plotRef.current || !data.length) return;

    // Create traces for each cluster
    const traces = clusters.map((clusterId, index) => {
      const clusterPoints = data.filter(d => d.cluster === clusterId);
      
      return {
        x: clusterPoints.map(d => d.x),
        y: clusterPoints.map(d => d.y),
        z: clusterPoints.map(d => d.size),
        mode: 'markers' as const,
        type: 'scatter3d' as const,
        name: `Cluster ${clusterId}`,
        marker: {
          color: colors[index % colors.length],
          size: 8,
          opacity: 0.8,
          line: {
            color: '#333',
            width: 1
          }
        },
        text: clusterPoints.map(d => 
          `Company ${d.index}<br>Cluster: ${d.cluster}<br>Size: ${d.size.toFixed(2)}<br>Position: (${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.size.toFixed(2)})`
        ),
        hovertemplate: '%{text}<extra></extra>',
      };
    });

    const layout = {
      title: {
        text: '3D Simple Cluster Visualization',
        font: { size: 16 }
      },
      scene: {
        xaxis: {
          title: 'Embedding X',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        yaxis: {
          title: 'Embedding Y',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        zaxis: {
          title: 'Size',
          showgrid: true,
          gridcolor: 'rgba(0,0,0,0.1)',
          zeroline: true,
          zerolinecolor: 'rgba(0,0,0,0.3)',
        },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        }
      },
      plot_bgcolor: 'white',
      paper_bgcolor: 'white',
      margin: { l: 60, r: 60, t: 60, b: 60 },
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: -0.1,
        yanchor: 'top'
      },
      width: width,
      height: height
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
    };

    Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
      setPlotReady(true);
    });

    return () => {
      if (plotRef.current) {
        Plotly.purge(plotRef.current);
      }
    };
  }, [data, width, height]);

  const downloadPlotAsPNG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'png',
        width: 1200,
        height: 800,
        filename: 'simple-cluster-visualization'
      });
    }
  };

  const downloadPlotAsSVG = () => {
    if (plotRef.current && plotReady) {
      Plotly.downloadImage(plotRef.current, {
        format: 'svg',
        width: 1200,
        height: 800,
        filename: 'simple-cluster-visualization'
      });
    }
  };

  return (
    <div className="cluster-visualization relative">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Simple Cluster Visualization</h3>
          <p className="text-sm text-gray-600">
            Node size = Company size • Node color = Cluster • Dataset: {clusterResult.dataset_id} • 
            Clusters: {clusterResult.best_k} • Samples: {clusterResult.n_samples}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPlotAsPNG}
            title="Download as PNG"
            data-testid="download-simple-png"
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
            data-testid="download-simple-svg"
            disabled={!plotReady}
          >
            <FileImage className="h-4 w-4 mr-1" />
            SVG
          </Button>
        </div>
      </div>
      
      <div
        ref={plotRef}
        className="border border-gray-200 rounded"
        style={{ width, height }}
      />
    </div>
  );
}
