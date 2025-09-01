import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useClusteringStore } from "@/lib/clustering-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudUpload, Database, FileText, CheckCircle } from "lucide-react";

interface FileUploadZoneProps {
  type: "embeddings" | "info";
  title: string;
  description: string;
  icon: string;
  "data-testid": string;
}

export default function FileUploadZone({ type, title, description, icon, "data-testid": testId }: FileUploadZoneProps) {
  // Don't render anything for embeddings type
  if (type === "embeddings") {
    return null;
  }

  const { embeddingsFile, infoFile, uploadFile, fileMetadata } = useClusteringStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const currentFile = infoFile;
  const currentMetadata = currentFile ? fileMetadata[currentFile.name] : null;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadFile(acceptedFiles[0], type);
    }
  }, [type, uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const IconComponent = icon === "cloud-upload" ? CloudUpload : Database;

  return (
    <div className="space-y-2">
      <Card
        {...getRootProps()}
        className={`p-6 text-center cursor-pointer transition-colors border-2 border-dashed ${
          isDragActive 
            ? 'border-primary bg-blue-50' 
            : currentFile 
              ? 'border-green-300 bg-green-50'
              : 'border-muted-foreground/25 hover:border-primary'
        }`}
        data-testid={testId}
      >
        <input {...getInputProps()} />
        <IconComponent className={`h-8 w-8 mx-auto mb-3 ${
          currentFile ? 'text-green-500' : 'text-muted-foreground'
        }`} />
        <p className="text-sm font-medium text-foreground mb-1">{title}</p>
        <p className="text-xs text-muted-foreground mb-1">{description}</p>
        <p className="text-xs text-orange-600 mb-3">Tùy chọn - có thể bỏ trống</p>
        {currentFile ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <FileText className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-700 font-medium">{currentFile.name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-primary border-primary hover:bg-primary hover:text-white"
              data-testid={`button-change-${type}`}
            >
              Change File
            </Button>
          </div>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/90"
            data-testid={`button-choose-${type}`}
          >
            Choose File
          </Button>
        )}
      </Card>

      {/* File Preview */}
      {currentMetadata && (
        <Card className="p-3 bg-muted/50">
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm space-y-1">
              <div className="font-medium text-foreground">File validated</div>
              <div className="text-muted-foreground">
                {currentMetadata.rowCount.toLocaleString()} rows, {currentMetadata.columnCount} columns
              </div>
              <div className="text-muted-foreground">
                Delimiter: "{currentMetadata.delimiter}" | Header: {currentMetadata.hasHeader ? "Yes" : "No"}
              </div>
              {currentMetadata.numericColumns.length > 0 && (
                <div className="text-muted-foreground">
                  Numeric columns: {currentMetadata.numericColumns.length}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
