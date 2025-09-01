import { useClusteringStore } from "../lib/clustering-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, ExternalLink } from "lucide-react";
import SimpleClusterVisualization from "./simple-cluster-visualization";

export default function ResultsPanel() {
  const { results, logs, setSelectedProjectionType } = useClusteringStore();

  if (!results) {
    return (
      <div className="w-full h-full bg-card p-4 overflow-hidden">
        <h3 className="text-lg font-semibold text-foreground mb-4">Analysis Results</h3>
        <div className="text-center text-muted-foreground">
          <div className="mb-3">📈</div>
          <p className="text-sm">Run clustering analysis to see results</p>
        </div>
      </div>
    );
  }

  const clusters = results.metrics?.clusters || [];

  return (
    <div className="w-full h-full bg-card flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Analysis Results</h3>
          
          {/* Metrics Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Clustering Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Best k:</span>
                <Badge variant="secondary" data-testid="metric-best-k">
                  {results.clusterResult?.best_k || 'N/A'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Silhouette Score:</span>
                <span className="font-medium" data-testid="metric-silhouette">
                  {results.metrics?.silhouetteScore?.toFixed(3) || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inertia:</span>
                <span className="font-medium" data-testid="metric-inertia">
                  {results.metrics?.inertia?.toFixed(2) || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lambda used:</span>
                <span className="font-medium" data-testid="metric-lambda">
                  {results.clusterResult?.lambda || 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Cluster Visualization */}
          {results.clusterResult && results.clusterResult.embedding && results.clusterResult.labels && results.clusterResult.size && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Interactive Visualization</h4>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <SimpleClusterVisualization 
                    clusterResult={results.clusterResult}
                    width={240}
                    height={180}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Projection Plots */}
          {(results as any).projectionImages && Object.keys((results as any).projectionImages).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Projection Plots</h4>
              
              {Object.entries((results as any).projectionImages).map(([plotType, imageUrl]: [string, any]) => (
                <Card 
                  key={plotType} 
                  className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all" 
                  data-testid={`projection-${plotType}`}
                  onClick={() => setSelectedProjectionType(plotType as "pca" | "tsne" | "umap")}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm capitalize">{plotType.toUpperCase()} Projection</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <img 
                      src={imageUrl as string} 
                      alt={`${plotType} projection`}
                      className="w-full h-auto max-h-48 object-contain bg-white"
                      onError={(e) => {
                        console.error(`Failed to load ${plotType} image:`, e);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Metric Plots */}
          {(results as any).metricImages && Object.keys((results as any).metricImages).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Metric Plots</h4>
              
              {Object.entries((results as any).metricImages).map(([metricType, imageUrl]: [string, any]) => (
                <Card key={metricType} className="overflow-hidden" data-testid={`metric-${metricType}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm capitalize">{metricType.replace('_', ' ')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <img 
                      src={imageUrl as string} 
                      alt={`${metricType} plot`}
                      className="w-full h-auto max-h-48 object-contain bg-white"
                      onError={(e) => {
                        console.error(`Failed to load ${metricType} image:`, e);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Separator />

          {/* Cluster Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Cluster Breakdown</h4>
            
            {clusters.slice(0, 3).map((cluster, index) => {
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-purple-500', 'bg-orange-500'];
              return (
                <Card key={cluster.id} data-testid={`cluster-${cluster.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 ${colors[index]} rounded-full`} />
                        <span className="text-sm font-medium">Cluster {cluster.id}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{cluster.size} points</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>Centroid: ({cluster.centroid.x.toFixed(2)}, {cluster.centroid.y.toFixed(2)})</div>
                      <div>Avg distance: {cluster.avgDistance.toFixed(2)}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {clusters.length > 3 && (
              <Button
                variant="outline"
                className="w-full text-sm"
                data-testid="button-show-all-clusters"
              >
                Show all {clusters.length} clusters
              </Button>
            )}
          </div>

          <Separator />

          {/* Processing Log */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Processing Log</h4>
            <Card>
              <CardContent className="p-3">
                <ScrollArea className="h-32">
                  <div className="text-xs font-mono space-y-1" data-testid="processing-log">
                    {logs.map((log, index) => (
                      <div key={index} className={`${
                        log.type === 'success' ? 'text-green-600' :
                        log.type === 'error' ? 'text-red-600' :
                        log.type === 'info' ? 'text-blue-600' :
                        'text-muted-foreground'
                      }`}>
                        [{log.type === 'success' ? '✓' : 
                          log.type === 'error' ? '✗' : 
                          log.type === 'info' ? 'i' : '·'}] {log.message}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
