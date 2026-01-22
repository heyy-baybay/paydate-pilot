import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { Bill, SuggestedVendor } from '@/types/bills';
import { formatCurrency } from '@/utils/financeUtils';
import { getOrdinal } from '@/hooks/useFinanceCalculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MyBillsProps {
  bills: Bill[];
  suggestedVendors: SuggestedVendor[];
  onAddBill: (bill: Omit<Bill, 'id'>) => void;
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
  onRemoveBill: (id: string) => void;
  onAddFromSuggestion: (suggestion: SuggestedVendor) => void;
  onDismissSuggestion: (vendor: string) => void;
  ignoredVendorCount?: number;
  onRestoreIgnoredVendors?: () => void;
}

interface BillsManagerContentProps {
  bills: Bill[];
  suggestedVendors: SuggestedVendor[];
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
  onRemoveBill: (id: string) => void;
  onAddFromSuggestion: (suggestion: SuggestedVendor) => void;
  onDismissSuggestion: (vendor: string) => void;
}

function BillsManagerContent({
  bills,
  suggestedVendors,
  onUpdateBill,
  onRemoveBill,
  onAddFromSuggestion,
  onDismissSuggestion,
}: BillsManagerContentProps) {
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showBills, setShowBills] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ vendor: '', amount: '', dueDay: '' });

  const startEdit = (bill: Bill) => {
    setEditingId(bill.id);
    setEditForm({
      vendor: bill.vendor,
      amount: String(bill.amount),
      dueDay: String(bill.dueDay),
    });
  };

  const saveEdit = (id: string) => {
    onUpdateBill(id, {
      vendor: editForm.vendor,
      amount: parseFloat(editForm.amount) || 0,
      dueDay: parseInt(editForm.dueDay) || 1,
    });
    setEditingId(null);
  };

  const activeBills = bills.filter((b) => b.active);

  return (
    <div className="space-y-4">
      {/* Suggestions Section */}
      {suggestedVendors.length > 0 && (
        <Collapsible open={showSuggestions} onOpenChange={setShowSuggestions}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full flex items-center justify-between p-3 h-auto bg-primary/5 hover:bg-primary/10 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {suggestedVendors.length} Suggested Bill
                  {suggestedVendors.length !== 1 ? 's' : ''}
                </span>
              </div>
              {showSuggestions ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-3 space-y-2">
              {suggestedVendors.map((suggestion) => (
                <div
                  key={suggestion.vendor}
                  className="flex flex-col gap-2 p-3 rounded-lg bg-muted/50 border border-border sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" title={suggestion.vendor}>
                      {suggestion.vendor}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ~{formatCurrency(suggestion.avgAmount)} • {suggestion.occurrences}x seen •{' '}
                      {getOrdinal(suggestion.suggestedDueDay)}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 px-3 flex-1 sm:flex-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddFromSuggestion(suggestion);
                        toast.success('Added to My Bills', { description: suggestion.vendor });
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissSuggestion(suggestion.vendor);
                        toast.message('Declined suggestion', { description: suggestion.vendor });
                      }}
                      title="Decline suggestion"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Active Bills */}
      <Collapsible open={showBills} onOpenChange={setShowBills}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-3 h-auto"
          >
            <span className="text-sm font-medium">
              {activeBills.length} Active Bill{activeBills.length !== 1 ? 's' : ''}
            </span>
            {showBills ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-2">
            {activeBills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No bills added yet. Add from suggestions above or create manually.
              </p>
            ) : (
              activeBills.map((bill) => (
                <div key={bill.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                  {editingId === bill.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editForm.vendor}
                        onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                        placeholder="Vendor name"
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                          placeholder="Amount"
                          className="h-8 text-sm flex-1"
                        />
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={editForm.dueDay}
                          onChange={(e) => setEditForm({ ...editForm, dueDay: e.target.value })}
                          placeholder="Day"
                          className="h-8 text-sm w-16"
                        />
                      </div>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-primary"
                          onClick={() => saveEdit(bill.id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" title={bill.vendor}>
                          {bill.vendor}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(bill.amount)} • {getOrdinal(bill.dueDay)} of month
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => startEdit(bill)}
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-expense"
                          onClick={() => onRemoveBill(bill.id)}
                          title="Remove (also prevents it from being suggested again)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function MyBills({
  bills,
  suggestedVendors,
  onAddBill,
  onUpdateBill,
  onRemoveBill,
  onAddFromSuggestion,
  onDismissSuggestion,
  ignoredVendorCount = 0,
  onRestoreIgnoredVendors,
}: MyBillsProps) {
  const activeBills = bills.filter((b) => b.active);
  const totalMonthly = activeBills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">My Bills</h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {formatCurrency(totalMonthly)}/mo
          </Badge>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  <span>Bills Manager</span>
                  {ignoredVendorCount > 0 && onRestoreIgnoredVendors && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={onRestoreIgnoredVendors}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore {ignoredVendorCount} ignored
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6">
                <BillsManagerContent
                  bills={bills}
                  suggestedVendors={suggestedVendors}
                  onUpdateBill={onUpdateBill}
                  onRemoveBill={onRemoveBill}
                  onAddFromSuggestion={onAddFromSuggestion}
                  onDismissSuggestion={onDismissSuggestion}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Active Bills</span>
          <span className="font-medium">{activeBills.length}</span>
        </div>
        {suggestedVendors.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Suggestions</span>
            <Badge variant="outline" className="text-xs">
              {suggestedVendors.length} pending
            </Badge>
          </div>
        )}
      </div>

      {/* Top 3 Bills Preview */}
      {activeBills.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {activeBills.slice(0, 3).map((bill) => (
            <div key={bill.id} className="flex items-center justify-between text-sm">
              <span className="truncate flex-1 mr-2" title={bill.vendor}>
                {bill.vendor}
              </span>
              <span className="font-mono text-muted-foreground">{formatCurrency(bill.amount)}</span>
            </div>
          ))}
          {activeBills.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              +{activeBills.length - 3} more bills
            </p>
          )}
        </div>
      )}
    </div>
  );
}
