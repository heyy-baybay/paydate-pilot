import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Bill, SuggestedVendor } from '@/types/bills';
import { formatCurrency } from '@/utils/financeUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface MyBillsProps {
  bills: Bill[];
  suggestedVendors: SuggestedVendor[];
  onAddBill: (bill: Omit<Bill, 'id'>) => void;
  onUpdateBill: (id: string, updates: Partial<Bill>) => void;
  onRemoveBill: (id: string) => void;
  onAddFromSuggestion: (suggestion: SuggestedVendor) => void;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function MyBills({
  bills,
  suggestedVendors,
  onAddBill,
  onUpdateBill,
  onRemoveBill,
  onAddFromSuggestion,
}: MyBillsProps) {
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

  const activeBills = bills.filter(b => b.active);

  return (
    <div className="stat-card border-2 border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">My Bills</h3>
        <Badge variant="secondary" className="font-mono">
          {activeBills.length} active
        </Badge>
      </div>

      {/* Suggestions Section */}
      {suggestedVendors.length > 0 && (
        <Collapsible open={showSuggestions} onOpenChange={setShowSuggestions} className="mb-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between p-2 h-auto bg-primary/5 hover:bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {suggestedVendors.length} Suggested Bill{suggestedVendors.length !== 1 ? 's' : ''}
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
            <ScrollArea className="max-h-[200px] mt-2">
              <div className="space-y-2">
                {suggestedVendors.slice(0, 10).map((suggestion) => (
                  <div
                    key={suggestion.vendor}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" title={suggestion.vendor}>
                        {suggestion.vendor}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{formatCurrency(suggestion.avgAmount)} • {suggestion.occurrences}x seen • ~{getOrdinal(suggestion.suggestedDueDay)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => onAddFromSuggestion(suggestion)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Active Bills */}
      <Collapsible open={showBills} onOpenChange={setShowBills}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full flex items-center justify-between p-2 h-auto">
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
          <ScrollArea className="max-h-[300px] mt-2">
            <div className="space-y-2">
              {activeBills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No bills added yet. Add from suggestions above or create manually.
                </p>
              ) : (
                activeBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-2 rounded-lg bg-muted/50 border border-border"
                  >
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
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => saveEdit(bill.id)}>
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
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-expense"
                            onClick={() => onRemoveBill(bill.id)}
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
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
