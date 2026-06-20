import React, { useState, useEffect } from "react";
import { Account } from "../types";
import { Upload, Check, AlertCircle, RefreshCw, Save, X } from "lucide-react";
import Papa from "papaparse";
import { db } from "../db";

interface ImportCSVModalProps {
  account: Account;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportCSVModal({
  account,
  onClose,
  onSuccess,
}: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const [mapping, setMapping] = useState<{
    date: string;
    description: string;
    amount: string;
    memo: string;
  }>({
    date: account.csv_mapping?.date || "",
    description: account.csv_mapping?.description || "",
    amount: account.csv_mapping?.amount || "",
    memo: account.csv_mapping?.memo || "",
  });

  const [saveMapping, setSaveMapping] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      parseFile(e.target.files[0]);
    }
  };

  const parseFile = (file: File) => {
    setIsParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsParsing(false);
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
        }
        setPreviewData(results.data.slice(0, 3));

        // Auto map if we don't have mappings
        if (!mapping.date && results.meta.fields) {
          const m = { ...mapping };
          const f = results.meta.fields.map((k) => k.toLowerCase());

          const dateMatch = results.meta.fields.find((k) =>
            k.toLowerCase().includes("date"),
          );
          if (dateMatch) m.date = dateMatch;

          const descMatch = results.meta.fields.find(
            (k) =>
              k.toLowerCase().includes("description") ||
              k.toLowerCase().includes("payee") ||
              k.toLowerCase().includes("name"),
          );
          if (descMatch) m.description = descMatch;

          const amountMatch = results.meta.fields.find((k) =>
            k.toLowerCase().includes("amount"),
          );
          if (amountMatch) m.amount = amountMatch;

          setMapping(m);
        }
      },
      error: (error) => {
        setIsParsing(false);
        setError("Failed to parse CSV: " + error.message);
      },
    });
  };

  const handleImport = () => {
    if (!mapping.date || !mapping.amount) {
      setError("Date and Amount mappings are required.");
      return;
    }

    setIsImporting(true);
    setError("");

    // Parse the entire file again to ensure we get all data properly
    Papa.parse(file!, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data.map((row: any) => {
            const dateStr = row[mapping.date];
            // Format date to YYYY-MM-DD
            let formattedDate = dateStr;
            try {
              // rough standard date conversion
              const d = new Date(dateStr);
              if (!isNaN(d.valueOf())) {
                formattedDate = d.toISOString().split("T")[0];
              }
            } catch (e) {}

            const desc = mapping.description
              ? row[mapping.description]
              : "Imported";
            const memo = mapping.memo ? row[mapping.memo] : "";

            // Clean amount string (remove commas, currency symbols)
            let amtStr = row[mapping.amount] || "";
            if (typeof amtStr === "string") {
              amtStr = amtStr.replace(/[$,]/g, "").trim();
            }

            const amount = parseFloat(amtStr);
            if (isNaN(amount))
              throw new Error(`Invalid amount found: ${row[mapping.amount]}`);

            return {
              date: formattedDate,
              description: desc,
              amount,
              memo,
            };
          });

          // Save to system
          db.saveImportedData(account.id, rows, file!.name, file!.name);

          // Optionally save mapping to account
          if (saveMapping) {
            db.saveAccount({
              ...account,
              csv_mapping: mapping,
            });
          }

          setIsImporting(false);
          onSuccess();
        } catch (err: any) {
          setIsImporting(false);
          setError(err.message || "Error importing records");
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
              Import Ledger Data
            </h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Target: {account.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded border border-rose-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!file ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center hover:bg-slate-50 transition-colors">
              <input
                type="file"
                accept=".csv"
                id="csv_upload"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="csv_upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-700">
                  Click to upload CSV
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Standard bank export format
                </p>
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {(file.size / 1024).toFixed(1)} KB • Parsing complete
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setHeaders([]);
                    setPreviewData([]);
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider font-mono"
                >
                  Change File
                </button>
              </div>

              <div>
                <h3 className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">
                  Field Mapping
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                      Transaction Date *
                    </label>
                    <select
                      value={mapping.date}
                      onChange={(e) =>
                        setMapping({ ...mapping, date: e.target.value })
                      }
                      className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Field --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                      Amount *
                    </label>
                    <select
                      value={mapping.amount}
                      onChange={(e) =>
                        setMapping({ ...mapping, amount: e.target.value })
                      }
                      className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Field --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                      Description / Payee
                    </label>
                    <select
                      value={mapping.description}
                      onChange={(e) =>
                        setMapping({ ...mapping, description: e.target.value })
                      }
                      className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- None --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                      Memo / Notes
                    </label>
                    <select
                      value={mapping.memo}
                      onChange={(e) =>
                        setMapping({ ...mapping, memo: e.target.value })
                      }
                      className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- None --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 ml-1">
                <input
                  type="checkbox"
                  id="save_mapping"
                  checked={saveMapping}
                  onChange={(e) => setSaveMapping(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="save_mapping"
                  className="text-xs text-slate-600"
                >
                  Save this mapping for future imports to {account.name}
                </label>
              </div>

              {previewData.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">
                    Preview Sample
                  </h3>
                  <div className="overflow-x-auto border border-slate-100 rounded-lg">
                    <table className="w-full text-left text-[10px] font-mono">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-2 border-b border-slate-100">
                            Date
                          </th>
                          <th className="p-2 border-b border-slate-100">
                            Desc
                          </th>
                          <th className="p-2 border-b border-slate-100 text-right">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, i) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="p-2">
                              {mapping.date ? row[mapping.date] : "-"}
                            </td>
                            <td className="p-2 truncate max-w-[150px]">
                              {mapping.description
                                ? row[mapping.description]
                                : "-"}
                            </td>
                            <td className="p-2 text-right">
                              {mapping.amount ? row[mapping.amount] : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 uppercase tracking-wider flex items-center"
            disabled={isImporting}
          >
            Cancel
          </button>

          <button
            onClick={handleImport}
            disabled={!file || !mapping.date || !mapping.amount || isImporting}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded uppercase tracking-wider transition-colors flex items-center gap-2"
          >
            {isImporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isImporting ? "Importing..." : "Process Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
