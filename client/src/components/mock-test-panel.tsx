import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateMockClusterData, generateMockClusterDataVariants } from "../lib/mock-data";
import SimpleClusterVisualization from "./simple-cluster-visualization";
import { ClusterResult } from "../../../shared/schema";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function MockTestPanel() {
  const [currentMockData, setCurrentMockData] = useState<ClusterResult | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("default");

  const loadMockData = (variant: string) => {
    setSelectedVariant(variant);
    
    switch (variant) {
      case "default":
        setCurrentMockData(generateMockClusterData());
        break;
      case "circular":
        setCurrentMockData(generateMockClusterDataVariants()[0]);
        break;
      case "linear":
        setCurrentMockData(generateMockClusterDataVariants()[1]);
        break;
      case "density":
        setCurrentMockData(generateMockClusterDataVariants()[2]);
        break;
      default:
        setCurrentMockData(generateMockClusterData());
    }
  };

  const variants = [
    { key: "default", name: "Standard Clusters", description: "4 clusters with random scatter" },
    { key: "circular", name: "Circular Pattern", description: "3 clusters in circular arrangement" },
    { key: "linear", name: "Linear Pattern", description: "4 clusters along different slopes" },
    { key: "density", name: "Density Varied", description: "3 clusters with different densities" }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Mock Data Test Panel</h2>
          <p className="text-muted-foreground">Test cluster visualization with different mock data patterns</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="flex items-center gap-2" data-testid="button-back-to-main">
            <ArrowLeft className="h-4 w-4" />
            Back to Main
          </Button>
        </Link>
      </div>

      {/* Mock Data Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mock Data Variants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {variants.map((variant) => (
              <Button
                key={variant.key}
                variant={selectedVariant === variant.key ? "default" : "outline"}
                className="h-auto p-4 flex flex-col items-start space-y-2"
                onClick={() => loadMockData(variant.key)}
              >
                <div className="font-medium">{variant.name}</div>
                <div className="text-sm text-muted-foreground text-left">
                  {variant.description}
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Data Info */}
      {currentMockData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Dataset Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Dataset ID</div>
                <Badge variant="secondary">{currentMockData.dataset_id}</Badge>
              </div>
              <div>
                <div className="font-medium">Samples</div>
                <Badge variant="secondary">{currentMockData.n_samples}</Badge>
              </div>
              <div>
                <div className="font-medium">Clusters</div>
                <Badge variant="secondary">{currentMockData.best_k}</Badge>
              </div>
              <div>
                <div className="font-medium">Lambda</div>
                <Badge variant="secondary">{currentMockData.lambda}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visualization */}
      {currentMockData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cluster Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <SimpleClusterVisualization 
                clusterResult={currentMockData}
                width={800}
                height={600}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!currentMockData && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              Select a mock data variant above to test the cluster visualization
            </div>
            <Button onClick={() => loadMockData("default")}>
              Load Default Mock Data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
