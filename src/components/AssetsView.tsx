import React, { useState } from 'react';
import { db } from '../db';
import { Asset, AssetType } from '../types';
import { Plus, Tag, HelpCircle, AlertCircle, ShoppingBag, TrendingUp, Calendar, Trash } from 'lucide-react';

interface AssetsProps {
  triggerRefresh: () => void;
}

export function AssetsView({ triggerRefresh }: AssetsProps) {
  const assets = db.getAssets();
  const accounts = db.getAccounts();

  // Creator modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('equipment');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10));
  const [purchasePrice, setPurchasePrice] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState<'active' | 'disposed'>('active');
  const [notes, setNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setName('');
    setAssetType('equipment');
    setPurchaseDate(new Date().toISOString().substring(0, 10));
    setPurchasePrice('');
    setEstimatedValue('');
    setAccountId(accounts.find(a => ['checking', 'savings'].includes(a.account_type))?.id || accounts[0]?.id || '');
    setStatus('active');
    setNotes('');
    setEvidenceUrl('');
    setIsFormOpen(true);
  };

  const handleEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setName(asset.name);
    setAssetType(asset.asset_type);
    setPurchaseDate(asset.purchase_date);
    setPurchasePrice(asset.purchase_price.toString());
    setEstimatedValue(asset.estimated_value.toString());
    setAccountId(asset.account_id || '');
    setStatus(asset.status);
    setNotes(asset.notes);
    setEvidenceUrl(asset.evidence_url || '');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please input an easily recognizable asset name.');
    if (!purchasePrice || Number(purchasePrice) < 0) return alert('Invalid original asset valuation.');
    if (!estimatedValue || Number(estimatedValue) < 0) return alert('Invalid current estimated value.');

    const preparedId = editingId || `asset-${Math.random().toString(36).substring(2, 9)}`;

    db.saveAsset({
      id: preparedId,
      name,
      asset_type: assetType,
      purchase_date: purchaseDate,
      purchase_price: Number(purchasePrice),
      estimated_value: Number(estimatedValue),
      account_id: accountId || null,
      status,
      notes,
      evidence_url: evidenceUrl || null
    });

    setIsFormOpen(false);
    triggerRefresh();
  };

  const handleDelete = (id: string) => {
    if (confirm('Discard this registry asset row?')) {
      const remaining = assets.filter(a => a.id !== id);
      localStorage.setItem('qifinance_assets', JSON.stringify(remaining));
      triggerRefresh();
    }
  };

  // Calculate Asset Totals
  const totalPurchaseBase = assets.reduce((sum, a) => sum + a.purchase_price, 0);
  const totalEstimatedBook = assets.reduce((sum, a) => sum + a.estimated_value, 0);

  return (
    <div className="space-y-6" id="assets_view_block">
       {/* Upper bar */}
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans" id="assets_main_heading">
            Direct ledger Assets & physical holdings
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            CAPITAL REAL EQUIPMENT CODES • VEHICLES, LAPTOPS, PROPERTY VALUATION ADJUSTS
          </p>
        </div>
        <button 
          onClick={handleOpenCreateForm}
          className="mt-3 sm:mt-0 flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm font-sans focus:outline-none cursor-pointer"
          id="btn_add_asset"
        >
          <Plus className="w-4 h-4" />
          Add Capital Asset
        </button>
      </div>

      {/* Mini stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="assets_kpi_row">
        <div className="p-4 bg-slate-50 border border-slate-205 rounded-xl flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-450 uppercase font-mono font-bold block">Consolidated Historical Acquisition</span>
            <h3 className="text-lg font-black text-slate-800 font-mono">{formatCurrency(totalPurchaseBase)}</h3>
          </div>
          <ShoppingBag className="w-5 h-5 text-slate-400" />
        </div>

        <div className="p-4 bg-blue-50/30 border border-blue-100 rounded-xl flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-[10px] text-blue-800 uppercase font-mono font-bold block">Current Market Book Valuation</span>
            <h3 className="text-lg font-black text-slate-900 font-mono">{formatCurrency(totalEstimatedBook)}</h3>
          </div>
          <TrendingUp className="w-5 h-5 text-blue-700" />
        </div>
      </div>

      {/* Assets inventory matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="assets_cards_grid">
        {assets.length === 0 ? (
          <div className="col-span-full p-16 text-center bg-white border border-gray-150 rounded-xl text-slate-400 text-xs font-sans">
            No physical hardware equipment or vehicles logged. Let's record your home studio gear or vehicle values!
          </div>
        ) : (
          assets.map(asset => {
            const isDisposed = asset.status === 'disposed';
            const connectedAcct = accounts.find(a => a.id === asset.account_id);
            return (
              <div 
                key={asset.id} 
                className={`p-4 bg-white border rounded-xl flex flex-col justify-between relative ${isDisposed ? 'opacity-65 border-gray-100' : 'border-slate-200'}`}
                id={`asset_card_${asset.id}`}
              >
                <div>
                  <div className="flex justify-between items-start border-b border-gray-50 pb-2">
                    <div>
                      <span className="text-[8px] font-mono leading-none tracking-wider font-bold bg-blue-50 text-blue-800 p-1 rounded uppercase block w-max">
                        {asset.asset_type}
                      </span>
                      <h4 className="text-xs font-bold text-slate-850 mt-1.5">{asset.name}</h4>
                    </div>

                    <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${isDisposed ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 text-emerald-800'}`}>
                      {asset.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-b border-gray-50 pb-3 font-mono">
                    <div>
                      <span className="text-[8px] text-slate-400 font-mono uppercase block">Estimated book</span>
                      <span className="text-xs font-black text-slate-900">{formatCurrency(asset.estimated_value)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] text-slate-400 font-mono uppercase block">Paid historical</span>
                      <span className="text-xs text-slate-650">{formatCurrency(asset.purchase_price)}</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-[10px] text-slate-500 font-mono">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Acquisition Date: {asset.purchase_date}</span>
                    </div>
                    {connectedAcct && (
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span className="truncate">Tied Account: {connectedAcct.name}</span>
                      </div>
                    )}
                  </div>

                  {asset.notes && (
                    <p className="text-[10px] italic text-slate-500 mt-2 bg-slate-50 p-1.5 border border-slate-100 rounded line-clamp-2">
                      &ldquo;{asset.notes}&rdquo;
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 flex justify-end gap-2.5 text-[10px] font-bold uppercase font-mono">
                   {asset.evidence_url && (
                    <a 
                      href={asset.evidence_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="p-1 px-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded"
                    >
                      Audit Scan
                    </a>
                  )}
                  <button 
                    onClick={() => handleEdit(asset)}
                    className="p-1 px-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded cursor-pointer"
                    id={`btn_edit_asset_${asset.id}`}
                  >
                    Modify Value
                  </button>
                  <button 
                    onClick={() => handleDelete(asset.id)}
                    className="p-1 px-[7px] text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    id={`btn_delete_asset_${asset.id}`}
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Asset Form Drawer Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="asset_modal_overlay">
          <div className="bg-white rounded-xl shadow-lg border border-slate-300 w-full max-w-lg overflow-hidden animate-fade-in animate-scale-up" id="asset_modal_content">
             <div className="p-4 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider">
                {editingId ? 'Modify physical asset' : 'Record New physical asset'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
                id="btn_asset_modal_close_upper"
              >
                (✖)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 font-sans" id="asset_modal_form">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Asset Display Name</label>
                  <input 
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Apple Mac Studio 2026 Home Server"
                    className="w-full p-2 text-xs border border-slate-200 rounded"
                    id="asset_field_name"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Holdings Asset Class</label>
                  <select 
                    value={assetType}
                    onChange={e => setAssetType(e.target.value as AssetType)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-800 font-bold"
                    id="asset_field_type"
                  >
                    <option value="equipment">Office Equipment / Computing</option>
                    <option value="vehicle">Motorized Vehicle</option>
                    <option value="electronics">General Gadgets & Electronics</option>
                    <option value="property">Leases & Property titles</option>
                    <option value="cash_value">Annuities & Cash Valued items</option>
                    <option value="other">General Other assets</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Acquisition date</label>
                  <input 
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded"
                    id="asset_field_date"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Cost of Purchase ($ USD)</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded font-mono font-bold"
                    id="asset_field_cost"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Mark Estimated Valuation ($ USD)</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={estimatedValue}
                    onChange={e => setEstimatedValue(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded font-mono font-bold"
                    id="asset_field_est"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Tied banking account</label>
                  <select 
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
                    id="asset_field_acct"
                  >
                    <option value="">-- No connected account --</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Holding status</label>
                  <select 
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white"
                    id="asset_field_status"
                  >
                    <option value="active">Active Hold</option>
                    <option value="disposed">Disposed / Liquidated / Donated</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Purchase proof receipt scan URL</label>
                  <input 
                    type="url"
                    value={evidenceUrl}
                    onChange={e => setEvidenceUrl(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded text-slate-800"
                    placeholder="https://scans-evidence.com/macstudio-invoice.pdf"
                    id="asset_field_evidence"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Asset comments and notes</label>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Depreciations, serial codes, physical hardware insurance identifiers..."
                    className="w-full p-2 text-xs border border-slate-200 rounded h-16 resize-none focus:outline-none"
                    id="asset_field_notes"
                  />
                </div>
              </div>

               <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 px-4 border border-slate-200 rounded hover:bg-slate-50 font-semibold font-sans"
                  id="btn_asset_form_cancel"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="p-2 px-5 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white rounded font-bold font-sans cursor-pointer"
                  id="btn_asset_form_submit"
                >
                  Confirm Asset inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
