import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseCSV } from '@/utils/financeUtils';

interface CSVUploaderProps {
  onUpload: (content: string) => void;
  hasData: boolean;
}

export function CSVUploader({ onUpload, hasData }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'reading' | 'parsing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateCSV = (content: string): { ok: true; count: number } | { ok: false; error: string } => {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { ok: false, error: 'CSV appears to be empty.' };

    const headerWindow = lines.slice(0, 25).map((l) => l.toLowerCase());
    
    // Chase bank account format: Details,Posting Date,Description,Amount,Type,Balance
    const bankHeaderLine = headerWindow.find((l) => l.startsWith('details,') && l.includes('posting date'));
    
    // Chase credit card format: Transaction Date,Post Date,Description,Category,Type,Amount
    const chaseCardHeaderLine = headerWindow.find((l) => 
      l.includes('transaction date') && l.includes('post date') && l.includes('amount')
    );
    
    // QuickBooks format
    const qbHeaderLine = headerWindow.find((l) => l.includes('transaction type') && l.includes('account name'));

    if (!bankHeaderLine && !qbHeaderLine && !chaseCardHeaderLine) {
      return {
        ok: false,
        error:
          'Unrecognized CSV format. Expected a Chase bank/credit card export or QuickBooks Transaction List by Date export.',
      };
    }

    // Only validate required headers for bank format (credit card and QB have different structure)
    if (bankHeaderLine) {
      const headers = bankHeaderLine.split(',').map((h) => h.replace(/"/g, '').trim());
      const required = ['details', 'posting date', 'description', 'amount', 'type', 'balance'];
      const missing = required.filter((r) => !headers.some((h) => h.toLowerCase() === r));
      if (missing.length) {
        return { ok: false, error: `Missing required header(s): ${missing.join(', ')}` };
      }
    }

    try {
      const parsed = parseCSV(content);
      if (!parsed.length) return { ok: false, error: 'Parsed 0 transactions. Check the CSV contents/headers.' };
      return { ok: true, count: parsed.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Could not parse CSV: ${message}` };
    }
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus('error');
      setStatusMessage('Please upload a .csv file.');
      return;
    }

    const reader = new FileReader();
    setStatus('reading');
    setStatusMessage('Reading file…');
    reader.onload = (e) => {
      const content = e.target?.result as string;

      setStatus('parsing');
      setStatusMessage('Parsing…');

      const validation = validateCSV(content);
      if (validation.ok === false) {
        setStatus('error');
        setStatusMessage(validation.error);
        return;
      }

      setFileName(file.name);
      setStatus('success');
      setStatusMessage(`Parsed ${validation.count} transactions.`);
      
      // Call onUpload synchronously and ensure React sees the update
      console.log('[CSVUploader] Uploading CSV with', validation.count, 'transactions');
      onUpload(content);
    };
    reader.onerror = () => {
      setStatus('error');
      setStatusMessage('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFile]);

  const handleClear = useCallback(() => {
    setFileName(null);
    setStatus('idle');
    setStatusMessage('');
  }, []);

  if (hasData) {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <span className="flex-1 text-sm font-medium truncate">
            {fileName || 'Transaction Data Loaded'}
          </span>
          {fileName && (
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleClick}>
          <Upload className="w-4 h-4 mr-1" />
          Replace Data
        </Button>
        {status !== 'idle' && (
          <p
            className={
              status === 'error'
                ? 'text-xs text-expense'
                : 'text-xs text-muted-foreground'
            }
          >
            {statusMessage}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          className="hidden"
        />
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
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleInputChange}
        className="hidden"
      />
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
          Supports Chase bank, credit card, and QuickBooks CSV formats
        </p>
        {status !== 'idle' && (
          <p
            className={
              status === 'error'
                ? 'text-sm text-expense'
                : 'text-sm text-muted-foreground'
            }
          >
            {statusMessage}
          </p>
        )}
      </div>
    </div>
  );
}
