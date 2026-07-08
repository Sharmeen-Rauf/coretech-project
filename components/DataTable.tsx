"use client";

import React, { useState } from "react";
import { Search, ChevronLeft, ChevronRight, Edit2, Info, ArrowUpDown, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import StatusBadge from "./StatusBadge";

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface Filter {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

interface ActionButton {
  label: string;
  onClick: () => void;
}

interface Pagination {
  current: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
}

interface DataTableProps {
  title: string;
  columns: Column[];
  data: any[];
  isLoading: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  filters?: Filter[];
  actionButton?: ActionButton;
  pagination: Pagination;
  onEditClick?: (row: any) => void;
  onDeleteClick?: (row: any) => void;
  onRowClick?: (row: any) => void;
  onBulkDelete?: (selectedIds: string[]) => void;
  onImportCSV?: (file: File) => void;
  showExport?: boolean;
}

export default function DataTable({
  title,
  columns,
  data,
  isLoading,
  searchPlaceholder = "Search records...",
  onSearch,
  filters = [],
  actionButton,
  pagination,
  onEditClick,
  onDeleteClick,
  onRowClick,
  onBulkDelete,
  onImportCSV,
  showExport = true,
}: DataTableProps) {
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [searchValue, setSearchValue] = useState("");

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const nextSelect: Record<string, boolean> = {};
    if (checked) {
      data.forEach((row, idx) => {
        const rowId = row.id || `row-${idx}`;
        nextSelect[rowId] = true;
      });
    }
    setSelectedRows(nextSelect);
  };

  const handleSelectRow = (rowId: string, checked: boolean) => {
    setSelectedRows((prev) => ({
      ...prev,
      [rowId]: checked,
    }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  const isAllSelected = data.length > 0 && data.every((row, idx) => {
    const rowId = row.id || `row-${idx}`;
    return selectedRows[rowId];
  });

  const isAnySelected = data.some((row, idx) => {
    const rowId = row.id || `row-${idx}`;
    return selectedRows[rowId];
  });

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("No data available to export");
      return;
    }

    const exportHeaders = columns.map(c => c.label);
    const keys = columns.map(c => c.key);

    const csvRows = [];
    csvRows.push(exportHeaders.join(","));

    data.forEach(row => {
      const values = keys.map(key => {
        let val = row[key];
        if (val === undefined || val === null) {
          val = "";
        } else if (typeof val === "object") {
          val = val.name || val.warehouse || JSON.stringify(val);
        }
        const escaped = ("" + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = `${title.toLowerCase().replace(/\s+/g, "_")}_export.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Data exported successfully!");
  };

  const handleBulkDelete = async () => {
    const selectedIds = Object.keys(selectedRows).filter(k => selectedRows[k]);
    if (selectedIds.length === 0) return;

    if (onBulkDelete) {
      onBulkDelete(selectedIds);
      setSelectedRows({});
    } else if (onDeleteClick) {
      if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected items?`)) return;
      
      let successCount = 0;
      for (const id of selectedIds) {
        const row = data.find((r, idx) => (r.id || `row-${idx}`) === id);
        if (row) {
          try {
            await onDeleteClick(row);
            successCount++;
          } catch (e) {
            console.error("Bulk delete item error", e);
          }
        }
      }
      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} items!`);
      }
      setSelectedRows({});
    }
  };

  // Calculate entry range
  const startEntry = (pagination.current - 1) * pagination.perPage + 1;
  const endEntry = Math.min(pagination.current * pagination.perPage, pagination.total);

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] overflow-hidden shadow-sm flex flex-col">
      {/* Header Controls */}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
          {isAnySelected && (
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5 animate-pulse">
              {Object.values(selectedRows).filter(Boolean).length} items selected
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Bulk Actions */}
          {isAnySelected && (onBulkDelete || onDeleteClick) && (
            <button
              onClick={handleBulkDelete}
              className="h-9 px-3 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-[6px] shadow transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          )}

          {/* Import Button */}
          {onImportCSV && (
            <label className="h-9 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-[6px] shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer select-none">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Import</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onImportCSV(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>
          )}

          {/* Export Button */}
          {showExport !== false && (
            <button
              onClick={handleExportCSV}
              className="h-9 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-[6px] shadow transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export</span>
            </button>
          )}

          {/* Action Button */}
          {actionButton && (
            <button
              onClick={actionButton.onClick}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] rounded-[6px] shadow transition-colors flex items-center justify-center animate-in fade-in"
            >
              {actionButton.label}
            </button>
          )}

          {/* Search Field */}
          {onSearch && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={handleSearchChange}
                className="h-9 w-60 pl-9 pr-4 rounded-[6px] border border-slate-200 text-xs text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {/* Filter Row */}
      {filters.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center gap-3">
          {filters.map((filter) => (
            <div key={filter.label} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {filter.label}:
              </span>
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="h-8 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-600 bg-white focus:outline-none focus:border-[#00B4D8]"
              >
                <option value="">All</option>
                {filter.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Table Grid */}
      <div className="flex-1 overflow-x-auto min-w-full">
        <table className="w-full text-left border-collapse select-none">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/30">
              {/* Checkbox Heading */}
              <th className="w-12 px-5 py-3 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="w-3.5 h-3.5 border-slate-300 text-[#00B4D8] focus:ring-[#00B4D8] rounded-[4px]"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.key !== "actions" && (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </div>
                </th>
              ))}
              {(onEditClick || onDeleteClick) && (
                <th className="w-24 px-5 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Pulse Skeleton Lines
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="border-b border-slate-50 animate-pulse">
                  <td className="w-12 py-4 px-5 text-center">
                    <div className="w-3.5 h-3.5 bg-slate-200 rounded mx-auto"></div>
                  </td>
                  {columns.map((col) => (
                    <td key={`skeleton-cell-${col.key}`} className="px-5 py-4">
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                    </td>
                  ))}
                  {(onEditClick || onDeleteClick) && (
                    <td className="px-5 py-4">
                      <div className="h-4 bg-slate-200 rounded w-8 ml-auto"></div>
                    </td>
                  )}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State UI
              <tr>
                <td
                  colSpan={columns.length + ((onEditClick || onDeleteClick) ? 2 : 1)}
                  className="px-5 py-12 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Info className="w-8 h-8 text-slate-300" />
                    <p className="text-xs font-semibold">No records found</p>
                    <p className="text-[10px] text-slate-500">
                      Try adjusting filters or searching for another term.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Active Data Rows
              data.map((row, rowIdx) => {
                const rowId = row.id || `row-${rowIdx}`;
                const isSelected = selectedRows[rowId] || false;
                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors ${
                      isSelected ? "bg-[#F0FAFE]/20" : ""
                    } ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {/* Row Select */}
                    <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                        className="w-3.5 h-3.5 border-slate-300 text-[#00B4D8] focus:ring-[#00B4D8] rounded-[4px]"
                      />
                    </td>
                    {columns.map((col) => {
                      const value = row[col.key];
                      return (
                        <td key={col.key} className="px-5 py-3.5 text-xs text-slate-700 font-medium">
                          {col.render ? (
                            col.render(value, row)
                          ) : col.key === "status" ? (
                            <StatusBadge status={value} />
                          ) : (
                            value ?? <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    {/* Inline Actions */}
                    {(onEditClick || onDeleteClick) && (
                      <td className="px-5 py-3.5 text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {onEditClick && (
                          <button
                            onClick={() => onEditClick(row)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-[#00B4D8] rounded-[6px] transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {onDeleteClick && (
                          <button
                            onClick={() => onDeleteClick(row)}
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-rose-500 rounded-[6px] transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination Controls */}
      {!isLoading && data.length > 0 && (
        <div className="px-5 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Showing {startEntry} to {endEntry} of {pagination.total} entries
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onChange(Math.max(pagination.current - 1, 1))}
              disabled={pagination.current === 1}
              className="h-8 px-2.5 rounded-[6px] border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#00B4D8] hover:text-[#00B4D8] disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-colors flex items-center justify-center gap-1 bg-white select-none"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="text-xs font-bold text-slate-700 px-3 py-1 bg-slate-50 rounded border border-slate-200/50">
              {pagination.current}
            </span>
            <button
              onClick={() =>
                pagination.onChange(
                  Math.min(
                    pagination.current + 1,
                    Math.ceil(pagination.total / pagination.perPage)
                  )
                )
              }
              disabled={pagination.current >= Math.ceil(pagination.total / pagination.perPage)}
              className="h-8 px-2.5 rounded-[6px] border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#00B4D8] hover:text-[#00B4D8] disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-colors flex items-center justify-center gap-1 bg-white select-none"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
