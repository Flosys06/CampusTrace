import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload,
  X,
  PlusCircle,
  Shield,
  Calendar,
  Clock,
  MapPin,
  Tag,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Package,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Category, CampusLocation, StorageLocation, User } from '../types';

export const CreateReportPage: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial type from URL (/report/lost vs /report/found)
  const isFoundInitial = location.pathname.includes('/found');
  const [reportType, setReportType] = useState<'LOST' | 'FOUND'>(isFoundInitial ? 'FOUND' : 'LOST');

  const [categories, setCategories] = useState<Category[]>([]);
  const [campusLocations, setCampusLocations] = useState<CampusLocation[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [students, setStudents] = useState<User[]>([]);

  // Form states
  const [itemName, setItemName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [locationId, setLocationId] = useState<number | ''>('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [approximateTime, setApproximateTime] = useState('12:00');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [visualDescription, setVisualDescription] = useState('');
  const [color, setColor] = useState('');
  const [brand, setBrand] = useState('');
  const [distinguishingFeatures, setDistinguishingFeatures] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  // Teacher specific found item fields
  const [finderStudentId, setFinderStudentId] = useState<number | ''>('');
  const [confirmPhysicalReceipt, setConfirmPhysicalReceipt] = useState(true);
  const [storageLocationId, setStorageLocationId] = useState<number | ''>('');

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const [cats, locs] = await Promise.all([
          api.getCategories(),
          api.getCampusLocations(),
        ]);
        setCategories(cats);
        setCampusLocations(locs);
        if (cats.length > 0) setCategoryId(cats[0].id);
        if (locs.length > 0) setLocationId(locs[0].id);

        if (role === 'TEACHER' || role === 'ADMIN') {
          const [stores, stuList] = await Promise.all([
            api.getStorageLocations(),
            api.getUsersDirectory(undefined, 'STUDENT'),
          ]);
          setStorageLocations(stores);
          setStudents(stuList);
          if (stores.length > 0) setStorageLocationId(stores[0].id);
        }
      } catch (err) {
        console.error('Failed to load form lookup data:', err);
      }
    };

    loadFormData();
  }, [role]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError('Image file must be under 10MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!itemName.trim() || !categoryId || !locationId || !detailedDescription.trim()) {
      setError('Please fill in all required fields (Item Name, Category, Location, Description)');
      return;
    }

    if (reportType === 'FOUND' && (role === 'TEACHER' || role === 'ADMIN') && confirmPhysicalReceipt && !storageLocationId) {
      setError('Please designate a physical storage location vault for intake');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        report_type: reportType,
        item_name: itemName.trim(),
        category_id: Number(categoryId),
        location_id: Number(locationId),
        report_date: reportDate,
        approximate_event_time: approximateTime,
        detailed_description: detailedDescription.trim(),
        visual_description: visualDescription.trim() || detailedDescription.trim(),
        color: color.trim() || undefined,
        brand: brand.trim() || undefined,
        distinguishing_features: distinguishingFeatures.trim() || undefined,
        priority: priority,
      };

      if (reportType === 'FOUND' && (role === 'TEACHER' || role === 'ADMIN')) {
        payload.confirm_physical_receipt = confirmPhysicalReceipt;
        if (confirmPhysicalReceipt && storageLocationId) {
          payload.storage_location_id = Number(storageLocationId);
        }
        if (finderStudentId) {
          payload.reported_found_by_student_id = Number(finderStudentId);
        }
      }

      // 1. Create Report & Item
      const newReport = await api.createReport(payload);

      // 2. Upload image if provided (which runs vision extractor & auto-matches)
      if (imageFile) {
        await api.uploadReportImage(newReport.id, imageFile);
      }

      // Redirect to report detail with matches tab
      navigate(`/reports/${newReport.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please check input.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          {reportType === 'LOST' ? 'Report a Lost Personal Belonging' : 'Register a Found Campus Item'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {reportType === 'LOST'
            ? 'Submit item information and a photograph to trigger instant AI similarity matching with campus found reports.'
            : 'Record found items to establish an accountable chain of custody and help return them to their rightful owners.'}
        </p>
      </div>

      {/* Report Type Toggle */}
      <div className="bg-slate-200/80 p-1 rounded-xl flex items-center max-w-md">
        <button
          type="button"
          onClick={() => setReportType('LOST')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            reportType === 'LOST'
              ? 'bg-white text-rose-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Lost Item Report
        </button>
        <button
          type="button"
          onClick={() => setReportType('FOUND')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            reportType === 'FOUND'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Found Item Intake
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Item Photo Upload & Preview */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Photograph of Belonging</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Our computer vision model extracts spatial color histograms and gradient features for AI matching.
              </p>
            </div>
            <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              CV AI Feature Extraction
            </span>
          </div>

          {imagePreview ? (
            <div className="relative w-full max-w-sm rounded-xl overflow-hidden border-2 border-indigo-500 shadow-sm bg-slate-50">
              <img src={imagePreview} alt="Preview" className="w-full h-56 object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white transition-colors"
                title="Remove Image"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="p-2.5 bg-white border-t border-slate-200 text-center text-xs text-slate-600 font-medium">
                {imageFile?.name} ({(imageFile!.size / 1024).toFixed(1)} KB)
              </div>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/20 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-800">
                Click to upload or drag & drop item photograph
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                PNG, JPG, or WebP up to 10MB. Clear lighting improves match precision.
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Section 2: Core Details */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Item Classification & Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Item Title / Name *
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. 13-inch Silver MacBook Air, Dark Blue North Face Backpack"
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Campus Discovery Location *
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(Number(e.target.value))}
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                required
              >
                {campusLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.building})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Date {reportType === 'LOST' ? 'Lost' : 'Found'} *
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Approximate Time
              </label>
              <input
                type="time"
                value={approximateTime}
                onChange={(e) => setApproximateTime(e.target.value)}
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Visual Characteristics & Metadata */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Physical Attributes & Distinguishing Marks
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Primary Color
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Silver/Gray, Black, Navy"
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Apple, Sony, Nike, Hydroflask"
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High (Electronics/Keys/IDs)</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Distinguishing Marks & Private Identifying Features
              </label>
              <input
                type="text"
                value={distinguishingFeatures}
                onChange={(e) => setDistinguishingFeatures(e.target.value)}
                placeholder="e.g. Small NASA emblem sticker on bottom-left, scratch near USB port, keychain with initial 'A'"
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Description *
              </label>
              <textarea
                rows={3}
                value={detailedDescription}
                onChange={(e) => setDetailedDescription(e.target.value)}
                placeholder="Describe circumstances, exact study desk / bench location, contents, or condition..."
                className="block w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 4: Physical Intake & Chain of Custody (For Teachers & Admins) */}
        {reportType === 'FOUND' && (role === 'TEACHER' || role === 'ADMIN') && (
          <div className="bg-emerald-50/60 p-5 sm:p-6 rounded-2xl border border-emerald-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-emerald-950">
              <Shield className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold">Physical Custody Intake & Handover Verification</h3>
            </div>
            <p className="text-xs text-emerald-800">
              As an authorized faculty member, record who surrendered the physical item and secure it in a campus storage locker.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Finder Student (Who handed it in)
                </label>
                <select
                  value={finderStudentId}
                  onChange={(e) => setFinderStudentId(e.target.value ? Number(e.target.value) : '')}
                  className="block w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                >
                  <option value="">-- Anonymous / Unknown Finder --</option>
                  {students.map((stu) => (
                    <option key={stu.id} value={stu.id}>
                      {stu.full_name} ({stu.institutional_id}) - {stu.class_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assign Storage Vault Location *
                </label>
                <select
                  value={storageLocationId}
                  onChange={(e) => setStorageLocationId(Number(e.target.value))}
                  className="block w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  required={confirmPhysicalReceipt}
                >
                  {storageLocations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.building} {st.room_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmPhysicalReceipt}
                    onChange={(e) => setConfirmPhysicalReceipt(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    I confirm that I have physically received and inspected this item into faculty custody.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Student Disclaimer for Found reports */}
        {reportType === 'FOUND' && role === 'STUDENT' && (
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Student Handover Notice</p>
              <p className="mt-0.5 leading-relaxed">
                Thank you for your honesty. After registering this report, please physically hand the item over to a teacher or campus security desk at the Central Library.
                The status will remain "Pending Handover" until staff confirms physical receipt.
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center gap-2 ${
              reportType === 'LOST'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            } disabled:opacity-50`}
          >
            {loading ? (
              'Processing & Running AI Vector Match...'
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Submit {reportType === 'LOST' ? 'Lost Item Report' : 'Found Item Record'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
