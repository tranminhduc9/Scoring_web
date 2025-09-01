import { z } from "zod";

// File upload schemas
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  type: z.enum(['embeddings', 'info']),
});

export const fileMetadataSchema = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  delimiter: z.string(),
  hasHeader: z.boolean(),
  columnCount: z.number(),
  rowCount: z.number(),
  columns: z.array(z.string()),
  numericColumns: z.array(z.string()),
  preview: z.array(z.record(z.string(), z.any())),
});

// Clustering parameters
export const clusteringParamsSchema = z.object({
  lambda: z.number().min(0).max(100),
  k: z.union([
    z.number().int().min(2).max(20),
    z.array(z.number().int().min(2).max(20))
  ]),
  pca_dim: z.number().int().min(2).max(512).default(128),
  level_value: z.union([z.string().min(1), z.array(z.string().min(1))]),
});

// API configuration
export const apiConfigSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().min(1).optional(),
});

// Data processing schemas
export const dataPointSchema = z.object({
  id: z.string(),
  embedding: z.array(z.number()),
  info: z.record(z.string(), z.union([z.string(), z.number()])),
  pca: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  cluster: z.number().optional(),
  size: z.number().optional(),
});

export const enterpriseSchema = z.object({
  Label: z.number().optional(),
  cluster: z.number().optional(),
  name: z.string().optional(),
  taxcode: z.string().optional(),
  sector_name: z.string().optional(),
  sector_unique_id: z.union([z.string(), z.number()]).optional(),
  empl_qtty: z.number().optional(),
  yearreport: z.number().optional(),
  embedding: z.array(z.number()).optional(),
  pca2_x: z.number().optional(),
  pca2_y: z.number().optional(),
  s_DT_TTM: z.number().optional(),
  s_EMPL: z.number().optional(),
  s_TTS: z.number().optional(),
  s_VCSH: z.number().optional(),
}).passthrough(); // Allow additional fields

export const companySchema = z.object({
  sector_unique_id: z.union([z.string(), z.number()]).optional(),
  enterprise: z.array(enterpriseSchema).optional(),
});

export const clusterResultSchema = z.object({
  dataset_id: z.string(),
  mode: z.string().optional(),
  level: z.number().optional(),
  level_value: z.union([z.string(), z.array(z.string())]).optional(),
  lambda: z.number(),
  k_candidates: z.array(z.number()),
  best_k: z.number(),
  n_samples: z.number().optional(),
  metrics_csv: z.string(),
  metric_plots: z.object({
    calinski_harabasz: z.string().optional(),
    davies_bouldin: z.string().optional(),
    silhouette: z.string().optional(),
  }).optional(),
  labels_csv: z.string(),
  labels: z.array(z.number()).optional(),
  scatter_plot_b64: z.string().optional(),
  embedding: z.array(z.array(z.number())).optional(),
  size: z.array(z.number()).optional(),
  projection_plots: z.object({
    pca: z.string().optional(),
    tsne: z.string().optional(),
    umap: z.string().optional(),
  }).optional(),
  // New field for companies array
  companies: z.array(companySchema).optional(),
});

export const clusterMetricsSchema = z.object({
  silhouetteScore: z.number(),
  inertia: z.number(),
  clusters: z.array(z.object({
    id: z.number(),
    size: z.number(),
    centroid: z.object({
      x: z.number(),
      y: z.number(),
    }),
    avgDistance: z.number(),
  })),
});

// Export types
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
export type ClusteringParams = z.infer<typeof clusteringParamsSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type DataPoint = z.infer<typeof dataPointSchema>;
export type Enterprise = z.infer<typeof enterpriseSchema>;
export type Company = z.infer<typeof companySchema>;
export type ClusterResult = z.infer<typeof clusterResultSchema>;
export type ClusterMetrics = z.infer<typeof clusterMetricsSchema>;

export interface ClusteringResults {
  dataPoints: DataPoint[];
  clusterResult: ClusterResult | null;
  metrics: ClusterMetrics;
  projectionImages: Record<string, string>;
  metricImages: Record<string, string>;
}

// User schemas
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

export const insertUserSchema = userSchema.omit({ id: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
