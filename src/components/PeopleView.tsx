import React, { useState } from 'react';
import { db } from '../db';
import { Person, PersonType } from '../types';
import { Plus, Search, User, Mail, Phone, Tag, Trash2, HelpCircle } from 'lucide-react';

interface PeopleProps {
  triggerRefresh: () => void;
}

export function PeopleView({ triggerRefresh }: PeopleProps) {
  const people = db.getPeople();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal creator states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [personType, setPersonType] = useState<PersonType>('person');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const filteredPeople = people.filter(p => 
    p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setDisplayName('');
    setPersonType('person');
    setEmail('');
    setPhone('');
    setNotes('');
    setStatus('active');
    setIsFormOpen(true);
  };

  const handleEdit = (p: Person) => {
    setEditingId(p.id);
    setDisplayName(p.display_name);
    setPersonType(p.type);
    setEmail(p.email);
    setPhone(p.phone);
    setNotes(p.notes);
    setStatus(p.status);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return alert('Please input a representative party name.');

    const preparedId = editingId || `p-${Math.random().toString(36).substring(2, 9)}`;

    db.savePerson({
      id: preparedId,
      display_name: displayName,
      type: personType,
      email,
      phone,
      notes,
      status
    });

    setIsFormOpen(false);
    triggerRefresh();
  };

  return (
    <div className="space-y-6" id="people_view_block">
      {/* Upper bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans" id="people_main_title">
            Directory of Involved Parties
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            VENDORS, EMPLOYERS, CONTRACT CLIENTS, PLATFORMS & FRIENDS IN AUDITS
          </p>
        </div>
        <button 
          onClick={handleOpenCreateForm}
          className="mt-3 sm:mt-0 flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm font-sans focus:outline-none cursor-pointer"
          id="btn_add_person"
        >
          <Plus className="w-4 h-4" />
          Add Party Directory
        </button>
      </div>

      {/* Directory filters */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200" id="people_filter_box">
        <Search className="w-4 h-4 text-slate-400" />
        <input 
          type="text"
          placeholder="Filter directory list by name, company role, specialized notes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="text-xs text-slate-800 bg-transparent focus:outline-none flex-1 border-none"
          id="people_search_input"
        />
      </div>

      {/* People cards layouts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="people_cards_grid">
        {filteredPeople.map(person => {
          const isActive = person.status === 'active';
          return (
            <div 
              key={person.id} 
              className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-350 hover:shadow-xs transition-all flex flex-col justify-between"
              id={`person_card_${person.id}`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-50 text-slate-700 border border-slate-100 rounded-lg">
                      <User className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 leading-tight">
                        {person.display_name}
                      </h4>
                      <p className="text-[10px] text-slate-450 uppercase font-mono tracking-wider mt-0.5 capitalize">
                        Role: {person.type}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-800'}`}>
                    {person.status}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs border-b border-gray-50 pb-3" id="person_meta_rows">
                  {person.email && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-650 font-sans">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`mailto:${person.email}`} className="hover:underline">{person.email}</a>
                    </div>
                  )}

                  {person.phone && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-650 font-sans">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{person.phone}</span>
                    </div>
                  )}
                </div>

                {person.notes && (
                  <p className="text-[10px] text-slate-500 italic mt-3 bg-slate-50/50 p-2 border border-slate-100 rounded line-clamp-2">
                    &ldquo;{person.notes}&rdquo;
                  </p>
                )}
              </div>

              <div className="mt-4 pt-2.5 border-t border-slate-100 flex justify-end text-[10px] font-bold uppercase font-mono">
                <button 
                  onClick={() => handleEdit(person)}
                  className="px-3 py-1.5 border border-slate-205 text-slate-700 hover:bg-slate-50 rounded cursor-pointer"
                  id={`btn_edit_person_${person.id}`}
                >
                  Modify Metadata
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Person Creator Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="person_modal_overlay">
          <div className="bg-white rounded-xl shadow-lg border border-slate-300 w-full max-w-sm animate-fade-in animate-scale-up" id="person_modal_content">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider">
                {editingId ? 'Modify party catalog' : 'Draft New directory entry'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
                id="btn_person_modal_close_upper"
              >
                (✖)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 font-sans" id="person_modal_form">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Company / Display Name</label>
                <input 
                  type="text"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g., Sarah Jenkins"
                  className="w-full p-2 text-xs border border-slate-200 rounded"
                  id="person_modal_field_name"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Involved Party Role Type</label>
                <select 
                  value={personType}
                  onChange={e => setPersonType(e.target.value as PersonType)}
                  className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-800 font-bold"
                  id="person_modal_field_type"
                >
                  <option value="person">Individual / Person</option>
                  <option value="company">Registered Company</option>
                  <option value="vendor">Service Vendor / Supplier</option>
                  <option value="family">Family Relationship</option>
                  <option value="employer">Payroll Employer</option>
                  <option value="platform">Online Platform / Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Email Channel Address</label>
                <input 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g., payroll@apexcorp.com"
                  className="w-full p-2 text-xs border border-slate-200 rounded"
                  id="person_modal_field_email"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Direct Phone Contact</label>
                <input 
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g., +1 (800) 555-0100"
                  className="w-full p-2 text-xs border border-slate-200 rounded text-slate-800"
                  id="person_modal_field_phone"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Status</label>
                <select 
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full p-2 text-xs border border-slate-200 rounded bg-white"
                  id="person_modal_field_status"
                >
                  <option value="active">Active Directory</option>
                  <option value="inactive">Archived / Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Internal catalog comments</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Consulting tax details, agreement identifiers..."
                  className="w-full p-2 text-xs border border-slate-200 rounded h-16 resize-none focus:outline-none"
                  id="person_modal_field_notes"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 px-4 border border-slate-200 rounded hover:bg-slate-50 font-semibold"
                  id="btn_person_modal_cancel"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="p-2 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold cursor-pointer"
                  id="btn_person_modal_submit"
                >
                  Save Party Directory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
