import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CSVUploaderProps {
  onUpload: (content: string) => void;
  hasData: boolean;
}

export function CSVUploader({ onUpload, hasData }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileName(file.name);
      onUpload(content);
    };
    reader.readAsText(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [handleFile]);

  const handleClear = useCallback(() => {
    setFileName(null);
  }, []);

  if (hasData && fileName) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
        <FileSpreadsheet className="w-5 h-5 text-primary" />
        <span className="flex-1 text-sm font-medium truncate">{fileName}</span>
        <Button variant="ghost" size="sm" onClick={handleClick}>
          Replace
        </Button>
        <Button variant="ghost" size="icon" onClick={handleClear}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`upload-zone ${isDragging ? 'dragover' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">Drop your CSV file here</p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse your files
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Supports Chase bank CSV format
        </p>
      </div>
    </div>
  );
}
