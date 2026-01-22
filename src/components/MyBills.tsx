import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Sparkles, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Bill, SuggestedVendor } from '@/types/bills';
import { formatCurrency } from '@/utils/financeUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  /** optional: used to show/clear vendor ignore list */
  ignoredVendorCount?: number;
  onRestoreIgnoredVendors?: () => void;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function BillsManagerContent(props: Omit<MyBillsProps, 'ignoredVendorCount' | 'onRestoreIgnoredVendors'> & {
  maxHeight?: string | null;
}) {
  const {
    bills,
    suggestedVendors,
    onAddBill,
    onUpdateBill,
    onRemoveBill,
    onAddFromSuggestion,
    onDismissSuggestion,
    maxHeight = '300px',
  } = props;

  const useSectionScrollAreas = maxHeight !== null;

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
    <div>
      {/* Suggestions Section */}
      {suggestedVendors.length > 0 && (
        <Collapsible open={showSuggestions} onOpenChange={setShowSuggestions} className="mb-4">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="w-full flex items-center justify-between p-2 h-auto bg-primary/5 hover:bg-primary/10 rounded-lg">
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
              {useSectionScrollAreas ? (
                <ScrollArea className="mt-2" style={{ height: maxHeight }}>
                  <div className="space-y-2 pr-4">
                    {suggestedVendors.map((suggestion) => (
                      <div
                        key={suggestion.vendor}
                        className="flex flex-col items-stretch justify-between gap-2 p-2 rounded-lg bg-muted/50 border border-border md:flex-row md:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" title={suggestion.vendor}>
                            {suggestion.vendor}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ~{formatCurrency(suggestion.avgAmount)} • {suggestion.occurrences}x seen • ~{getOrdinal(suggestion.suggestedDueDay)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 flex-shrink-0 sm:flex-row sm:items-center sm:justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 px-3 w-full sm:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddFromSuggestion(suggestion);
                              toast.success('Added to My Bills', { description: suggestion.vendor });
                            }}
                          >
                            <Plus className="w-4 h-4" />
                            <span className="ml-1 text-xs">Add</span>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 w-full sm:w-auto text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismissSuggestion(suggestion.vendor);
                              toast.message('Declined suggestion', { description: suggestion.vendor });
                            }}
                            title="Decline suggestion"
                          >
                            <X className="w-4 h-4" />
                            <span className="ml-1 text-xs">Decline</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="mt-2 space-y-2 pr-4">
                  {suggestedVendors.map((suggestion) => (
                    <div
                      key={suggestion.vendor}
                      className="flex flex-col items-stretch justify-between gap-2 p-2 rounded-lg bg-muted/50 border border-border md:flex-row md:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" title={suggestion.vendor}>
                          {suggestion.vendor}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ~{formatCurrency(suggestion.avgAmount)} • {suggestion.occurrences}x seen • ~{getOrdinal(suggestion.suggestedDueDay)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0 sm:flex-row sm:items-center sm:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 px-3 w-full sm:w-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddFromSuggestion(suggestion);
                            toast.success('Added to My Bills', { description: suggestion.vendor });
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          <span className="ml-1 text-xs">Add</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-3 w-full sm:w-auto text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismissSuggestion(suggestion.vendor);
                            toast.message('Declined suggestion', { description: suggestion.vendor });
                          }}
                          title="Decline suggestion"
                        >
                          <X className="w-4 h-4" />
                          <span className="ml-1 text-xs">Decline</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            <p className="text-xs text-muted-foreground text-center mt-2">
              {suggestedVendors.length} vendor{suggestedVendors.length !== 1 ? 's' : ''} suggested
            </p>
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
          {useSectionScrollAreas ? (
            <ScrollArea className="mt-2" style={{ height: maxHeight }}>
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
            </ScrollArea>
          ) : (
            <div className="mt-2 space-y-2">
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
          )}
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
  ignoredVendorCount,
  onRestoreIgnoredVendors,
}: MyBillsProps) {
  const activeBills = bills.filter(b => b.active);

  return (
    <div className="stat-card border-2 border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">My Bills</h3>
          {typeof ignoredVendorCount === 'number' && ignoredVendorCount > 0 && (
            <Badge variant="outline" className="font-mono" title="Vendors ignored so they won't be suggested again">
              {ignoredVendorCount} ignored
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {activeBills.length} active
          </Badge>

          {onRestoreIgnoredVendors && (ignoredVendorCount || 0) > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => onRestoreIgnoredVendors()}
              title="Restore ignored vendors (they may show up as suggestions again)"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="secondary" className="h-8 px-2" title="Open full Bills Manager">
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Bills Manager</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Add/decline suggestions, edit due days/amounts, and remove bills (removal also prevents re-suggestions).
                </p>
              </SheetHeader>

              <BillsManagerContent
                bills={bills}
                suggestedVendors={suggestedVendors}
                onAddBill={onAddBill}
                onUpdateBill={onUpdateBill}
                onRemoveBill={onRemoveBill}
                onAddFromSuggestion={onAddFromSuggestion}
                onDismissSuggestion={onDismissSuggestion}
                maxHeight={null}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Compact sidebar view */}
      <BillsManagerContent
        bills={bills}
        suggestedVendors={suggestedVendors}
        onAddBill={onAddBill}
        onUpdateBill={onUpdateBill}
        onRemoveBill={onRemoveBill}
        onAddFromSuggestion={onAddFromSuggestion}
        onDismissSuggestion={onDismissSuggestion}
        maxHeight="300px"
      />
    </div>
  );
}
