import { ApiConfig, ClusterResult, ClusteringParams } from "@shared/schema";

interface ClusteringRequest {
  lambda: number;
  k_list: number[];
}

class ClusteringApi {
  async getMeta(config: ApiConfig) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      console.error(`[DEBUG] Calling API: ${config.endpoint}/meta`);
      console.error(`[DEBUG] Full URL: ${config.endpoint}/meta`);
      
      const response = await fetch(`${config.endpoint}/meta`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.error(`[DEBUG] Response status: ${response.status}`);
      console.error(`[DEBUG] Response URL: ${response.url}`);
      console.error(`[DEBUG] Response redirected: ${response.redirected}`);
      
      // Check what we actually received
      const responseText = await response.text();
      console.error(`[DEBUG] Response body:`, responseText);
      console.error(`[DEBUG] Content-Type:`, response.headers.get('content-type'));

      if (!response.ok) {
        throw new Error(`API Error ${response.status}: ${response.statusText}`);
      }

      // Check if response is actually JSON
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error(`Server trả về HTML thay vì JSON. Có thể bị redirect hoặc proxy issue.`);
      }

      console.error(`[DEBUG] API connection successful - received JSON`);
      return { status: 'ok' };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Timeout: API không phản hồi sau 10 giây. Kiểm tra ${config.endpoint}`);
        }
        if (error.message.includes('fetch') || error.message.includes('NetworkError')) {
          throw new Error(`Không thể kết nối đến API: ${config.endpoint}. Kiểm tra endpoint URL và kết nối mạng.`);
        }
      }
      throw error;
    }
  }

  async runPrepare(files: { embeddings: File; info: File }, config: ApiConfig): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for file processing

    try {
      const formData = new FormData();
      formData.append('embeddings', files.embeddings);
      formData.append('info', files.info);

      console.log(`🔄 Calling /prepare/run API:`, {
        url: `${config.endpoint}/prepare/run`,
        files: {
          embeddings: files.embeddings.name,
          info: files.info.name
        }
      });

      const response = await fetch(`${config.endpoint}/prepare/run`, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `API Error ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(`✅ /prepare/run response:`, result);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Timeout: API prepare không phản hồi sau 60 giây`);
        }
        if (error.message.includes('fetch') || error.message.includes('NetworkError') || error.message.includes('TypeError')) {
          throw new Error(`Không thể kết nối đến API prepare: ${config.endpoint}/prepare/run`);
        }
      }
      throw error;
    }
  }

  async runClustering(config: ApiConfig, params: ClusteringParams, infoFileBase64?: string): Promise<ClusterResult> {
    
    try {
      const requestBody = {
        pca_dim: params.pca_dim,
        lambda: params.lambda,
        k: params.k,
        level_value: params.level_value,
        ...(infoFileBase64 && { info_quy_mo_b64: infoFileBase64 })
      };

      console.log("🔍 Info file check:");
      console.log("📄 infoFileBase64 provided:", !!infoFileBase64);
      console.log("📊 info_quy_mo_b64 in payload:", 'info_quy_mo_b64' in requestBody);
      if (infoFileBase64) {
        console.log("📏 Base64 length:", infoFileBase64.length);
        console.log("🔤 Base64 preview:", infoFileBase64.substring(0, 100) + "...");
      }

      // Log the JSON payload being sent to API
      console.log("🚀 API Request Payload:");
      console.log("📋 JSON being sent to /cluster/run:");
      console.log(JSON.stringify(requestBody, null, 2));
      console.log("🌐 Endpoint:", `${config.endpoint}/cluster/run`);

      const response = await fetch(`${config.endpoint}/cluster/run`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(requestBody),
      });

      console.log("📡 API Response Status:", response.status);
      console.log("📡 API Response Headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      // Get response text first to handle NaN values
      const responseText = await response.text();
      console.log("📥 Raw API Response Text (first 500 chars):", responseText.substring(0, 500));
      
      // Replace NaN values with null to make valid JSON
      const sanitizedText = responseText.replace(/:\s*NaN\s*([,}])/g, ': null$1');
      
      try {
        const result = JSON.parse(sanitizedText);
        console.log("✅ API Response Data:");
        console.log("📊 Full Backend Response:");
        console.log(JSON.stringify(result, null, 2));
        
        return result;
      } catch (parseError) {
        console.error("❌ JSON Parse Error:", parseError);
        console.error("🔍 Problematic text:", sanitizedText.substring(0, 1000));
        throw new Error(`Invalid JSON response from API: ${parseError}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('NetworkError') || error.message.includes('TypeError')) {
          throw new Error(`Không thể kết nối đến API clustering: ${config.endpoint}/cluster/run`);
        }
      }
      throw error;
    }
  }

  async getLabels(labelsPath: string, config: ApiConfig): Promise<number[]> {
    try {
      console.log(`📄 Fetching labels from: ${labelsPath}`);
      
      const response = await fetch(`${config.endpoint}${labelsPath}`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      const labels = lines.slice(1).map(line => parseInt(line.split(',')[1]) || 1); // Assuming CSV format: id,label
      
      console.log(`✅ Labels loaded: ${labels.length} items`);
      return labels;
    } catch (error) {
      console.error('❌ Error getting labels:', error);
      throw new Error(`Không thể lấy labels từ ${labelsPath}`);
    }
  }

  async getProjectionImages(projectionPlots: Record<string, string>, config: ApiConfig): Promise<Record<string, string>> {
    const imageUrls: Record<string, string> = {};
    
    for (const [plotType, plotPath] of Object.entries(projectionPlots)) {
      try {
        console.log(`🖼️ Fetching ${plotType} projection image from: ${plotPath}`);
        
        const response = await fetch(`${config.endpoint}${plotPath}`, {
          method: 'GET',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (!response.ok) {
          console.warn(`⚠️ Failed to fetch ${plotType} image: HTTP ${response.status}`);
          continue;
        }

        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        imageUrls[plotType] = imageUrl;
        
        console.log(`✅ ${plotType} projection image loaded`);
      } catch (error) {
        console.error(`❌ Error fetching ${plotType} projection:`, error);
      }
    }
    
    return imageUrls;
  }

  async getMetricImages(metricPlots: Record<string, string>, config: ApiConfig): Promise<Record<string, string>> {
    const imageUrls: Record<string, string> = {};
    
    for (const [metricType, metricPath] of Object.entries(metricPlots)) {
      try {
        console.log(`📊 Fetching ${metricType} metric plot from: ${metricPath}`);
        
        const response = await fetch(`${config.endpoint}${metricPath}`, {
          method: 'GET',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (!response.ok) {
          console.warn(`⚠️ Failed to fetch ${metricType} plot: HTTP ${response.status}`);
          continue;
        }

        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        imageUrls[metricType] = imageUrl;
        
        console.log(`✅ ${metricType} metric plot loaded`);
      } catch (error) {
        console.error(`❌ Error fetching ${metricType} plot:`, error);
      }
    }
    
    return imageUrls;
  }

  async downloadFile(filePath: string, config: ApiConfig): Promise<Blob> {
    const response = await fetch(filePath, {
      headers: {},
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    return response.blob();
  }
}

export const clusteringApi = new ClusteringApi();
