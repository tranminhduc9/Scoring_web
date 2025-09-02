
import { useState } from "react";
import InteractiveZoomSpace from "@/components/interactive-zoom-space";
import { useClusteringStore } from "@/lib/clustering-store";

export default function InteractiveZoomDemo() {
  const { results } = useClusteringStore();
  const [selectedPoints, setSelectedPoints] = useState<any[]>([]);

  // Transform clustering results to the format expected by InteractiveZoomSpace
  const transformedData = results?.dataPoints?.map((point: any, index: number) => ({
    x: point.pca?.x || point.x || Math.random() * 10,
    y: point.pca?.y || point.y || Math.random() * 10,
    z: point.pca?.z || point.size || Math.random() * 2,
    cluster: point.cluster || 0,
    size: point.size || 1,
    index: index,
    info: point.info || {}
  })) || [];

  // Generate sample data if no clustering results
  const sampleData = Array.from({ length: 100 }, (_, i) => ({
    x: Math.random() * 20 - 10,
    y: Math.random() * 20 - 10,
    z: Math.random() * 5,
    cluster: Math.floor(Math.random() * 5),
    size: Math.random() * 2 + 0.5,
    index: i,
    info: {
      name: `Company ${i + 1}`,
      sector: `Sector ${Math.floor(Math.random() * 3) + 1}`,
      employees: Math.floor(Math.random() * 1000) + 10
    }
  }));

  const dataToUse = transformedData.length > 0 ? transformedData : sampleData;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Interactive Zoom Space</h1>
        <p className="text-muted-foreground">
          Select regions and zoom in with enhanced visual separation
        </p>
      </div>

      <InteractiveZoomSpace
        data={dataToUse}
        height={700}
        title="Enterprise Clustering Analysis"
        is3D={true}
        onSelectionChange={(points) => {
          setSelectedPoints(points);
          console.log('Selected points:', points);
        }}
      />

      {/* Selection Details */}
      {selectedPoints.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Selection Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedPoints.slice(0, 6).map((point, index) => (
              <div key={index} className="p-3 border rounded-lg bg-card">
                <div className="font-medium">{point.info?.name || `Point ${point.index}`}</div>
                <div className="text-sm text-muted-foreground">
                  Cluster: {point.cluster}<br/>
                  Position: ({point.x.toFixed(2)}, {point.y.toFixed(2)})<br/>
                  {point.info?.sector && `Sector: ${point.info.sector}`}
                </div>
              </div>
            ))}
            {selectedPoints.length > 6 && (
              <div className="p-3 border rounded-lg bg-muted/50 flex items-center justify-center">
                <span className="text-muted-foreground">
                  +{selectedPoints.length - 6} more points
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
