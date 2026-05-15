import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Calendar, MessageSquare, CheckCircle, 
  Settings, Bell, Search, Plus, QrCode, UserPlus, 
  Send, Clock, Menu, X, Printer, Briefcase,
  LogOut, Lock, User, Camera, Loader2, Pencil, MapPin,
  Key, RefreshCcw, Trash2, AlertTriangle
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, addDoc, getDocs, deleteDoc } from 'firebase/firestore';

const myFirebaseConfig = {
  apiKey: "AIzaSyB50aeEo7fC8--qvEbbmP69K8H9rRlPucc",
  authDomain: "applikasipresensikaderisasi.firebaseapp.com",
  projectId: "applikasipresensikaderisasi",
  storageBucket: "applikasipresensikaderisasi.firebasestorage.app",
  messagingSenderId: "370258144125",
  appId: "1:370258144125:web:f909f5acab8f493904ba14",
  measurementId: "G-7EGL3WM4TH"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : myFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? String(__app_id).replace(/\//g, '-') : 'kaderisasi-apps-v1';

const daftarKecamatan = [
  'Buaran', 'Tirto', 'Kedungwuni', 'Wonopringgo', 'Karangdadap', 'Doro', 'Petungkriyono', 'Talun', 'Karanganyar', 'Lebakbarang', 'Kajen', 'Kandangserang', 'Paninggaran', 'Kesesi', 'Sragi', 'Siwalan', 'Wonokerto', 'Wiradesa', 'Bojong'
];

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

const getPersentase = (terdaftar, kuota) => {
  const t = Number(terdaftar) || 0; const k = Number(kuota) || 0;
  if (k <= 0) return 0;
  const p = Math.round((t / k) * 100);
  return p > 100 ? 100 : p;
};

// --- KOMPONEN GPS ---
const LocationVerificationModal = ({ target, onClose, onSuccess, addToast }) => {
  const [status, setStatus] = useState('locating'); 
  const [message, setMessage] = useState('Meminta akses GPS dan melacak lokasi Anda...');
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) { setStatus('error'); setMessage('Perangkat atau Browser Anda tidak mendukung fitur GPS.'); return; }
    if (!target.koordinat || target.koordinat.trim() === '') { setStatus('error'); setMessage('Admin belum mengatur titik koordinat untuk jadwal ini. Silakan hubungi Admin.'); return; }

    const targetCoords = target.koordinat.split(',').map(c => parseFloat(c.trim()));
    if (targetCoords.length !== 2 || isNaN(targetCoords[0]) || isNaN(targetCoords[1])) {
       setStatus('error'); setMessage('Format koordinat lokasi tidak valid. Hubungi Admin.'); return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const dist = calculateDistance(position.coords.latitude, position.coords.longitude, targetCoords[0], targetCoords[1]);
        setDistance(dist);
        if (dist <= 200) { 
          setStatus('success'); setMessage(`Lokasi Sesuai! Anda berada di area kegiatan (Jarak: ${dist} meter).`);
          setTimeout(() => { onSuccess(target); }, 2000);
        } else {
          setStatus('error'); setMessage(`Anda terlalu jauh dari lokasi. Jarak Anda: ${dist} meter. (Maksimal 200 meter dari titik).`);
        }
      },
      (error) => {
        setStatus('error');
        setMessage(error.code === 1 ? 'Akses GPS ditolak. Anda harus Mengizinkan (Allow) lokasi di browser.' : 'Gagal mendapatkan lokasi GPS. Pastikan GPS aktif.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [target, onSuccess]);

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <h3 className="font-bold text-slate-800">Verifikasi Lokasi {target.type === 'datang' ? 'Datang' : 'Pulang'}</h3>
          <button onClick={onClose} className="p-2 bg-slate-200 rounded-full hover:bg-slate-300"><X size={20} /></button>
        </div>
        <div className="p-8 flex flex-col items-center text-center">
          {status === 'locating' && (<><div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4 relative"><div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping opacity-75"></div><Navigation size={36} className="animate-pulse" /></div><h4 className="font-bold text-lg text-slate-800 mb-2">Memeriksa Satelit...</h4></>)}
          {status === 'success' && (<><div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4"><CheckCircle size={40} /></div><h4 className="font-bold text-lg text-emerald-600 mb-2">Akses Diterima</h4></>)}
          {status === 'error' && (<><div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={40} /></div><h4 className="font-bold text-lg text-red-600 mb-2">Akses Ditolak</h4></>)}
          <p className="text-sm text-slate-600 leading-relaxed max-w-[280px]">{message}</p>
          <button onClick={() => { addToast('Menggunakan bypass radius', 'info'); onSuccess(target); }} className="w-full mt-8 py-3 border-2 border-dashed border-slate-300 text-slate-400 text-xs font-bold rounded-xl hover:border-blue-300 hover:text-blue-500 transition bg-slate-50">
            [Opsi Dev] Lewati Validasi Jarak Lokasi
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbPermissionError, setDbPermissionError] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  
  const [pelatih, setPelatih] = useState([]);
  const [jadwal, setJadwal] = useState([]);
  const [waLogs, setWaLogs] = useState([]);

  // States untuk Auth Aplikasi 
  const [authConfig, setAuthConfig] = useState({ superadminPass: '123', adminPass: '123' });

  // States Modals
  const [isAddPelatihModalOpen, setIsAddPelatihModalOpen] = useState(false);
  const [newPelatih, setNewPelatih] = useState({ nama: '', alamat: '', wa: '', bidang: '', status: 'Aktif' });
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerData, setRegisterData] = useState({ nama: '', alamat: '', wa: '', bidang: '' });
  const [isEditPelatihModalOpen, setIsEditPelatihModalOpen] = useState(false);
  const [editPelatihData, setEditPelatihData] = useState(null);
  const [isAddJadwalModalOpen, setIsAddJadwalModalOpen] = useState(false);
  const [newJadwal, setNewJadwal] = useState({ jenis: 'Materi', materi: '', pelatih: '', waPelatih: '', tanggal: '', waktuMulai: '', waktuSelesai: '', tempat: '', koordinat: '', kuota: '', kecamatan: 'Buaran', waktuDatang: '-', waktuPulang: '-' });
  const [autoSendWA, setAutoSendWA] = useState(true);
  const [isEditJadwalModalOpen, setIsEditJadwalModalOpen] = useState(false);
  const [editJadwalData, setEditJadwalData] = useState(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isBlastModalOpen, setIsBlastModalOpen] = useState(false);
  const [blastTargets, setBlastTargets] = useState([]);
  const [blastMessage, setBlastMessage] = useState('Halo {nama_pelatih},\n\nMengingatkan kembali untuk jadwal pengisian materi *{materi}* pada tanggal {tanggal} di {tempat}.\n\nTerima kasih!');
  const [isChangePassModalOpen, setIsChangePassModalOpen] = useState(false);
  const [changePassData, setChangePassData] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [changePassError, setChangePassError] = useState('');

  // GPS State
  const [selectedJadwalPresensi, setSelectedJadwalPresensi] = useState('');
  const [locationTarget, setLocationTarget] = useState(null);
  const [userDistance, setUserDistance] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { setIsDbLoading(false); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => { setFirebaseUser(user); });

    return () => { unsubscribe(); window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    let isMounted = true;
    let unsubPelatih = () => {}; let unsubJadwal = () => {}; let unsubLogs = () => {}; let unsubAuth = () => {};

    const handlePermissionError = (err) => {
      setIsDbLoading(false);
      if (err.message && (err.message.includes('permissions') || err.message.includes('Missing'))) { setDbPermissionError(true); }
    };

    try {
      const pelatihRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih');
      const jadwalRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal');
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_logs');
      const authConfigRef = doc(db, 'artifacts', appId, 'public', 'data', 'kader_settings', 'auth_config');

      const checkAndSeedData = async () => {
        try {
          const authDoc = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'kader_settings'));
          if (authDoc.empty) { await setDoc(authConfigRef, { superadminPass: '123', adminPass: '123' }); }
        } catch(err) {}
      };
      checkAndSeedData();

      unsubPelatih = onSnapshot(pelatihRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.displayId > b.displayId) ? 1 : -1);
          setPelatih(data); setIsDbLoading(false); 
        }, handlePermissionError);

      unsubJadwal = onSnapshot(jadwalRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => (b.displayId > a.displayId) ? 1 : -1);
          setJadwal(data);
        }, handlePermissionError);

      unsubLogs = onSnapshot(logsRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => b.timestamp - a.timestamp);
          setWaLogs(data);
        }, handlePermissionError);

      unsubAuth = onSnapshot(authConfigRef, (docSnap) => {
          if (!isMounted) return;
          if (docSnap.exists()) setAuthConfig(docSnap.data());
      }, handlePermissionError);

    } catch (err) { handlePermissionError(err); }

    return () => { isMounted = false; unsubPelatih(); unsubJadwal(); unsubLogs(); unsubAuth(); };
  }, [firebaseUser]);