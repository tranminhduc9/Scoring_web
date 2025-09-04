import { useEffect, useState } from "react";
import { useClusteringStore } from "../lib/clustering-store";
import FileUploadZone from "@/components/file-upload-zone";
import ClusteringForm from "@/components/clustering-form";
import ScatterPlot from "@/components/scatter-plot";
import InteractiveZoomSpace from "@/components/interactive-zoom-space";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Loader2, TestTube, Map } from "lucide-react";
import { Link } from "wouter";

export default function ClusteringPage() {
  const {
    embeddingsFile,
    infoFile,
    isRunning,
    progress,
    error,
    results,
    runClustering,
    clearError,
  } = useClusteringStore();

  const [activeTab, setActiveTab] = useState<"clustering" | "zoom">("zoom");

  const canRunClustering = !isRunning;

  useEffect(() => {
    document.title = "Enterprise Clustering Analytics Platform";
  }, []);

  // Enhanced wrapper to transform clustering results for InteractiveZoomSpace component
  const InteractiveZoomSpaceWrapper = ({ results, height }: { results: any; height: number }) => {
    if (!results || !results.clusterResult?.companies) {
      console.warn('No clustering results or companies data found');
      return <div className="text-center text-muted-foreground p-8">No data available for zoom space</div>;
    }

    const transformedData: any[] = [];
    let pointIndex = 0;
    let totalPoints = 0;
    let validPoints = 0;

    console.log('🚀 Interactive Zoom Space: Transforming clustering data...');
    console.log('📊 Total companies:', results.clusterResult.companies.length);

    results.clusterResult.companies.forEach((company: any) => {
      if (company.enterprise && Array.isArray(company.enterprise)) {
        company.enterprise.forEach((enterprise: any) => {
          totalPoints++;

          // Check for new format with pca2_x/pca2_y, fallback to emb_x/emb_y
          let finalX, finalY;
          if (enterprise.pca2_x !== undefined && enterprise.pca2_y !== undefined) {
            finalX = enterprise.pca2_x;
            finalY = enterprise.pca2_y;
          } else if (enterprise.emb_x !== undefined && enterprise.emb_y !== undefined) {
            finalX = enterprise.emb_x;
            finalY = enterprise.emb_y;
          } else {
            finalX = 0;
            finalY = 0;
          }

          // Enhanced cluster label detection
          const clusterLabel = enterprise.cluster ??
                              enterprise.Label ??
                              enterprise.cluster_label ??
                              0;

          // Calculate Z coordinate using specified formula: z = 30/100 * (s_DT_TTM + s_TTS + s_VCSH) + 0.1 * s_EMPL
          const s_DT_TTM = enterprise.s_DT_TTM || 0;
          const s_TTS = enterprise.s_TTS || 0;
          const s_VCSH = enterprise.s_VCSH || 0;
          const s_EMPL = enterprise.s_EMPL || enterprise.empl_qtty || enterprise.employees || 0;

          const calculatedZ = (s_DT_TTM + s_TTS + s_VCSH) * 0.3 + s_EMPL * 0.1;

          // Fixed small size for all points
          const fixedSize = 0.2; // Small fixed size

          // Check if coordinates are valid (not null/undefined)
          const hasValidCoords = finalX !== null && finalX !== undefined &&
                                finalY !== null && finalY !== undefined &&
                                !isNaN(finalX) && !isNaN(finalY);

          if (hasValidCoords) {
            transformedData.push({
              x: finalX,
              y: finalY,
              z: calculatedZ, // Use calculated Z as third dimension in 3D view
              cluster: Number(clusterLabel), // Ensure numeric cluster ID
              size: fixedSize, // Fixed small size
              index: pointIndex,
              info: {
                name: enterprise.name || enterprise.company_name || 'Unknown Company',
                taxcode: enterprise.taxcode || '',
                sector: enterprise.sector_name || company.sector_name || '',
                sector_unique_id: enterprise.sector_unique_id || company.sector_unique_id || '',
                employees: enterprise.empl_qtty || enterprise.employees || 0,
                year: enterprise.yearreport || enterprise.year_report || 0,
                revenue: enterprise.s_DT_TTM || 0,
                assets: enterprise.s_VCSH || 0,
                cluster_id: clusterLabel
              }
            });
            validPoints++;
            pointIndex++;
          }
        });
      }
    });

    console.log('✅ Interactive Zoom Space: Data transformation completed');
    console.log(`📊 Total points processed: ${totalPoints}`);
    console.log(`🎯 Valid points created: ${validPoints}`);
    console.log(`📈 Cluster distribution:`, transformedData.reduce((acc: {[key: string]: number}, pt) => {
      acc[`C${pt.cluster}`] = (acc[`C${pt.cluster}`] || 0) + 1;
      return acc;
    }, {}));

    if (transformedData.length === 0) {
      console.warn('❌ No valid data points could be created for Interactive Zoom Space');
      return <div className="text-center text-muted-foreground p-8">
        No valid data points found. Please check that clustering completed successfully with valid coordinates.
      </div>;
    }

    // Access parameters from the store if available, otherwise use defaults or null
    const parameters = useClusteringStore.getState().parameters || {};


    return (
      <InteractiveZoomSpace
        data={transformedData}
        height={height}
        title={`Scatter Plot - Lambda (λ): ${parameters.lambda}, Clusters: ${Array.from(new Set(transformedData.map(d => d.cluster))).sort().join(', ')}`}
        is3D={true}
        onSelectionChange={(points) => {
          console.log(`🔥 Selected ${points.length} points for zoom/focus`);
          console.log('📍 Selected points sample:', points.slice(0, 2));
        }}
      />
    );
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Left Sidebar - Control Panel */}
      <div className="w-full lg:w-80 lg:min-w-[280px] lg:max-w-[400px] xl:w-96 bg-card border-r border-border flex flex-col lg:h-screen">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-semibold text-foreground">
              Clustering Control Panel
            </h1>
            <Link href="/mock-test">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Mock Test
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload data files and configure clustering parameters
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Separator />

          {/* Clustering Parameters */}
          <ClusteringForm />

          <Separator />




          {/* Run Clustering */}
          <div className="space-y-4">
            <Button
              onClick={() => runClustering()}
              disabled={!canRunClustering}
              className="w-full bg-accent hover:bg-accent/90 text-white font-medium py-3"
              data-testid="button-run-clustering"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Run Clustering Analysis"
              )}
            </Button>

            {/* Progress Indicator */}
            {isRunning && (
              <Card className="p-3 bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">Processing...</span>
                  <span className="text-sm text-blue-600">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="mb-2" />
                <div className="text-xs text-blue-700 space-y-1" data-testid="progress-log">
                  <div className="flex items-center">
                    {progress > 20 ? (
                      <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    )}
                    Files processed
                  </div>
                  <div className="flex items-center">
                    {progress > 60 ? (
                      <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                    ) : progress > 20 ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <div className="h-3 w-3 mr-1" />
                    )}
                    PCA computation completed
                  </div>
                  <div className="flex items-center">
                    {progress > 90 ? (
                      <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                    ) : progress > 60 ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <div className="h-3 w-3 mr-1" />
                    )}
                    Running clustering API...
                  </div>
                </div>
              </Card>
            )}
          </div>

        </div>
      </div>

      {/* Main Content - Visualization */}
      <div className="flex-1 flex flex-col">
        {/* Chart Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Toolbar */}
          <div className="bg-card border-b border-border px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Analysis Results
                </h2>
                {results && (
                  <div className="bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground" data-testid="data-points-count">
                    {results.dataPoints?.length || 0} data points
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chart with Tabs */}
          <div className="flex-1 p-4 lg:p-6">
            {results ? (
              <div className="w-full h-full">
                <div className="flex border-b mb-4">
                  <button
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                      activeTab === "zoom"
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab("zoom")}
                  >
                    Interactive Zoom Space
                  </button>
                  <button
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                      activeTab === "clustering"
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setActiveTab("clustering")}
                  >
                    Cluster Visualization
                  </button>
                </div>
                <div className="h-[calc(100%-40px)]">
                  <div style={{ display: activeTab === "zoom" ? 'block' : 'none' }}>
                    <InteractiveZoomSpaceWrapper results={results} height={600} />
                  </div>
                  <div style={{ display: activeTab === "clustering" ? 'block' : 'none' }}>
                    <ScatterPlot />
                  </div>
                </div>
              </div>
            ) : (
              <ScatterPlot />
            )}
          </div>
        </div>

      </div>

      {/* Error Notification */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md" data-testid="error-notification">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800">Processing Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="text-red-400 hover:text-red-600 p-1"
              data-testid="button-dismiss-error"
            >
              ×
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}