import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useClusteringStore } from "@/lib/clustering-store";
import { clusteringParamsSchema, apiConfigSchema } from "../../../shared/schema";
import { z } from "zod";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Wifi, WifiOff, Download } from "lucide-react";
import IndustrySelector from "@/components/industry-selector";
import { Checkbox } from "@/components/ui/checkbox";

const parametersSchema = z.object({
  lambda: clusteringParamsSchema.shape.lambda,
  k: z.number().int().min(2).max(20),
  pca_dim: clusteringParamsSchema.shape.pca_dim,
  level_value: z.array(z.string()).min(1, "Chọn ít nhất 1 mã ngành"),
});

const apiSchema = z.object({
  endpoint: apiConfigSchema.shape.endpoint,
});

export default function ClusteringForm() {
  const { parameters, apiConfig, updateParameters, updateApiConfig, infoFile: storeInfoFile, results } = useClusteringStore();
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");
  const [infoFile, setInfoFile] = useState<File | null>(null);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);

  const parametersForm = useForm<z.infer<typeof parametersSchema>>({
    resolver: zodResolver(parametersSchema),
    defaultValues: {
      lambda: parameters.lambda,
      k: Array.isArray(parameters.k) ? parameters.k[0] : parameters.k,
      pca_dim: parameters.pca_dim,
      level_value: Array.isArray(parameters.level_value) ? parameters.level_value : [],
    },
  });

  const apiForm = useForm<z.infer<typeof apiSchema>>({
    resolver: zodResolver(apiSchema),
    defaultValues: {
      endpoint: apiConfig.endpoint || "https://06d2eadb5d12.ngrok-free.app",
    },
  });

  const onParametersSubmit = (data: { lambda: number; k: number; pca_dim: number; level_value: string[] }) => {
    updateParameters({
      lambda: data.lambda,
      k: data.k,
      pca_dim: data.pca_dim,
      level_value: data.level_value,
    });

    // Show success notification
    toast({
      title: "Parameters Updated",
      description: "Algorithm parameters have been successfully updated",
      variant: "default",
    });

    // Log current parameter values
    console.log("✅ Parameters updated successfully:");
    console.log("📊 Current parameter values:");
    console.log({
      lambda: data.lambda,
      k: data.k,
      pca_dim: data.pca_dim,
      level_value: data.level_value,
    });
  };

  const onApiConfigSubmit = async (data: { endpoint: string }) => {
    updateApiConfig({
      endpoint: data.endpoint,
    });
    
    // Real connection check using /meta endpoint
    if (data.endpoint) {
      setConnectionStatus("checking");
      try {
        const { clusteringApi } = await import("@/lib/clustering-api");
        await clusteringApi.getMeta({ endpoint: data.endpoint });
        setConnectionStatus("connected");
      } catch (error) {
        console.error("Connection failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
        toast({
          title: "Connection Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setConnectionStatus("disconnected");
      }
    } else {
      setConnectionStatus("disconnected");
    }
  };

  const parseIndustriesFromCSV = async (file: File): Promise<string[]> => {
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const industries = new Set<string>();
      
      if (lines.length === 0) return [];
      
      // Parse header to find sector_unique_id column
      const headerLine = lines[0].trim();
      const headers = headerLine.split(',').map(col => col.trim().replace(/"/g, ''));
      const sectorColumnIndex = headers.findIndex(header => 
        header.toLowerCase().includes('sector_unique_id') || 
        header.toLowerCase().includes('sector') ||
        header.toLowerCase().includes('industry_code') ||
        header.toLowerCase().includes('industrycode')
      );
      
      console.log("📋 CSV Headers:", headers);
      console.log("🎯 Found sector column at index:", sectorColumnIndex, headers[sectorColumnIndex]);
      
      // If sector_unique_id column found, use it specifically
      if (sectorColumnIndex !== -1) {
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
          const sectorValue = columns[sectorColumnIndex];
          
          if (sectorValue && sectorValue !== '') {
            industries.add(sectorValue);
          }
        }
      } else {
        // Fallback: look for industry code patterns in all columns
        console.log("⚠️ sector_unique_id column not found, using pattern matching fallback");
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
          
          columns.forEach(col => {
            if (/^[A-Z]?\d{2,4}$/.test(col) || /^[A-Z]$/.test(col)) {
              industries.add(col);
            }
          });
        }
      }
      
      return Array.from(industries);
    } catch (error) {
      console.error("❌ Failed to parse industries from CSV:", error);
      return [];
    }
  };

  const handleInfoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log("📁 File selected:", file?.name, file?.type, file?.size);
    
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setInfoFile(file);
      
      // Update the store with the file
      const { setInfoFile: setStoreInfoFile } = useClusteringStore.getState();
      setStoreInfoFile(file);
      
      // Parse available industries from the CSV
      const industries = await parseIndustriesFromCSV(file);
      setAvailableIndustries(industries);
      
      console.log("✅ Info file uploaded to store:", file.name);
      console.log("📊 Found industries in CSV:", industries.length, industries.slice(0, 10));
      
      toast({
        title: "File Uploaded",
        description: `${file.name} uploaded. Found ${industries.length} industry codes.`,
        variant: "default",
      });
    } else {
      setInfoFile(null);
      setAvailableIndustries([]);
      console.log("❌ Invalid file type or no file selected");
    }
  };

  const downloadInputJson = (data: { lambda: number; k: number; pca_dim: number; level_value: string[] }) => {
    const inputJson = {
      pca_dim: data.pca_dim,
      lambda: data.lambda,
      k: data.k,
      level_value: data.level_value
    };
    
    const blob = new Blob([JSON.stringify(inputJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clustering-input.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Input JSON Downloaded",
      description: "Clustering input parameters have been downloaded as JSON",
      variant: "default",
    });
  };

  const downloadOutputJson = () => {
    if (!results?.clusterResult) {
      toast({
        title: "No Results Available",
        description: "Please run clustering first to generate output data",
        variant: "destructive",
      });
      return;
    }
    
    // Handle new API response format with companies array
    const outputJson = {
      best_k: results.clusterResult.best_k,
      companies: results.clusterResult.companies || [],
      // Legacy fields for backward compatibility
      dataset_id: results.clusterResult.dataset_id,
      embedding: results.clusterResult.embedding,
      labels: results.clusterResult.labels,
      level: results.clusterResult.level || 1,
      level_value: results.clusterResult.level_value,
      mode: results.clusterResult.mode || "subset",
      n_samples: results.clusterResult.n_samples,
      size: results.clusterResult.size
    };
    
    const blob = new Blob([JSON.stringify(outputJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clustering-output.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Output JSON Downloaded",
      description: "Clustering results have been downloaded as JSON",
      variant: "default",
    });
  };

  return (
    <div className="space-y-6">
      {/* Algorithm Parameters */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Algorithm Parameters</h3>
        
        <Form {...parametersForm}>
          <form onSubmit={parametersForm.handleSubmit(onParametersSubmit)} className="space-y-4">
            <FormField
              control={parametersForm.control}
              name="lambda"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lambda (λ)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      placeholder="0.5"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      data-testid="input-lambda"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Weight factor for embedding vs info data
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={parametersForm.control}
              name="k"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Clusters (k)</FormLabel>
                  <div className="flex space-x-2">
                    <FormControl>
                      <Input
                        type="number"
                        min="2"
                        max="20"
                        placeholder="6"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="flex-1"
                        data-testid="input-k"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Auto-detect optimal k"
                      data-testid="button-auto-k"
                    >
                      ✨
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Or use multiple values: [3,4,5,6,7,8]
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={parametersForm.control}
              name="pca_dim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PCA Dimensions</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="2"
                      max="512"
                      placeholder="128"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      data-testid="input-pca-dim"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Number of PCA dimensions (2-512)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={parametersForm.control}
              name="level_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mã ngành</FormLabel>
                  <FormControl>
                    <IndustrySelector
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Chọn mã ngành..."
                      data-testid="select-level-value"
                      availableIndustries={availableIndustries}
                      showOnlyAvailable={showOnlyAvailable}
                      onShowOnlyAvailableChange={setShowOnlyAvailable}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Chọn mã ngành để phân tích
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label htmlFor="info-file">Info CSV File (Optional)</Label>
              <Input
                id="info-file"
                type="file"
                accept=".csv"
                onChange={handleInfoFileChange}
                data-testid="input-info-file"
              />
              <p className="text-xs text-muted-foreground">
                Upload CSV file with company information (optional)
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" data-testid="button-update-parameters">
                Update Parameters
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => downloadInputJson(parametersForm.getValues())}
                className="flex items-center gap-2"
                data-testid="button-download-input"
              >
                <Download className="h-4 w-4" />
                Input JSON
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <Separator />

      {/* API Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">API Configuration</h3>
        
        <Form {...apiForm}>
          <form onSubmit={apiForm.handleSubmit(onApiConfigSubmit)} className="space-y-4">
            <FormField
              control={apiForm.control}
              name="endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://api.clustering-service.com"
                      {...field}
                      onBlur={field.onBlur}
                      data-testid="input-endpoint"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {connectionStatus === "connected" ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Connected</span>
                </>
              ) : connectionStatus === "checking" ? (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span className="text-sm text-yellow-600">Checking connection...</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  <WifiOff className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Disconnected</span>
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" data-testid="button-update-config">
                Update Configuration
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={downloadOutputJson}
                className="flex items-center gap-2"
                data-testid="button-download-output"
                disabled={!results?.clusterResult}
              >
                <Download className="h-4 w-4" />
                Output JSON
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
