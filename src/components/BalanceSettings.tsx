import { useState, useEffect } from 'react';
import { Settings, DollarSign, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatCurrency } from '@/utils/financeUtils';

interface BalanceSettingsProps {
  startingBalance: number;
  lowBalanceThreshold: number;
  onStartingBalanceChange: (value: number) => void;
  onThresholdChange: (value: number) => void;
}

export function BalanceSettings({
  startingBalance,
  lowBalanceThreshold,
  onStartingBalanceChange,
  onThresholdChange,
}: BalanceSettingsProps) {
  const [localBalance, setLocalBalance] = useState(startingBalance.toString());
  const [localThreshold, setLocalThreshold] = useState(lowBalanceThreshold.toString());

  useEffect(() => {
    setLocalBalance(startingBalance.toString());
    setLocalThreshold(lowBalanceThreshold.toString());
  }, [startingBalance, lowBalanceThreshold]);

  const handleBalanceBlur = () => {
    const value = parseFloat(localBalance) || 0;
    onStartingBalanceChange(value);
  };

  const handleThresholdBlur = () => {
    const value = parseFloat(localThreshold) || 0;
    onThresholdChange(value);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Balance Settings</h4>
          
          <div className="space-y-2">
            <Label htmlFor="starting-balance" className="text-xs flex items-center gap-2">
              <DollarSign className="w-3 h-3" />
              Starting Balance
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="starting-balance"
                type="number"
                value={localBalance}
                onChange={(e) => setLocalBalance(e.target.value)}
                onBlur={handleBalanceBlur}
                className="pl-7 font-mono"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Balance before oldest transaction
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="threshold" className="text-xs flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Low Balance Alert
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="threshold"
                type="number"
                value={localThreshold}
                onChange={(e) => setLocalThreshold(e.target.value)}
                onBlur={handleThresholdBlur}
                className="pl-7 font-mono"
                placeholder="500"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Highlight rows when balance drops below this
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Current threshold: {formatCurrency(lowBalanceThreshold)}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
