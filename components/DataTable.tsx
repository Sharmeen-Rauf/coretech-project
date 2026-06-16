"use client";

import React, { useState } from "react";
import { Search, ChevronLeft, ChevronRight, Edit2, Info, ArrowUpDown } from "lucide-react";
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
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {Object.values(selectedRows).filter(Boolean).length} items selected
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {/* Action Button */}
          {actionButton && (
            <button
              onClick={actionButton.onClick}
              className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] rounded-[6px] shadow transition-colors flex items-center justify-center"
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
              {onEditClick && (
                <th className="w-20 px-5 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                  {onEditClick && (
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
                  colSpan={columns.length + (onEditClick ? 2 : 1)}
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
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors ${
                      isSelected ? "bg-[#F0FAFE]/20" : ""
                    }`}
                  >
                    {/* Row Select */}
                    <td className="px-5 py-3.5 text-center">
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
                    {onEditClick && (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => onEditClick(row)}
                          className="p-1 text-[#00B4D8] hover:text-[#0077B6] hover:bg-[#F0FAFE] rounded transition-all duration-200 inline-flex"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
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
