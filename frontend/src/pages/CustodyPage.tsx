import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  Lock,
  ArrowRight,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Package,
  Layers,
  MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Report, CustodyRecord, StorageLocation, ReturnRecord, User as UserType } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const CustodyPage: React.FC = () => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'INTAKE' | 'VAULT' | 'RETURNS'>('INTAKE');

  const [intakeItems, setIntakeItems] = useState<Report[]>([]);
  const [vaultItems, setVaultItems] = useState<Report[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnRecord[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // Intake Modal
  const [selectedIntake, setSelectedIntake] = useState<Report | null>(null);
  const [intakeStorageId, setIntakeStorageId] = useState<number | ''>('');
  const [intakeNotes, setIntakeNotes] = useState('');

  // Transfer Modal
  const [selectedVaultItem, setSelectedVaultItem] = useState<Report | null>(null);
  const [newCustodianId, setNewCustodianId] = useState<number | ''>('');
  const [transferStorageId, setTransferStorageId] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [intakeRes, vaultRes, returnsRes, stores, staff] = await Promise.all([
        api.getReports({ awaiting_handover: true, page_size: 50 }),
        api.getReports({ status: 'IN_CUSTODY', page_size: 50 }),
        api.getReturns(),
        api.getStorageLocations(),
        api.getUsersDirectory(undefined, 'TEACHER'),
      ]);
      setIntakeItems(intakeRes.items);
      setVaultItems(vaultRes.items);
      setReturnRecords(returnsRes);
      setStorageLocations(stores);
      setStaffUsers(staff);
      if (stores.length > 0) {
        setIntakeStorageId(stores[0].id);
        setTransferStorageId(stores[0].id);
      }
      if (staff.length > 0) {
        setNewCustodianId(staff[0].id);
      }
    } catch (err) {
      console.error('Failed to load custody data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirmIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntake || !intakeStorageId) return;

    try {
      await api.confirmHandover(selectedIntake.id, {
        storage_location_id: Number(intakeStorageId),
        handover_notes: intakeNotes.trim() || undefined,
      });
      setSelectedIntake(null);
      setIntakeNotes('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Intake failed');
    }
  };

  const handleTransferCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVaultItem || !newCustodianId) return;

    try {
      await api.transferCustody(selectedVaultItem.id, {
        new_custodian_id: Number(newCustodianId),
        storage_location_id: transferStorageId ? Number(transferStorageId) : undefined,
        handover_notes: transferNotes.trim() || undefined,
      });
      setSelectedVaultItem(null);
      setTransferNotes('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Transfer failed');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 mb-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Chain of Custody Tracking System</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Physical Custody & Vault Management
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Verify physical intake from students, maintain custody in campus vaults, and track transfers.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('INTAKE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'INTAKE'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Physical Intake Queue</span>
          {intakeItems.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-300 text-[10px] font-black flex items-center justify-center">
              {intakeItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('VAULT')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'VAULT'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Active Vault Storage ({vaultItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RETURNS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'RETURNS'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Verified Returns Log ({returnRecords.length})</span>
        </button>
      </div>

      {/* Tab 1: Intake Queue */}
      {activeTab === 'INTAKE' && (
        <div className="space-y-4">
          {intakeItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center max-w-md mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">All Handover Intakes Complete</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                There are currently no found items waiting for physical faculty reception.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {intakeItems.map((item) => (
                <div key={item.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">{item.report_number}</span>
                      <StatusBadge status={item.status} size="sm" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{item.item?.item_name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{item.detailed_description}</p>
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/40">
                      Found at: <strong>{item.location?.name}</strong> on {new Date(item.report_date).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Link to={`/reports/${item.id}`} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
                      View full report
                    </Link>
                    <button
                      onClick={() => setSelectedIntake(item)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors"
                    >
                      Verify & Receive Item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Active Vault */}
      {activeTab === 'VAULT' && (
        <div className="space-y-4">
          {vaultItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center max-w-md mx-auto">
              <Package className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Items in Custody</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                The storage vault currently has no active unreturned items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vaultItems.map((item) => (
                <div key={item.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">{item.report_number}</span>
                      <StatusBadge status={item.status} size="sm" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{item.item?.item_name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Custodian: {item.receiving_teacher?.full_name || 'Staff'}</p>
                    <div className="mt-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                      Discovery Area: {item.location?.name}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setSelectedVaultItem(item)}
                      className="flex-1 py-1.5 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold text-center transition-colors"
                    >
                      Transfer Custody
                    </button>
                    <Link
                      to={`/reports/${item.id}`}
                      className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold text-center transition-colors"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Verified Returns Log */}
      {activeTab === 'RETURNS' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Immutable Return & Handover Log
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Report / Item</th>
                  <th className="py-3 px-4">Released By (Faculty)</th>
                  <th className="py-3 px-4">Collected By (Student)</th>
                  <th className="py-3 px-4">Verification Check</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {returnRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      No return transactions logged yet.
                    </td>
                  </tr>
                ) : (
                  returnRecords.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <Link to={`/reports/${ret.report_id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">
                          Report #{ret.report_id}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {ret.releasing_teacher?.full_name || 'Staff Member'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {ret.collecting_student?.full_name || 'Student'} ({ret.collecting_student?.institutional_id})
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-[11px]">
                          {ret.verification_method.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {new Date(ret.returned_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Intake */}
      {selectedIntake && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Confirm Physical Item Intake</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Confirm receipt of item #{selectedIntake.report_number} into faculty custody and secure it in a vault.
            </p>

            <form onSubmit={handleConfirmIntake} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Storage Vault Location *</label>
                <select
                  value={intakeStorageId}
                  onChange={(e) => setIntakeStorageId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                >
                  {storageLocations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.building} {st.room_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Intake Remarks</label>
                <textarea
                  rows={2}
                  value={intakeNotes}
                  onChange={(e) => setIntakeNotes(e.target.value)}
                  placeholder="Record condition upon physical reception..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIntake(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  Confirm Intake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Custody Transfer */}
      {selectedVaultItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Transfer Custody of Item</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Transfer physical custody of #{selectedVaultItem.report_number} ({selectedVaultItem.item?.item_name}) to another faculty member.
            </p>

            <form onSubmit={handleTransferCustody} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">New Staff Custodian *</label>
                <select
                  value={newCustodianId}
                  onChange={(e) => setNewCustodianId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                >
                  {staffUsers.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} ({st.institutional_id}) - {st.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Storage Location</label>
                <select
                  value={transferStorageId}
                  onChange={(e) => setTransferStorageId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="">Keep current storage location</option>
                  {storageLocations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.building})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Transfer Notes *</label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Reason for transfer (e.g. shift change, central security deposit)..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVaultItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
