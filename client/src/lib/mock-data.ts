import { ClusterResult } from "../../../shared/schema";

// Generate mock clustering data for testing
export function generateMockClusterData(): ClusterResult {
  const numSamples = 150;
  const numClusters = 4;
  
  // Generate random 2D embedding points
  const embedding: number[][] = [];
  const labels: number[] = [];
  const size: number[] = [];
  
  // Create clusters with some structure
  const clusterCenters = [
    [-2, -2], [2, -2], [-2, 2], [2, 2]
  ];
  
  for (let i = 0; i < numSamples; i++) {
    const clusterIndex = Math.floor(Math.random() * numClusters);
    const center = clusterCenters[clusterIndex];
    
    // Add some noise around cluster centers
    const x = center[0] + (Math.random() - 0.5) * 2;
    const y = center[1] + (Math.random() - 0.5) * 2;
    
    embedding.push([x, y]);
    labels.push(clusterIndex);
    
    // Generate company sizes (0.1 to 2.0)
    size.push(0.1 + Math.random() * 1.9);
  }
  
  return {
    dataset_id: "mock_test_data",
    mode: "subset",
    level: 1,
    level_value: "A",
    lambda: 0.5,
    k_candidates: [2, 3, 4, 5],
    best_k: numClusters,
    n_samples: numSamples,
    metrics_csv: "cluster,size,centroid_x,centroid_y\n0,38,-2.1,-1.9\n1,37,1.8,-2.2\n2,35,-1.9,2.1\n3,40,2.2,1.8",
    labels_csv: labels.map((label, index) => `${index},${label}`).join('\n'),
    labels: labels,
    scatter_plot_b64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    embedding: embedding,
    size: size,
    projection_plots: {
      pca: "/static/plots/pca_projection.png",
      tsne: "/static/plots/tsne_projection.png",
      umap: "/static/plots/umap_projection.png"
    }
  };
}

// Generate mock data with different cluster patterns
export function generateMockClusterDataVariants(): ClusterResult[] {
  const variants = [
    {
      name: "Circular Clusters",
      generator: () => generateCircularClusters(120, 3)
    },
    {
      name: "Linear Clusters", 
      generator: () => generateLinearClusters(100, 4)
    },
    {
      name: "Dense vs Sparse",
      generator: () => generateDensityVariedClusters(140, 3)
    }
  ];
  
  return variants.map(variant => variant.generator());
}

function generateCircularClusters(numSamples: number, numClusters: number): ClusterResult {
  const embedding: number[][] = [];
  const labels: number[] = [];
  const size: number[] = [];
  
  const radius = 3;
  const angleStep = (2 * Math.PI) / numClusters;
  
  for (let i = 0; i < numSamples; i++) {
    const clusterIndex = Math.floor(Math.random() * numClusters);
    const angle = clusterIndex * angleStep;
    
    const centerX = Math.cos(angle) * radius;
    const centerY = Math.sin(angle) * radius;
    
    // Add points in a circle around center
    const pointAngle = Math.random() * 2 * Math.PI;
    const pointRadius = Math.random() * 0.8;
    
    const x = centerX + Math.cos(pointAngle) * pointRadius;
    const y = centerY + Math.sin(pointAngle) * pointRadius;
    
    embedding.push([x, y]);
    labels.push(clusterIndex);
    size.push(0.2 + Math.random() * 1.5);
  }
  
  return {
    dataset_id: "mock_circular_clusters",
    mode: "subset",
    level: 1,
    level_value: "B",
    lambda: 0.7,
    k_candidates: [2, 3, 4],
    best_k: numClusters,
    n_samples: numSamples,
    metrics_csv: `cluster,size\n${Array.from({length: numClusters}, (_, i) => `${i},${Math.floor(numSamples/numClusters)}`).join('\n')}`,
    labels_csv: labels.map((label, index) => `${index},${label}`).join('\n'),
    labels: labels,
    embedding: embedding,
    size: size
  };
}

function generateLinearClusters(numSamples: number, numClusters: number): ClusterResult {
  const embedding: number[][] = [];
  const labels: number[] = [];
  const size: number[] = [];
  
  for (let i = 0; i < numSamples; i++) {
    const clusterIndex = Math.floor(Math.random() * numClusters);
    
    // Create linear clusters along different slopes
    const slope = clusterIndex * 0.5 - 1; // slopes from -1 to 1.5
    const baseX = (Math.random() - 0.5) * 6;
    const baseY = slope * baseX + clusterIndex * 2 - 3;
    
    // Add some perpendicular noise
    const perpX = baseX + (Math.random() - 0.5) * 0.5;
    const perpY = baseY + (Math.random() - 0.5) * 0.5;
    
    embedding.push([perpX, perpY]);
    labels.push(clusterIndex);
    size.push(0.3 + Math.random() * 1.2);
  }
  
  return {
    dataset_id: "mock_linear_clusters",
    mode: "subset", 
    level: 2,
    level_value: "C",
    lambda: 0.3,
    k_candidates: [3, 4, 5],
    best_k: numClusters,
    n_samples: numSamples,
    metrics_csv: `cluster,size\n${Array.from({length: numClusters}, (_, i) => `${i},${Math.floor(numSamples/numClusters)}`).join('\n')}`,
    labels_csv: labels.map((label, index) => `${index},${label}`).join('\n'),
    labels: labels,
    embedding: embedding,
    size: size
  };
}

function generateDensityVariedClusters(numSamples: number, numClusters: number): ClusterResult {
  const embedding: number[][] = [];
  const labels: number[] = [];
  const size: number[] = [];
  
  const clusterSizes = [0.3, 1.0, 0.6]; // Different density spreads
  const clusterCenters = [[-3, 0], [0, 0], [3, 0]];
  
  for (let i = 0; i < numSamples; i++) {
    const clusterIndex = Math.floor(Math.random() * numClusters);
    const center = clusterCenters[clusterIndex];
    const spread = clusterSizes[clusterIndex];
    
    const x = center[0] + (Math.random() - 0.5) * spread * 4;
    const y = center[1] + (Math.random() - 0.5) * spread * 4;
    
    embedding.push([x, y]);
    labels.push(clusterIndex);
    
    // Larger companies in denser clusters
    const densityFactor = 1 / (spread + 0.1);
    size.push(0.2 + Math.random() * 1.0 * densityFactor);
  }
  
  return {
    dataset_id: "mock_density_varied",
    mode: "subset",
    level: 1, 
    level_value: "D",
    lambda: 0.8,
    k_candidates: [2, 3, 4],
    best_k: numClusters,
    n_samples: numSamples,
    metrics_csv: `cluster,size\n${Array.from({length: numClusters}, (_, i) => `${i},${Math.floor(numSamples/numClusters)}`).join('\n')}`,
    labels_csv: labels.map((label, index) => `${index},${label}`).join('\n'),
    labels: labels,
    embedding: embedding,
    size: size
  };
}
