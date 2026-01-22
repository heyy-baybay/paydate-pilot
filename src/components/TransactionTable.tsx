import { useState } from 'react';
import { ArrowUpDown, Check, X, Download, RefreshCw } from 'lucide-react';
import { Transaction } from '@/types/finance';
import { formatCurrency, formatDate, exportToCSV } from '@/utils/financeUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TransactionTableProps {
  transactions: Transaction[];
  lowBalanceThreshold: number;
}

type SortField = 'date' | 'amount' | 'category';
type SortOrder = 'asc' | 'desc';

export function TransactionTable({ transactions, lowBalanceThreshold }: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleExport = () => {
    const csv = exportToCSV(transactions);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Subscriptions': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      'Fuel': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      'Software': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      'Suppliers': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      'Utilities': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      'Transfers': 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
      'Fees': 'bg-red-500/10 text-red-600 dark:text-red-400',
      'Income': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      'Taxes': 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      'Insurance': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      'Miscellaneous': 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    };
    return colors[category] || colors['Miscellaneous'];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {transactions.length} transactions
        </p>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table className="finance-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="min-w-[250px]">Description</TableHead>
                <TableHead 
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Recurring</TableHead>
                <TableHead 
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-1">
                    Category
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-center">Pay Period</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {sortedTransactions.map((tx, index) => {
                return (
                  <TableRow 
                    key={tx.id}
                    className={`
                      transition-colors
                      ${tx.isRecurring ? 'row-recurring' : ''}
                    `}
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <span className="truncate block" title={tx.description}>
                        {tx.description}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-mono font-medium ${
                      tx.amount >= 0 ? 'amount-positive' : 'amount-negative'
                    }`}>
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground uppercase">
                        {tx.type.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {tx.isRecurring ? (
                        <div className="flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 text-recurring" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getCategoryColor(tx.category)}>
                        {tx.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {tx.payPeriodImpact ? (
                        <Check className="w-4 h-4 text-warning mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/50 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(tx.runningBalance)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
