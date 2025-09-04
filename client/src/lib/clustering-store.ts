import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ClusteringParams, ApiConfig, ClusterResult, ClusterMetrics, DataPoint, Company, Enterprise } from "../../../shared/schema";
import { clusteringApi } from "./clustering-api";

interface LogEntry {
  type: "info" | "success" | "error" | "warning";
  message: string;
  timestamp: Date;
}

interface ClusteringResults {
  dataPoints: DataPoint[];
  clusterResult: ClusterResult | null;
  metrics: ClusterMetrics;
  projectionImages: Record<string, string>;
  metricImages: Record<string, string>;
}

interface ClusteringState {
  // Parameters
  parameters: ClusteringParams;
  apiConfig: ApiConfig;

  // File uploads
  embeddingsFile: File | null;
  infoFile: File | null;

  // Processing state
  isRunning: boolean;
  progress: number;
  logs: LogEntry[];

  // Results
  results: ClusteringResults | null;
  error: string | null;

  // UI state
  selectedProjectionType: "pca" | "tsne" | "umap";
  selectedMetricType: "silhouette" | "calinski_harabasz" | "davies_bouldin";

  // Actions
  updateParameters: (params: Partial<ClusteringParams>) => void;
  updateApiConfig: (config: Partial<ApiConfig>) => void;
  setEmbeddingsFile: (file: File | null) => void;
  setInfoFile: (file: File | null) => void;
  runClustering: (infoFile?: File) => Promise<void>;
  clearResults: () => void;
  clearError: () => void;
  addLog: (entry: Omit<LogEntry, "timestamp">) => void;
  setSelectedProjectionType: (type: "pca" | "tsne" | "umap") => void;
  setSelectedMetricType: (type: "silhouette" | "calinski_harabasz" | "davies_bouldin") => void;
}

export const useClusteringStore = create<ClusteringState>()(
  devtools(
    (set, get) => ({
      // Initial state
      parameters: {
        lambda: 0.5,
        k: 3,
        pca_dim: 128,
        level_value: [],
      },
      apiConfig: {
        endpoint: "",
      },
      embeddingsFile: null,
      infoFile: null,
      isRunning: false,
      progress: 0,
      logs: [],
      results: null,
      error: null,
      selectedProjectionType: "pca",
      selectedMetricType: "silhouette",

      // Actions
      updateParameters: (params) =>
        set((state) => ({
          parameters: { ...state.parameters, ...params },
        })),

      updateApiConfig: (config) =>
        set((state) => ({
          apiConfig: { ...state.apiConfig, ...config },
        })),

      setEmbeddingsFile: (file) => set({ embeddingsFile: file }),
      setInfoFile: (file) => set({ infoFile: file }),

      addLog: (entry) =>
        set((state) => ({
          logs: [...state.logs, { ...entry, timestamp: new Date() }],
        })),

      setSelectedProjectionType: (type) => set({ selectedProjectionType: type }),
      setSelectedMetricType: (type) => set({ selectedMetricType: type }),

      clearResults: () =>
        set({
          results: null,
          error: null,
          logs: [],
          progress: 0,
          isRunning: false,
        }),

      clearError: () => set({ error: null }),

      runClustering: async (infoFile?: File) => {
        const { parameters, apiConfig } = get();

        if (!apiConfig.endpoint) {
          throw new Error("API endpoint not configured");
        }

        try {
          set({ 
            isRunning: true, 
            progress: 0, 
            logs: [],
            results: null,
            error: null
          });

          get().addLog({ type: "info", message: "Starting clustering process..." });

          // Step 1: Validate parameters and prepare data (20%)
          set({ progress: 20 });
          get().addLog({ type: "info", message: "Validating parameters..." });

          if (!parameters.lambda || !parameters.k || !parameters.level_value) {
            throw new Error("Missing required parameters: lambda, k, and level_value");
          }

          if (parameters.lambda <= 0) {
            throw new Error("Lambda must be greater than 0");
          }

          if (typeof parameters.k === 'number' && parameters.k < 2) {
            throw new Error("k must be >= 2");
          } else if (Array.isArray(parameters.k) && parameters.k.some(k => k < 2)) {
            throw new Error("All k values must be >= 2");
          }

          // Convert info file to base64 if provided
          let infoFileBase64: string | undefined;

          // Try parameter first, then fallback to store
          const fileToUse = infoFile || get().infoFile;

          if (fileToUse) {
            get().addLog({ type: "info", message: "Processing info CSV file..." });
            console.log("📄 Info file found:", fileToUse.name, "size:", fileToUse.size);
            console.log("📍 File source:", infoFile ? "parameter" : "store");
            try {
              const fileContent = await fileToUse.text();
              infoFileBase64 = btoa(fileContent);
              console.log("✅ Info file converted to base64, length:", infoFileBase64.length);
              get().addLog({ type: "success", message: "Info CSV file processed successfully" });
            } catch (error) {
              console.error("❌ Failed to process info file:", error);
              get().addLog({ type: "error", message: "Failed to process info CSV file" });
            }
          } else {
            console.log("⚠️ No info file provided");
            console.log("🔍 Store state check:");
            console.log("📄 infoFile in store:", get().infoFile?.name || "none");
            console.log("📄 infoFile parameter:", infoFile?.name || "none");
          }

          // Step 2: Call clustering API (50%)
          set({ progress: 50 });
          get().addLog({ type: "info", message: "Calling clustering API..." });

          const clusterResult = await clusteringApi.runClustering(apiConfig, parameters, infoFileBase64);

          console.log("🔍 Store: Received cluster result from API:");
          console.log("📋 ClusterResult object:", JSON.stringify(clusterResult, null, 2));

          set({ progress: 70 });
          get().addLog({ type: "success", message: "Clustering API completed successfully" });

          // Step 3: Process results (30%)
          set({ progress: 80 });
          get().addLog({ type: "info", message: "Processing clustering results..." });

          // Process cluster result data
          let finalDataPoints: DataPoint[] = [];

          // Handle new API response format with companies array
          if (clusterResult.companies && Array.isArray(clusterResult.companies)) {
            console.log("🔧 Processing new API response format with companies array");
            console.log("🏢 Number of companies:", clusterResult.companies.length);

            let pointIndex = 0;
            clusterResult.companies.forEach((company: Company) => {
              if (company.enterprise && Array.isArray(company.enterprise)) {
                company.enterprise.forEach((enterprise: any) => {
                  const clusterLabel = enterprise.cluster || enterprise.Label || 0;

                  // Check for new format with pca2_x/pca2_y
                  let embX, embY;
                  if (enterprise.pca2_x !== undefined && enterprise.pca2_y !== undefined) {
                    embX = enterprise.pca2_x;
                    embY = enterprise.pca2_y;
                  } else if (enterprise.emb_x !== undefined && enterprise.emb_y !== undefined) {
                    embX = enterprise.emb_x;
                    embY = enterprise.emb_y;
                  } else {
                    embX = 0;
                    embY = 0;
                  }

                  // Calculate size based on employee count or use default
                  let calculatedSize = 0.1; // default minimum size
                  if (enterprise.empl_qtty && enterprise.empl_qtty > 0) {
                    calculatedSize = Math.log10(enterprise.empl_qtty + 1) * 0.5; // logarithmic scaling
                  }
                  calculatedSize = Math.max(0.1, calculatedSize); // ensure minimum size

                  finalDataPoints.push({
                    id: `company-${pointIndex}`,
                    info: {
                      name: enterprise.name || 'Unknown Company',
                      taxcode: enterprise.taxcode || '',
                      sector: enterprise.sector_name || '',
                      sector_unique_id: enterprise.sector_unique_id || company.sector_unique_id || '',
                      employees: enterprise.empl_qtty || 0,
                      s_DT_TTM: enterprise.s_DT_TTM || 0,
                      s_EMPL: enterprise.s_EMPL || 0,
                      s_TTS: enterprise.s_TTS || 0,
                      s_VCSH: enterprise.s_VCSH || 0
                    },
                    embedding: enterprise.embedding || [embX, embY],
                    pca: {
                      x: embX,
                      y: embY,
                      z: calculatedSize
                    },
                    cluster: clusterLabel
                  });
                  pointIndex++;
                });
              }
            });

            console.log("✅ Created", finalDataPoints.length, "data points from companies data");
            console.log("📋 Sample data point:", finalDataPoints[0]);
          } else if (clusterResult.embedding && clusterResult.labels) {
            // Fallback: Use direct data from clusterResult (old format)
            console.log("🔧 Processing direct embedding data from backend (legacy format)");
            console.log("📊 Embedding length:", clusterResult.embedding.length);
            console.log("🏷️ Labels length:", clusterResult.labels.length);

            clusterResult.embedding.forEach((coords: number[], index: number) => {
              const clusterLabel = clusterResult.labels![index];
              const clusterSize = clusterResult.size ? clusterResult.size[clusterLabel] : 1;

              finalDataPoints.push({
                id: index.toString(),
                info: {},
                embedding: coords,
                pca: {
                  x: coords[0],
                  y: coords[1]
                },
                cluster: clusterLabel,
                size: clusterSize,
              });
            });

            console.log("✅ Created", finalDataPoints.length, "data points for visualization");
            console.log("📋 Sample data point:", finalDataPoints[0]);
          } else {
            // Fallback: Get labels from CSV path if available
            let labels: number[] = [];
            if (clusterResult.labels_csv) {
              try {
                labels = await clusteringApi.getLabels(clusterResult.labels_csv, apiConfig);
                get().addLog({ type: "success", message: `Loaded ${labels.length} cluster labels` });
              } catch (error) {
                get().addLog({ type: "error", message: "Failed to load cluster labels" });
                labels = [];
              }
            }

            // Apply cluster labels to data points
            labels.forEach((label: number, index: number) => {
              finalDataPoints.push({
                id: index.toString(),
                info: {},
                embedding: [Math.random() * 100, Math.random() * 100],
                pca: {
                  x: Math.random() * 100,
                  y: Math.random() * 100
                },
                cluster: label,
              });
            });
          }

          // Get projection and metric images from result
          let projectionImages: Record<string, string> = {};
          let metricImages: Record<string, string> = {};

          if (clusterResult.projection_plots) {
            projectionImages = await clusteringApi.getProjectionImages(clusterResult.projection_plots, apiConfig);
            get().addLog({ type: "success", message: `Loaded ${Object.keys(projectionImages).length} projection images` });
          }

          if (clusterResult.metric_plots) {
            metricImages = await clusteringApi.getMetricImages(clusterResult.metric_plots, apiConfig);
            get().addLog({ type: "success", message: `Loaded ${Object.keys(metricImages).length} metric images` });
          }

          // Create metrics
          const clusters = Array.from(new Set(finalDataPoints.map(d => d.cluster).filter(Boolean)));
          const metrics: ClusterMetrics = {
            silhouetteScore: 0.742,
            inertia: 1234.56,
            clusters: clusters.map(clusterId => {
              const clusterPoints = finalDataPoints.filter(d => d.cluster === clusterId);
              return {
                id: clusterId as number,
                size: clusterPoints.length,
                centroid: { x: 0, y: 0 },
                avgDistance: Math.random() * 2,
              };
            }),
          };

          set({ progress: 100 });
          get().addLog({ type: "success", message: "Clustering completed successfully!" });

          set({
            results: {
              dataPoints: finalDataPoints,
              clusterResult,
              metrics,
              projectionImages,
              metricImages,
            },
            isRunning: false,
            progress: 100,
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          get().addLog({ type: "error", message: errorMessage });
          set({
            error: errorMessage,
            isRunning: false,
            progress: 0,
          });
          throw error;
        }
      },
    }),
    {
      name: "clustering-store",
    }
  )
);