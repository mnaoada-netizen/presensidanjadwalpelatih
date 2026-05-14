import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Calendar, MessageSquare, CheckCircle, 
  Settings, Bell, Search, Plus, UserPlus, 
  Send, Clock, Menu, X, Printer, Briefcase,
  LogOut, Lock, User, MapPin, Key, RefreshCcw, 
  Trash2, AlertTriangle, Navigation, Loader2, Map,
  Pencil, QrCode, Shield, UploadCloud, UserCheck, Barcode, FileText
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, addDoc, getDocs, deleteDoc, writeBatch, setDoc, getDoc } from 'firebase/firestore';

// --- FIREBASE SETUP ---
const myFirebaseConfig = {
  apiKey: "AIzaSyB50aeEo7fC8--qvEbbmP69K8H9rRlPucc",
  authDomain: "applikasipresensikaderisasi.firebaseapp.com",
  projectId: "applikasipresensikaderisasi",
  storageBucket: "applikasipresensikaderisasi.firebasestorage.app",
  messagingSenderId: "370258144125",
  appId: "1:370258144125:web:f909f5acab8f493904ba14",
  measurementId: "G-7EGL3WM4TH"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : myFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Perbaikan identitas aplikasi
const appId = typeof __app_id !== 'undefined' ? __app_id : 'kaderisasi-apps-v1';

const daftarKecamatan = [
  'Buaran', 'Tirto', 'Kedungwuni', 'Wonopringgo', 'Karangdadap', 
  'Doro', 'Petungkriyono', 'Talun', 'Karanganyar', 'Lebakbarang', 
  'Kajen', 'Kandangserang', 'Paninggaran', 'Kesesi', 'Sragi', 
  'Siwalan', 'Wonokerto', 'Wiradesa', 'Bojong'
];

// --- RUMUS MENGHITUNG JARAK LOKASI (HAVERSINE) ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

const getPersentase = (terdaftar, kuota) => {
  const t = Number(terdaftar) || 0;
  const k = Number(kuota) || 0;
  if (k <= 0) return 0;
  const p = Math.round((t / k) * 100);
  return p > 100 ? 100 : p;
};

export default function App() {
  // --- STATES CLOUD & KONEKSI ---
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbPermissionError, setDbPermissionError] = useState(false);

  // States Auth & Navigasi
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [authConfig, setAuthConfig] = useState({ superadminPass: '123', adminPass: '123' });
  
  // States Data Database
  const [pelatih, setPelatih] = useState([]);
  const [jadwal, setJadwal] = useState([]);
  const [waLogs, setWaLogs] = useState([]);
  const [peserta, setPeserta] = useState([]); // STATE DATA PESERTA

  // States Modal Pelatih & Jadwal
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

  // States Izin Peserta
  const [izinList, setIzinList] = useState([]);
  const [isAddIzinModalOpen, setIsAddIzinModalOpen] = useState(false);
  const [newIzin, setNewIzin] = useState({ namaPeserta: '', jamMulai: '', jamSelesai: '', materi: '', alasan: '' });

  // States Scan Barcode Peserta
  const [isScanPesertaOpen, setIsScanPesertaOpen] = useState(false);
  const scannerPesertaRef = useRef(null);
  const isScanningPesertaRef = useRef(false);

  // States Deteksi Lokasi Pelatih
  const [selectedJadwalPresensi, setSelectedJadwalPresensi] = useState('');
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
      } catch (error) {
        console.error("Firebase Auth Error:", error);
        setIsDbLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });

    // Pemuatan skrip html5-qrcode
    if (!window.Html5Qrcode) {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.async = true;
        document.body.appendChild(script);
    }

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    let isMounted = true;
    let unsubPelatih = () => {};
    let unsubJadwal = () => {};
    let unsubLogs = () => {};
    let unsubPeserta = () => {};
    let unsubAuth = () => {};
    let unsubIzin = () => {};

    const handlePermissionError = (err, module) => {
      setIsDbLoading(false);
      if (err.message && (err.message.includes('permissions') || err.message.includes('Missing'))) {
        setDbPermissionError(true);
      }
    };

    try {
      const pelatihRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih');
      const jadwalRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal');
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_logs');
      const pesertaRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_peserta'); 
      const authConfigRef = doc(db, 'artifacts', appId, 'public', 'data', 'kader_settings', 'auth_config');
      const izinRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_izin');

      const checkAndSeedData = async () => {
        try {
          const pSnap = await getDocs(pelatihRef);
          if (pSnap.empty) {
            const initialPelatih = [
              { displayId: 'P001', nama: 'Dr. Andi Pratama', alamat: 'Kajen, Pekalongan', wa: '+628111222333', bidang: 'Kepemimpinan & Organisasi', status: 'Aktif', password: '123' }
            ];
            initialPelatih.forEach(p => addDoc(pelatihRef, p));
          }
          
          const authDoc = await getDoc(authConfigRef);
          if (!authDoc.exists()) {
            await setDoc(authConfigRef, { superadminPass: '123', adminPass: '123' });
          }
        } catch(err) { handlePermissionError(err, 'Seeding'); }
      };
      
      checkAndSeedData();

      unsubPelatih = onSnapshot(pelatihRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.displayId > b.displayId) ? 1 : -1);
          setPelatih(data);
          setIsDbLoading(false); 
      }, (err) => handlePermissionError(err, 'Pelatih'));

      unsubJadwal = onSnapshot(jadwalRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => (b.displayId > a.displayId) ? 1 : -1);
          setJadwal(data);
      }, (err) => handlePermissionError(err, 'Jadwal'));

      unsubLogs = onSnapshot(logsRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => b.timestamp - a.timestamp);
          setWaLogs(data);
      }, (err) => handlePermissionError(err, 'Logs'));

      // Sinkronisasi Data Peserta
      unsubPeserta = onSnapshot(pesertaRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.nama > b.nama) ? 1 : -1);
          setPeserta(data);
      }, (err) => handlePermissionError(err, 'Peserta'));

      unsubAuth = onSnapshot(authConfigRef, (docSnap) => {
          if (!isMounted) return;
          if (docSnap.exists()) {
              setAuthConfig(docSnap.data());
          }
      }, (err) => handlePermissionError(err, 'Auth Config'));

      // Sinkronisasi Data Izin
      unsubIzin = onSnapshot(izinRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => b.timestamp - a.timestamp);
          setIzinList(data);
      }, (err) => handlePermissionError(err, 'Izin'));

    } catch (err) {
      handlePermissionError(err, 'Init Collection');
    }

    return () => {
      isMounted = false;
      unsubPelatih();
      unsubJadwal();
      unsubLogs();
      unsubPeserta();
      unsubAuth();
      unsubIzin();
    };
  }, [firebaseUser]);

  // --- FUNGSI GLOBAL ---
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 3000);
  };

  const openGoogleMaps = (koordinat) => {
    if (!koordinat || koordinat.trim() === '') {
      addToast('Titik koordinat lokasi belum diatur.', 'error');
      return;
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${koordinat}`, '_blank', 'noopener,noreferrer');
  };

  // --- LOGIKA LOGIN DENGAN 3 ROLE ---
  const handleLogin = (e) => {
    e.preventDefault();
    const cleanInputUser = username.trim().toLowerCase();

    // 1. Role Superadmin
    if (cleanInputUser === 'superadmin' && password === (authConfig.superadminPass || '123')) {
      setCurrentUser({ username: 'superadmin', role: 'superadmin', name: 'Super Admin' });
      setActiveTab('dashboard'); 
      setLoginError(''); 
      addToast(`Selamat datang, Super Admin!`, 'success');
      return;
    }

    // 2. Role Panitia (Admin Presensi Lapangan)
    if (cleanInputUser === 'admin' && password === (authConfig.adminPass || '123')) {
      setCurrentUser({ username: 'admin', role: 'admin', name: 'Panitia Kehadiran' });
      setActiveTab('peserta'); // Langsung buka halaman scanner
      setLoginError(''); 
      addToast(`Akses Panitia Diberikan!`, 'success');
      return;
    }

    // 3. Role Pelatih / Pemateri / Petugas Piket
    const foundPelatih = pelatih.find(p => p.nama.trim().toLowerCase() === cleanInputUser);
    if (foundPelatih) {
      const currentDbPassword = foundPelatih.password || '123';
      if (password === currentDbPassword) {
        setCurrentUser({ username: foundPelatih.nama, role: 'pelatih', name: foundPelatih.nama, docId: foundPelatih.docId });
        
        // Cek tab awal yang cocok
        const isPemateri = jadwal.some(j => j.pelatih === foundPelatih.nama && j.jenis !== 'Piket');
        setActiveTab(isPemateri ? 'jadwal_saya' : 'jadwal_piket'); 
        
        setLoginError(''); 
        addToast(`Selamat datang, ${foundPelatih.nama}!`, 'success');
        return;
      }
    }
    setLoginError('Username/Nama atau password salah!');
  };

  const handleRegisterPelatih = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Mendaftarkan data ke sistem...', 'info');
    const displayId = `P${String(pelatih.length + 1).padStart(3, '0')}`;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih'), { 
        displayId, nama: registerData.nama.trim(), alamat: registerData.alamat, wa: registerData.wa, bidang: registerData.bidang, status: 'Aktif', password: '123'
      });
      setIsRegisterModalOpen(false); setRegisterData({ nama: '', alamat: '', wa: '', bidang: '' });
      addToast('Registrasi berhasil! Silakan Login.', 'success');
    } catch (error) { addToast('Gagal melakukan pendaftaran.', 'error'); }
  };

  const handleLogout = () => {
    setCurrentUser(null); setUsername(''); setPassword(''); setActiveTab('dashboard');
    setSelectedJadwalPresensi(''); setUserDistance(null); setLocationError('');
    addToast('Anda telah logout.', 'info');
  };

  // --- CRUD PELATIH ---
  const submitAddPelatih = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Menyimpan ke Cloud...', 'info');
    const displayId = `P${String(pelatih.length + 1).padStart(3, '0')}`;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih'), { displayId, ...newPelatih, nama: newPelatih.nama.trim(), password: '123' });
      setIsAddPelatihModalOpen(false); setNewPelatih({ nama: '', alamat: '', wa: '', bidang: '', status: 'Aktif' });
      addToast('Data pelatih berhasil disimpan!', 'success');
    } catch (error) { addToast('Gagal menyimpan data.', 'error'); }
  };

  const submitEditPelatih = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Menyimpan perubahan...', 'info');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih', editPelatihData.docId), { 
        nama: editPelatihData.nama.trim(), alamat: editPelatihData.alamat, bidang: editPelatihData.bidang, wa: editPelatihData.wa, status: editPelatihData.status 
      });
      setIsEditPelatihModalOpen(false); setEditPelatihData(null); addToast('Data berhasil diperbarui!', 'success');
    } catch (error) { addToast('Gagal memperbarui data.', 'error'); }
  };

  const handleResetPassword = async (p) => {
    if (!firebaseUser) return;
    if (!window.confirm(`Yakin mereset password pelatih ${p.nama} menjadi "123"?`)) return;
    addToast(`Mereset password ${p.nama}...`, 'info');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih', p.docId), { password: '123' });
      addToast(`Password ${p.nama} direset!`, 'success');
    } catch (error) { addToast('Gagal mereset password.', 'error'); }
  };

  const submitChangePassword = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (changePassData.newPass !== changePassData.confirmPass) { setChangePassError('Konfirmasi Password tidak cocok!'); return; }
    
    addToast('Menyimpan password baru...', 'info');

    // Ganti password untuk admin & superadmin
    if (currentUser.role === 'superadmin' || currentUser.role === 'admin') {
      const isSuper = currentUser.role === 'superadmin';
      const currentPass = isSuper ? (authConfig.superadminPass || '123') : (authConfig.adminPass || '123');
      if (changePassData.oldPass !== currentPass) { setChangePassError('Password Lama salah!'); return; }
      
      try {
        const authConfigRef = doc(db, 'artifacts', appId, 'public', 'data', 'kader_settings', 'auth_config');
        await updateDoc(authConfigRef, {
          [isSuper ? 'superadminPass' : 'adminPass']: changePassData.newPass
        });
        setIsChangePassModalOpen(false); setChangePassData({ oldPass: '', newPass: '', confirmPass: '' }); setChangePassError('');
        addToast('Password berhasil diganti!', 'success');
      } catch (error) { setChangePassError('Gagal mengubah password.'); }
      return;
    }

    // Ganti password untuk pelatih
    const userInDb = pelatih.find(p => p.docId === currentUser.docId);
    if (changePassData.oldPass !== (userInDb?.password || '123')) { setChangePassError('Password Lama salah!'); return; }
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih', currentUser.docId), { password: changePassData.newPass });
      setIsChangePassModalOpen(false); setChangePassData({ oldPass: '', newPass: '', confirmPass: '' }); setChangePassError('');
      addToast('Password berhasil diganti!', 'success');
    } catch (error) { setChangePassError('Gagal mengubah password.'); }
  };

  // --- CRUD JADWAL ---
  const submitAddJadwal = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Menyimpan jadwal ke Cloud...', 'info');
    const displayId = `J${String(jadwal.length + 1).padStart(3, '0')}`;
    const addedJadwal = { 
      displayId, ...newJadwal, 
      jenis: newJadwal.jenis || 'Materi', materi: newJadwal.jenis === 'Piket' ? 'Tugas Piket Diklatsar' : newJadwal.materi,
      kuota: newJadwal.jenis === 'Piket' ? 0 : newJadwal.kuota, terdaftar: 0, statusPelatih: 'Belum Hadir', waktuDatang: '-', waktuPulang: '-' 
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal'), addedJadwal);
      setIsAddJadwalModalOpen(false);
      setNewJadwal({ jenis: 'Materi', materi: '', pelatih: '', waPelatih: '', tanggal: '', waktuMulai: '', waktuSelesai: '', tempat: '', koordinat: '', kuota: '', kecamatan: 'Buaran', waktuDatang: '-', waktuPulang: '-' });
      addToast('Jadwal baru berhasil disimpan di Cloud!', 'success');
      if (autoSendWA && addedJadwal.waPelatih) { setTimeout(() => sendWhatsAppMock(addedJadwal.pelatih, 'Jadwal Pemateri Baru'), 1000); }
    } catch (error) { addToast('Gagal menyimpan jadwal.', 'error'); }
  };

  const openEditJadwal = (j) => { setEditJadwalData({ ...j, jenis: j.jenis || 'Materi', koordinat: j.koordinat || '' }); setIsEditJadwalModalOpen(true); };

  const submitEditJadwal = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Menyimpan perubahan jadwal...', 'info');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', editJadwalData.docId), {
        jenis: editJadwalData.jenis || 'Materi', materi: editJadwalData.jenis === 'Piket' ? 'Tugas Piket Diklatsar' : editJadwalData.materi,
        pelatih: editJadwalData.pelatih, waPelatih: editJadwalData.waPelatih, kecamatan: editJadwalData.kecamatan, tempat: editJadwalData.tempat, koordinat: editJadwalData.koordinat,
        tanggal: editJadwalData.tanggal, kuota: editJadwalData.jenis === 'Piket' ? 0 : editJadwalData.kuota, waktuMulai: editJadwalData.waktuMulai, waktuSelesai: editJadwalData.waktuSelesai,
      });
      setIsEditJadwalModalOpen(false); setEditJadwalData(null); addToast('Jadwal berhasil diperbarui!', 'success');
    } catch (error) { addToast('Gagal memperbarui jadwal.', 'error'); }
  };

  const handleResetPresensiJadwal = async (id, materi) => {
    if (!firebaseUser) return;
    if (!window.confirm(`Yakin mereset presensi untuk jadwal "${materi}"?`)) return;
    addToast('Mereset data presensi...', 'info');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', id), { waktuDatang: '-', waktuPulang: '-', statusPelatih: 'Belum Hadir' });
      addToast('Presensi jadwal dikosongkan!', 'success');
    } catch (error) { addToast('Gagal mereset presensi jadwal.', 'error'); }
  };

  const handleDeleteJadwal = async (id, materi) => {
    if (!firebaseUser) return;
    if (!window.confirm(`Yakin MENGHAPUS jadwal "${materi}" secara permanen?`)) return;
    addToast('Menghapus jadwal...', 'info');
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', id));
      addToast('Jadwal berhasil dihapus!', 'success');
    } catch (error) { addToast('Gagal menghapus jadwal.', 'error'); }
  };

  const handlePelatihPresensi = async (target) => {
    if (!firebaseUser) return;
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    try {
      const updateData = { statusPelatih: 'Hadir' };
      if (target.type === 'datang') updateData.waktuDatang = now;
      if (target.type === 'pulang') updateData.waktuPulang = now;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', target.id), updateData);
      addToast(`Presensi ${target.type} tersimpan di Cloud pada ${now} WIB`, 'success');
    } catch (error) { addToast('Gagal mencatat presensi di Cloud.', 'error'); }
  };

  // --- UPLOAD EXCEL (CSV) PESERTA ---
  const handleUploadCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      addToast("Format file harus CSV (Comma delimited).", "error");
      return;
    }

    addToast("Membaca file CSV...", "info");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n');
      if (rows.length > 0) rows.shift(); // Hapus header baris pertama

      let successCount = 0;
      const pesertaRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_peserta');
      addToast("Menyimpan daftar peserta ke Database...", "info");
      
      for (const row of rows) {
        if (!row.trim()) continue; 
        const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, '')); 
        
        if (cols.length >= 2 && cols[0] !== '') {
          const newPeserta = {
            nama: cols[0],
            kecamatan: cols[1] || 'Tidak Diketahui',
            barcode: 'KDR-' + Date.now().toString().slice(-6) + Math.floor(Math.random()*1000).toString().padStart(3, '0'),
            statusHadir: 'Belum Hadir',
            waktuHadir: '-'
          };
          try {
            await addDoc(pesertaRef, newPeserta);
            successCount++;
          } catch(err) { console.error(err); }
        }
      }
      addToast(`${successCount} Peserta berhasil di-upload dan dibuatkan Barcode!`, "success");
    };
    reader.readAsText(file);
    e.target.value = null; 
  };

  const handleHapusSemuaPeserta = async () => {
    if (!window.confirm("PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH data peserta secara permanen?")) return;
    addToast("Menghapus data peserta massal...", "info");
    try {
      for(const p of peserta) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_peserta', p.docId));
      }
      addToast("Seluruh data peserta berhasil dikosongkan.", "success");
    } catch(err) { addToast("Terjadi kesalahan saat menghapus data.", "error"); }
  }

  const handleCetakBarcodePeserta = () => {
    if (peserta.length === 0) { addToast("Belum ada data peserta untuk dicetak.", "error"); return; }
    addToast("Membuka halaman cetak...", "info");
    const printWindow = window.open('', '_blank');
    let gridHtml = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px;">`;
    peserta.forEach(p => {
      gridHtml += `<div style="border: 2px dashed #94a3b8; border-radius: 12px; padding: 20px; text-align: center; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; page-break-inside: avoid;">
          <h2 style="margin: 0 0 5px 0; color: #047857; font-size: 16px;">KADERISASI NU</h2>
          <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">${p.nama}</h3>
          <p style="margin: 0 0 15px 0; color: #64748b; font-size: 12px;">Utusan: ${p.kecamatan}</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${p.barcode}" alt="QR" style="margin-bottom: 10px;" />
          <p style="margin: 0; font-family: monospace; font-size: 14px; font-weight: bold; letter-spacing: 2px;">${p.barcode}</p>
        </div>`;
    });
    gridHtml += `</div>`;
    const fullHtml = `<!DOCTYPE html><html><head><title>Cetak ID Card Peserta</title><style>@media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; } } body { margin: 0; padding: 0; background: #f8fafc; } .btn-print { background:#10b981; color:white; border:none; padding:15px 30px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px; margin: 20px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2); }</style></head><body><div class="no-print" style="text-align: center;"><button class="btn-print" onclick="window.print()">🖨️ Cetak Barcode (Print)</button><p style="color: #64748b; font-family: sans-serif;">Gunakan kertas A4. Potong sesuai garis putus-putus untuk dijadikan ID Card.</p></div>${gridHtml}</body></html>`;
    printWindow.document.open(); printWindow.document.write(fullHtml); printWindow.document.close();
  };

  const onPesertaScanSuccess = async (decodedText) => {
    if (!isScanPesertaOpen) return;
    const targetPeserta = peserta.find(p => p.barcode === decodedText);
    
    if (targetPeserta) {
      if (targetPeserta.statusHadir === 'Hadir') {
         addToast(`Peserta ${targetPeserta.nama} sudah absen sebelumnya!`, 'info');
      } else {
         const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
         try {
           await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_peserta', targetPeserta.docId), { statusHadir: 'Hadir', waktuHadir: now });
           addToast(`Berhasil! ${targetPeserta.nama} hadir pada ${now} WIB.`, 'success');
           if (navigator.vibrate) navigator.vibrate(200);
         } catch(err) { addToast('Gagal mencatat di Database.', 'error'); }
      }
    } else {
      addToast(`Barcode tidak dikenali: ${decodedText}`, 'error');
    }
  };

  // --- CRUD IZIN PESERTA ---
  const submitAddIzin = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Mencatat izin peserta...', 'info');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'kader_izin'), {
        ...newIzin,
        tanggal: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        timestamp: Date.now()
      });
      setIsAddIzinModalOpen(false);
      setNewIzin({ namaPeserta: '', jamMulai: '', jamSelesai: '', materi: '', alasan: '' });
      addToast('Izin berhasil dicatat!', 'success');
    } catch (error) { addToast('Gagal mencatat izin.', 'error'); }
  };

  const handleDeleteIzin = async (id) => {
    if (!firebaseUser) return;
    if (!window.confirm('Hapus log izin ini?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_izin', id));
      addToast('Catatan izin dihapus.', 'success');
    } catch (error) { addToast('Gagal menghapus.', 'error'); }
  };

  useEffect(() => {
    if (isScanPesertaOpen && window.Html5Qrcode) {
      let html5QrCode = new window.Html5Qrcode("reader-peserta");
      scannerPesertaRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { onPesertaScanSuccess(decodedText); },
        (err) => {}
      ).then(() => { isScanningPesertaRef.current = true; }).catch(err => {
         addToast("Gagal membuka kamera. Izin ditolak?", "error");
      });
    }
    return () => {
      if (scannerPesertaRef.current && isScanningPesertaRef.current) {
        scannerPesertaRef.current.stop().catch(e => console.error(e));
        isScanningPesertaRef.current = false;
      }
    }
  }, [isScanPesertaOpen, peserta]); 


  const addLogToCloud = async (target, type, status) => {
    if (!firebaseUser) return;
    const timestamp24h = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'kader_logs'), { target, type, status, waktu: timestamp24h, timestamp: Date.now() }); } catch (error) {}
  };

  const openWhatsAppWeb = (phone, text, targetName, type) => {
    if (!phone || phone.trim() === '-' || phone.trim() === '') { addToast('Nomor WA kosong.', 'error'); return; }
    let cleanPhone = phone.replace(/\D/g, ''); 
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
    const encodedText = encodeURIComponent(text);
    const link = document.createElement('a'); link.href = `https://wa.me/${cleanPhone}?text=${encodedText}`; link.target = '_blank'; link.rel = 'noopener noreferrer';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    addToast(`Membuka WhatsApp untuk ${targetName}...`, 'success'); addLogToCloud(targetName, type, 'Dialihkan ke WA App');
  };

  const sendWhatsAppMock = (target, type) => {
    addToast(`Memproses ${type} via Cloud API ke ${target}...`, 'info');
    setTimeout(() => { addToast(`Berhasil mengirim pesan ke ${target}!`, 'success'); addLogToCloud(target, type, 'Terkirim'); }, 1500);
  };

  const prepareBlastWAPelatih = () => {
    const uniquePelatih = []; const map = new Map();
    for (const j of jadwal) { if (j.waPelatih && j.waPelatih !== '-' && !map.has(j.waPelatih)) { map.set(j.waPelatih, true); uniquePelatih.push(j); } }
    if (uniquePelatih.length === 0) { addToast('Belum ada jadwal pelatih dengan nomor WA.', 'error'); return; }
    setBlastTargets(uniquePelatih); setIsBlastModalOpen(true);
  };

  const executeBlastWA = () => {
    setIsBlastModalOpen(false); addToast(`Memulai broadcast API ke ${blastTargets.length} pelatih...`, 'info');
    setTimeout(() => {
      addToast(`Berhasil broadcast jadwal ke ${blastTargets.length} pelatih!`, 'success');
      blastTargets.forEach(p => addLogToCloud(p.pelatih, 'Blast Jadwal Pelatih', 'Terkirim'));
    }, 2000);
  };

  const handleCetakPresensi = () => {
    addToast('Membuka pratinjau dokumen PDF...', 'info');
    const printWindow = window.open('', '_blank');
    const now = new Date();
    const printDate = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const printTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const namaKecamatan = jadwal.length > 0 ? jadwal[0].kecamatan : 'Semua Kecamatan';

    const tableRows = jadwal.map((j, index) => {
      const hari = new Date(j.tanggal).toLocaleDateString('id-ID', { weekday: 'long' });
      const tanggalFormat = new Date(j.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const materiDisplay = j.jenis === 'Piket' ? '<strong>🛡️ TUGAS PIKET</strong>' : j.materi;
      return `<tr><td>${index + 1}</td><td>${hari}, ${tanggalFormat}</td><td>${j.waktuMulai} - ${j.waktuSelesai}</td><td>${materiDisplay}</td><td>${j.pelatih}</td><td style="text-align: center; font-weight: bold; color: ${j.waktuDatang !== '-' ? 'green' : '#94a3b8'}">${j.waktuDatang || '-'}</td><td style="text-align: center; font-weight: bold; color: ${j.waktuPulang !== '-' ? 'green' : '#94a3b8'}">${j.waktuPulang || '-'}</td></tr>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html><html><head><title>Laporan Presensi</title><style>body{font-family:sans-serif;padding:40px;color:#333;max-width:1000px;margin:auto}.no-print{text-align:right;margin-bottom:20px;padding-bottom:20px;border-bottom:1px dashed #cbd5e1}.btn-print{background:#2563eb;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px}.header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:20px;margin-bottom:30px}.header h1{margin:0;color:#1e40af;font-size:24px;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-bottom:30px;font-size:14px}th,td{border:1px solid #cbd5e1;padding:12px;text-align:left}th{background-color:#f1f5f9;font-weight:bold;font-size:12px}.footer{margin-top:50px;text-align:right;font-size:14px}.signature-space{height:80px}.meta-info{margin-top:40px;font-size:12px;color:#64748b;font-style:italic}@media print{body{padding:0;max-width:none}.no-print{display:none}}</style></head><body><div class="no-print"><button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button></div><div class="header"><h1>Rekapitulasi Presensi Pemateri / Pelatih</h1><p>Diklatsar Satkoryon Kecamatan ${namaKecamatan}</p></div><table><thead><tr><th width="5%">No</th><th width="15%">Hari / Tanggal</th><th width="15%">Sesi (WIB)</th><th width="20%">Materi / Tugas</th><th width="25%">Nama Pelatih</th><th width="10%">Jam Datang</th><th width="10%">Jam Pulang</th></tr></thead><tbody>${tableRows}</tbody></table><div class="footer"><p>Pekalongan, ${printDate}</p><div class="signature-space"></div><p><strong>Admin Satkorcab</strong></p></div><div class="meta-info">* Dicetak tanggal ${printDate} jam ${printTime} WIB oleh Admin Satkorcab</div></body></html>`;
    printWindow.document.open(); printWindow.document.write(htmlContent); printWindow.document.close();
  };

  const checkLocation = (koordinat) => {
    if (!koordinat || koordinat.trim() === '') { setLocationError('Admin belum mengatur titik koordinat.'); setUserDistance(null); return; }
    const coords = koordinat.split(',').map(c => parseFloat(c.trim()));
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) { setLocationError('Format koordinat tidak valid.'); setUserDistance(null); return; }
    setIsLocating(true); setLocationError(''); setUserDistance(null);

    if (!navigator.geolocation) { setLocationError('Browser/HP Anda tidak mendukung fitur GPS.'); setIsLocating(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserDistance(calculateDistance(pos.coords.latitude, pos.coords.longitude, coords[0], coords[1])); setIsLocating(false); },
      (err) => { setIsLocating(false); setLocationError(err.code === 1 ? 'Akses GPS ditolak! Anda harus Mengizinkan (Allow) Izin Lokasi di browser.' : 'Sinyal GPS lemah atau gagal dideteksi.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (selectedJadwalPresensi) { const sj = jadwal.find(j => j.docId === selectedJadwalPresensi); if (sj) checkLocation(sj.koordinat); } 
    else { setUserDistance(null); setLocationError(''); }
  }, [selectedJadwalPresensi, jadwal]);

  // --- KOMPONEN TAMPILAN ---
  const Sidebar = () => {
    let menus = [];
    if (currentUser?.role === 'superadmin') {
      menus = [ 
        { id: 'dashboard', icon: <Calendar size={20}/>, label: 'Dashboard Utama' }, 
        { id: 'peserta', icon: <Users size={20}/>, label: 'Data Peserta (Barcode)' },
        { id: 'izin', icon: <FileText size={20}/>, label: 'Data Izin Peserta' },
        { id: 'pelatih', icon: <Briefcase size={20}/>, label: 'Data Pelatih' }, 
        { id: 'jadwal', icon: <Clock size={20}/>, label: 'Jadwal & Penugasan' }, 
        { id: 'whatsapp', icon: <MessageSquare size={20}/>, label: 'Log WhatsApp' } 
      ];
    } else if (currentUser?.role === 'admin') {
      menus = [ 
        { id: 'peserta', icon: <Barcode size={20}/>, label: 'Scanner Pintu Masuk' },
        { id: 'izin', icon: <FileText size={20}/>, label: 'Pencatatan Izin' }
      ];
    } else {
      menus.push({ id: 'dashboard', icon: <Calendar size={20}/>, label: 'Dashboard Saya' });
      const isPemateri = jadwal.some(j => j.pelatih === currentUser.name && j.jenis !== 'Piket');
      const isPiket = jadwal.some(j => j.pelatih === currentUser.name && j.jenis === 'Piket');
      if (isPemateri) menus.push({ id: 'jadwal_saya', icon: <Clock size={20}/>, label: 'Jadwal Materi Saya' });
      if (isPiket) menus.push({ id: 'jadwal_piket', icon: <Shield size={20}/>, label: 'Tugas Piket Saya' });
    }

    return (
      <div className={`${isSidebarOpen ? 'block' : 'hidden'} md:block w-64 bg-slate-900 text-white min-h-screen flex flex-col transition-all duration-300 z-20`}>
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-wider text-emerald-500">KADER<span className="text-white">PRO</span></h1>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <div className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
          {menus.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === item.id ? 'bg-emerald-600 text-white font-bold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              {item.icon} <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const IzinView = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-emerald-600" /> Pencatatan Izin Peserta
          </h2>
          <p className="text-sm text-slate-500 mt-1">Daftar peserta yang meminta izin keluar sementara atau tidak mengikuti materi tertentu.</p>
        </div>
        <button onClick={() => setIsAddIzinModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 font-bold shadow-md transition">
          <Plus size={18} /> Tambah Izin Baru
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Nama Peserta</th>
                <th className="p-4 font-bold">Tanggal</th>
                <th className="p-4 font-bold">Waktu Izin</th>
                <th className="p-4 font-bold">Materi yg Ditinggalkan</th>
                <th className="p-4 font-bold">Alasan</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {izinList.map((izin) => (
                <tr key={izin.docId} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4"><p className="text-sm font-bold text-slate-800">{izin.namaPeserta}</p></td>
                  <td className="p-4 text-xs font-medium text-slate-600">{izin.tanggal}</td>
                  <td className="p-4">
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {izin.jamMulai} - {izin.jamSelesai}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-semibold text-slate-700">{izin.materi}</td>
                  <td className="p-4 text-xs text-slate-600 max-w-[200px] truncate" title={izin.alasan}>{izin.alasan}</td>
                  <td className="p-4 text-center">
                     <button onClick={() => handleDeleteIzin(izin.docId)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition" title="Hapus Data">
                       <Trash2 size={16} />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {izinList.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm italic">
            Belum ada data izin peserta yang dicatat saat ini.
          </div>
        )}
      </div>
    </div>
  );

  const PesertaView = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             {currentUser?.role === 'superadmin' ? <Users className="text-emerald-600" /> : <Barcode className="text-emerald-600"/>} 
             {currentUser?.role === 'superadmin' ? 'Database Peserta Diklatsar' : 'Scanner Kehadiran Peserta'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
             {currentUser?.role === 'superadmin' ? 'Kelola data peserta, cetak barcode, dan scan kehadiran.' : 'Arahkan HP Anda ke Name Tag (Barcode) Peserta di pintu masuk.'}
          </p>
        </div>
        {currentUser?.role === 'superadmin' && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <label className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-200 font-bold cursor-pointer transition">
              <UploadCloud size={18} /> Upload Excel (CSV)
              <input type="file" accept=".csv" onChange={handleUploadCSV} className="hidden" />
            </label>
            <button onClick={handleCetakBarcodePeserta} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 font-bold shadow-md transition">
              <Printer size={18} /> Cetak ID Card (Barcode)
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-slate-100 text-slate-600 rounded-full"><Users size={28} /></div>
          <div><p className="text-sm text-slate-500 font-medium">Total Peserta Terdaftar</p><p className="text-3xl font-bold text-slate-800">{peserta.length}</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full"><UserCheck size={28} /></div>
          <div><p className="text-sm text-slate-500 font-medium">Total Hadir (Di-scan)</p><p className="text-3xl font-bold text-slate-800">{peserta.filter(p=>p.statusHadir==='Hadir').length}</p></div>
        </div>
        <button onClick={() => setIsScanPesertaOpen(true)} className="bg-indigo-600 text-white p-6 rounded-xl shadow-md border border-indigo-700 flex items-center justify-center gap-3 hover:bg-indigo-700 transition transform hover:scale-105 active:scale-95">
          <Barcode size={32} />
          <div className="text-left"><p className="text-sm text-indigo-200 font-bold">Mulai Mode Panitia</p><p className="text-xl font-bold">SCAN BARCODE MASUK</p></div>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-700">Daftar Lengkap Peserta</h3>
          {currentUser?.role === 'superadmin' && (
            <button onClick={handleHapusSemuaPeserta} className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition">Hapus Semua Data</button>
          )}
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">Nama Peserta</th>
                <th className="p-4 font-bold">Asal Kecamatan</th>
                <th className="p-4 font-bold">Kode Barcode Unik</th>
                <th className="p-4 font-bold">Status Kehadiran</th>
                <th className="p-4 font-bold text-center">Waktu Scan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {peserta.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4"><p className="text-sm font-bold text-slate-800">{p.nama}</p></td>
                  <td className="p-4"><span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">{p.kecamatan}</span></td>
                  <td className="p-4 font-mono text-xs text-slate-500">{p.barcode}</td>
                  <td className="p-4">
                    {p.statusHadir === 'Hadir' ? 
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-max border border-emerald-200"><CheckCircle size={14}/> Hadir</span> : 
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full w-max"><X size={14}/> Belum Hadir</span>
                    }
                  </td>
                  <td className="p-4 text-center font-bold text-sm text-emerald-600">{p.waktuHadir}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {peserta.length === 0 && (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-400 mb-4"><UploadCloud size={32}/></div>
            <p className="text-slate-600 font-medium">Belum ada data peserta.</p>
            {currentUser?.role === 'superadmin' && <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">Silakan buat daftar nama dan asal di Microsoft Excel, lalu <b>Save As</b> menjadi format <b>CSV (Comma delimited)</b> dan Upload di sini.</p>}
          </div>
        )}
      </div>

      {isScanPesertaOpen && (
        <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col animate-in fade-in zoom-in duration-300">
           <div className="p-4 bg-slate-800 text-white flex justify-between items-center shadow-md">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2"><Barcode className="text-emerald-400"/> Scanner Pintu Masuk</h2>
                <p className="text-xs text-slate-400">Mode Panitia Diklatsar</p>
              </div>
              <button onClick={() => setIsScanPesertaOpen(false)} className="p-2 bg-slate-700 hover:bg-red-500 rounded-full transition"><X size={24}/></button>
           </div>
           
           <div className="flex-1 flex flex-col md:flex-row relative">
              <div className="flex-1 bg-black flex flex-col justify-center items-center relative overflow-hidden">
                 <div id="reader-peserta" className="w-full max-w-[500px] h-[500px] object-cover"></div>
                 <div className="absolute bottom-8 left-0 right-0 text-center z-10 px-4">
                    <div className="bg-slate-900/80 backdrop-blur inline-block px-6 py-3 rounded-2xl border border-slate-700 shadow-xl">
                       <p className="text-emerald-400 font-bold animate-pulse text-sm md:text-base">Mendeteksi QR Code...</p>
                       <p className="text-slate-300 text-xs mt-1">Arahkan ID Card peserta ke dalam kotak area merah.</p>
                    </div>
                 </div>
                 <div className="absolute top-4 right-4 z-20 opacity-30 hover:opacity-100 transition">
                    <select className="text-xs p-1 bg-slate-800 text-white rounded border border-slate-600" onChange={(e) => { if(e.target.value) onPesertaScanSuccess(e.target.value); e.target.value = ''; }}>
                       <option value="">[DEV] Simulasi Scan...</option>
                       {peserta.map((p, i) => <option key={i} value={p.barcode}>{p.nama}</option>)}
                    </select>
                 </div>
              </div>
              
              <div className="w-full md:w-80 bg-white border-l border-slate-200 flex flex-col">
                 <div className="p-4 bg-slate-50 border-b border-slate-200">
                   <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Log Kedatangan</h3>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100">
                   {peserta.filter(p => p.statusHadir === 'Hadir').sort((a,b) => b.waktuHadir.localeCompare(a.waktuHadir)).map((p, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-emerald-100 border-l-4 border-l-emerald-500 animate-in slide-in-from-right-4 duration-300">
                         <div className="flex justify-between items-start"><p className="font-bold text-slate-800 text-sm leading-tight pr-2">{p.nama}</p><span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{p.waktuHadir}</span></div>
                         <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin size={10}/> {p.kecamatan}</p>
                      </div>
                   ))}
                   {peserta.filter(p => p.statusHadir === 'Hadir').length === 0 && (
                     <div className="text-center text-slate-400 text-xs italic mt-10">Belum ada peserta yang melakukan scan kehadiran.</div>
                   )}
                 </div>
                 <div className="p-4 bg-white border-t border-slate-200">
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs font-medium border border-blue-100 text-center">
                      Total Hadir: <span className="text-lg font-black">{peserta.filter(p => p.statusHadir === 'Hadir').length}</span> / {peserta.length}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );

  const DashboardView = () => {
    if (currentUser?.role === 'superadmin') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Utama Super Admin</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full"><Briefcase size={28} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Total Pelatih</p><p className="text-3xl font-bold text-slate-800">{pelatih.length}</p></div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-4 bg-blue-100 text-blue-600 rounded-full"><Users size={28} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Total Peserta</p><p className="text-3xl font-bold text-slate-800">{peserta.length}</p></div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-4 bg-amber-100 text-amber-600 rounded-full"><Calendar size={28} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Jadwal Penugasan</p><p className="text-3xl font-bold text-slate-800">{jadwal.length}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Penugasan Terdekat</h3></div>
              <div className="space-y-4">
                {jadwal.slice(0, 5).map(j => (
                  <div key={j.docId} className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        {j.jenis === 'Piket' ? <Shield size={16} className="text-amber-500"/> : <Briefcase size={16} className="text-emerald-500"/>} 
                        {j.jenis === 'Piket' ? 'Tugas Piket Diklatsar' : j.materi}
                      </h4>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1.5"><Clock size={14}/> {j.tanggal} | {j.waktuMulai} WIB</p>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-slate-700">{j.pelatih}</p>
                       <p className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded mt-1 inline-block">Kec. {j.kecamatan}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Aktivitas Sistem</h3>
              <div className="space-y-4">
                {waLogs.slice(0, 5).map(log => (
                  <div key={log.docId} className="flex items-start gap-3">
                    <div className="mt-1"><CheckCircle size={18} className="text-emerald-500" /></div>
                    <div><p className="text-sm text-slate-800 font-medium">[{log.type}] dikirim ke {log.target}</p><p className="text-xs text-slate-500">{log.waktu}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const myJadwal = jadwal.filter(j => j.pelatih === currentUser.name);
    const jadwalHadir = myJadwal.filter(j => j.waktuDatang !== '-').length;

    return (
      <div className="space-y-6">
        <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-1">Selamat Datang, {currentUser.name}!</h2>
            <p className="text-emerald-100 text-sm">Dashboard Sistem Kaderisasi & Presensi Satkorcab</p>
          </div>
          <Users size={120} className="absolute right-4 -bottom-6 text-emerald-500 opacity-30" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-amber-100 text-amber-600 rounded-full"><Calendar size={28} /></div>
            <div><p className="text-sm text-slate-500 font-medium">Total Penugasan Anda</p><p className="text-3xl font-bold text-slate-800">{myJadwal.length}</p></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full"><CheckCircle size={28} /></div>
            <div><p className="text-sm text-slate-500 font-medium">Absensi Kehadiran</p><p className="text-3xl font-bold text-slate-800">{jadwalHadir}</p></div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl flex gap-4 items-start">
           <Bell className="text-blue-500 shrink-0 mt-0.5" />
           <div>
             <h4 className="font-bold text-blue-800 mb-1">Informasi Penggunaan</h4>
             <p className="text-sm text-blue-700 leading-relaxed">Silakan lihat menu di sebelah kiri untuk mengecek secara spesifik <b>Jadwal Mengisi Materi</b> Anda, atau <b>Tugas Piket Diklatsar</b> Anda. Menu akan muncul sesuai dengan tugas yang diberikan Admin kepada Anda.</p>
           </div>
        </div>
      </div>
    );
  };

  const JadwalSayaView = ({ jenis }) => {
    const myJadwal = jadwal.filter(j => j.pelatih === currentUser.name && (jenis === 'Piket' ? j.jenis === 'Piket' : j.jenis !== 'Piket'));
    const judulHalaman = jenis === 'Piket' ? 'Tugas Piket Diklatsar Saya' : 'Jadwal Mengisi Materi Saya';
    const warnaTema = jenis === 'Piket' ? 'amber' : 'emerald';

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <h2 className="text-2xl font-bold text-slate-800 border-b-2 border-slate-200 pb-3">{judulHalaman}</h2>
        {myJadwal.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center flex flex-col items-center justify-center">
             <Calendar size={48} className="text-slate-300 mb-4" />
             <p className="text-slate-500 font-medium">Anda belum memiliki {jenis === 'Piket' ? 'tugas piket' : 'jadwal mengajar'} saat ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {myJadwal.map((j) => (
              <div key={j.docId} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col lg:flex-row transform transition hover:shadow-md">
                <div className={`bg-${warnaTema}-50 border-b lg:border-b-0 lg:border-r border-${warnaTema}-100 p-6 lg:w-1/3 flex flex-col justify-center`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-block bg-${warnaTema}-200 text-${warnaTema}-800 text-xs px-2.5 py-1 rounded-md font-bold`}>{j.displayId}</span>
                    {jenis === 'Piket' && <Shield size={18} className="text-amber-500"/>}
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 leading-tight mb-2">
                    {jenis === 'Piket' ? 'TUGAS PIKET KEPANITIAAN' : j.materi}
                  </h3>
                  <p className={`text-sm text-${warnaTema}-700 font-bold bg-white px-3 py-1.5 rounded-lg border border-${warnaTema}-200 w-max shadow-sm`}>📍 Satkoryon {j.kecamatan}</p>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div>
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Waktu Pelaksanaan</p>
                       <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Calendar size={16} className={`text-${warnaTema}-500`}/> {j.tanggal}</p>
                       <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 mt-1.5"><Clock size={16} className={`text-${warnaTema}-500`}/> {j.waktuMulai} - {j.waktuSelesai} WIB</p>
                    </div>
                    <div>
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Detail Lokasi</p>
                       <p className="text-sm font-semibold text-slate-800 leading-relaxed">{j.tempat}</p>
                       {j.koordinat && (
                          <button onClick={() => openGoogleMaps(j.koordinat)} className={`mt-2 py-1.5 px-3 flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-blue-50 hover:text-blue-600 border border-slate-200 transition`}>
                            <Map size={14} /> Buka di Maps
                          </button>
                        )}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">Status Absensi GPS Anda</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold p-3 rounded-lg border ${j.waktuDatang !== '-' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                        {j.waktuDatang !== '-' ? <CheckCircle size={16}/> : <Clock size={16}/>} Datang: {j.waktuDatang}
                      </div>
                      <div className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold p-3 rounded-lg border ${j.waktuPulang !== '-' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                        {j.waktuPulang !== '-' ? <CheckCircle size={16}/> : <Clock size={16}/>} Pulang: {j.waktuPulang}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-full w-max"><MapPin size={28} /></div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Panel Presensi Geofencing (GPS)</h3>
              <p className="text-sm text-slate-500">Pilih jadwal di bawah ini, sistem akan otomatis melacak jarak Anda.</p>
            </div>
          </div>
          
          {myJadwal.length === 0 ? (
            <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-500 text-center">Belum ada jadwal untuk Anda.</div>
          ) : (
            <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-100">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Jadwal yang akan di-absen:</label>
                <select 
                  value={selectedJadwalPresensi}
                  onChange={(e) => setSelectedJadwalPresensi(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="">-- Sentuh untuk Pilih Jadwal --</option>
                  {myJadwal.map(j => (<option key={j.docId} value={j.docId}>{j.tanggal} | {j.waktuMulai} WIB - {j.jenis === 'Piket' ? 'Tugas Piket' : `Materi: ${j.materi}`} (Kec. {j.kecamatan})</option>))}
                </select>
              </div>

              {selectedJadwalPresensi && (() => {
                const sj = myJadwal.find(j => j.docId === selectedJadwalPresensi);
                if (!sj) return null;
                
                return (
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">Informasi Jarak Anda Saat Ini</h4>
                        {isLocating ? (
                          <p className="text-xs text-blue-500 flex items-center gap-1.5 mt-2 font-bold bg-blue-50 w-max px-3 py-1.5 rounded-full"><Loader2 className="animate-spin" size={14}/> Mendeteksi sinyal GPS...</p>
                        ) : locationError ? (
                          <p className="text-xs text-red-500 mt-2 font-medium flex items-center gap-1.5 bg-red-50 p-2 rounded-lg border border-red-100"><AlertTriangle size={14} className="shrink-0"/> {locationError}</p>
                        ) : userDistance !== null ? (
                          <p className={`text-xl mt-3 font-black flex items-center gap-2 w-max px-5 py-3 rounded-xl border-2 shadow-sm ${userDistance <= 200 ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : 'text-red-700 border-red-300 bg-red-50'}`}>
                            {userDistance <= 200 ? <CheckCircle size={24}/> : <X size={24}/>} 📍 {userDistance} meter {userDistance > 200 && '(Di luar batas lokasi)'}
                          </p>
                        ) : null}
                      </div>
                      <button onClick={() => checkLocation(sj.koordinat)} className="p-2.5 bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition shrink-0 border border-slate-200 shadow-sm" title="Refresh Lokasi GPS"><RefreshCcw size={18} className={isLocating ? 'animate-spin' : ''} /></button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                      <button disabled={sj.waktuDatang !== '-' || userDistance === null || userDistance > 200 || isLocating} onClick={() => handlePelatihPresensi({ id: sj.docId, type: 'datang' })} className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm ${sj.waktuDatang !== '-' || userDistance === null || userDistance > 200 || isLocating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}><Navigation size={18} /> {sj.waktuDatang !== '-' ? 'Telah Absen Datang' : 'Absen Datang Sekarang'}</button>
                      <button disabled={sj.waktuDatang === '-' || sj.waktuPulang !== '-' || userDistance === null || userDistance > 200 || isLocating} onClick={() => handlePelatihPresensi({ id: sj.docId, type: 'pulang' })} className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm ${sj.waktuDatang === '-' || sj.waktuPulang !== '-' || userDistance === null || userDistance > 200 || isLocating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600'}`}><Navigation size={18} /> {sj.waktuPulang !== '-' ? 'Telah Absen Pulang' : 'Absen Pulang Sekarang'}</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
    );
  };

  const PelatihView = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Data Seluruh Pelatih</h2>
        <button onClick={() => setIsAddPelatihModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 shadow-sm">
          <UserPlus size={18} /> Tambah Pelatih Manual
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm whitespace-nowrap">
                <th className="p-4 font-semibold">ID</th>
                <th className="p-4 font-semibold">Nama Pelatih</th>
                <th className="p-4 font-semibold">Alamat</th>
                <th className="p-4 font-semibold">Bidang Keahlian</th>
                <th className="p-4 font-semibold">No. WhatsApp</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pelatih.map((p) => (
                <tr key={p.docId} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 text-sm font-medium text-slate-700">{p.displayId}</td>
                  <td className="p-4 text-sm font-semibold text-slate-800">{p.nama}</td>
                  <td className="p-4 text-sm text-slate-600 max-w-[150px] truncate" title={p.alamat}>{p.alamat || '-'}</td>
                  <td className="p-4 text-sm text-slate-600">{p.bidang}</td>
                  <td className="p-4 text-sm text-slate-600">{p.wa}</td>
                  <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${p.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{p.status}</span></td>
                  <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => handleResetPassword(p)} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-md" title="Reset Password ke 123">
                      <RefreshCcw size={18} />
                    </button>
                    <button onClick={() => openEditPelatih(p)} className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-md" title="Edit Data Pelatih">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => openWhatsAppWeb(p.wa, `Halo ${p.nama},\n\nMohon kesediaannya untuk jadwal pelatihan mendatang.`, p.nama, 'Pesan Personal')} className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-md" title="Kirim Pesan WA Langsung">
                      <Send size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const JadwalView = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Manajemen Jadwal</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={prepareBlastWAPelatih} className="bg-teal-100 text-teal-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-teal-200 font-medium"><Send size={18} /> Blast WA Pelatih</button>
          <button onClick={handleCetakPresensi} className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-200 font-medium"><Printer size={18} /> Cetak PDF Presensi</button>
          <button onClick={() => { setNewJadwal({...newJadwal, jenis: 'Materi'}); setIsAddJadwalModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 font-medium shadow-md"><Plus size={18} /> Jadwal Materi</button>
          <button onClick={() => { setNewJadwal({...newJadwal, jenis: 'Piket', materi: 'Tugas Piket Diklatsar', kuota: 0}); setIsAddJadwalModalOpen(true); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700 font-medium shadow-md"><Shield size={18} /> Tugas Piket</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold">ID</th>
                <th className="p-4 font-bold">Materi / Tugas</th>
                <th className="p-4 font-bold">Pelatih / Pemateri</th>
                <th className="p-4 font-bold">Satkoryon</th>
                <th className="p-4 font-bold">Waktu & Lokasi</th>
                <th className="p-4 font-bold">Kuota</th>
                <th className="p-4 font-bold text-center">Aksi & Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {jadwal.map((j) => {
                const persentase = getPersentase(j.terdaftar, j.kuota);
                return (
                  <tr key={j.docId} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-1 rounded font-bold border border-blue-100">
                        {j.displayId}
                      </span>
                    </td>
                    <td className="p-4">
                      {j.jenis === 'Piket' ? (
                        <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-md font-bold border border-purple-200">
                          <Shield size={14} /> TUGAS PIKET
                        </span>
                      ) : (
                        <p className="text-sm font-bold text-slate-800">{j.materi}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">{j.pelatih}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{j.waPelatih || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                        {j.kecamatan}
                      </span>
                    </td>
                    <td className="p-4 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5"><Calendar size={12} className="text-slate-400"/> <b>{j.tanggal}</b></div>
                      <div className="flex items-center gap-1.5"><Clock size={12} className="text-slate-400"/> {j.waktuMulai} - {j.waktuSelesai} WIB</div>
                      <div className="flex items-center gap-1.5 italic" title={j.koordinat ? `Titik: ${j.koordinat}` : 'Koordinat tidak diatur'}><MapPin size={12} className="text-slate-400"/> {j.tempat}</div>
                    </td>
                    <td className="p-4">
                      {j.jenis === 'Piket' ? (
                        <span className="text-slate-400 text-xs italic">Non-Materi</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>{j.terdaftar || 0} / {j.kuota || 0}</span>
                            <span>{persentase}%</span>
                          </div>
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                              style={{ width: `${persentase}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => sendWhatsAppMock(`Seluruh Peserta ${j.displayId}`, 'Blast Pengumuman')} className="p-2 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-600 hover:text-white transition shadow-sm" title="Blast ke Peserta">
                          <MessageSquare size={16} />
                        </button>
                        <button onClick={() => j.waPelatih ? openWhatsAppWeb(j.waPelatih, `Halo Admin Satkorcab disini,\n\nMengingatkan kembali untuk jadwal penugasan *${j.jenis === 'Piket' ? 'Piket Diklatsar' : j.materi}* pada hari/tanggal ${j.tanggal} jam ${j.waktuMulai} WIB di ${j.tempat}.`, j.pelatih, 'Reminder') : addToast('WA kosong', 'error')} className="p-2 text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-600 hover:text-white transition shadow-sm" title="WA Pelatih">
                          <Send size={16} />
                        </button>
                        <button onClick={() => openEditJadwal(j)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm" title="Edit Data">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleResetPresensiJadwal(j.docId, j.materi)} className="p-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-600 hover:text-white transition shadow-sm" title="Reset Absensi">
                          <RefreshCcw size={16} />
                        </button>
                        <button onClick={() => handleDeleteJadwal(j.docId, j.materi)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition shadow-sm" title="Hapus Data">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {jadwal.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm italic">
            Belum ada jadwal yang dibuat. Klik tombol "Buat Jadwal" untuk memulai.
          </div>
        )}
      </div>
    </div>
  );

  const WhatsAppView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Log WhatsApp & API Gateway</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm">
                <th className="p-4 font-semibold">Waktu</th><th className="p-4 font-semibold">Tipe Pesan</th><th className="p-4 font-semibold">Target Penerima</th><th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {waLogs.map((log) => (
                <tr key={log.docId} className="border-b border-slate-50">
                  <td className="p-4 text-sm text-slate-600">{log.waktu}</td>
                  <td className="p-4 text-sm font-medium text-slate-800">{log.type}</td>
                  <td className="p-4 text-sm text-slate-600">{log.target}</td>
                  <td className="p-4"><span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded w-max text-xs"><CheckCircle size={14} /> {log.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --- RENDER UTAMA ---
  if (dbPermissionError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-lg text-center">
          <AlertTriangle size={40} className="mx-auto text-red-600 mb-4" />
          <h2 className="text-red-600 font-bold text-2xl mb-3">Akses Database Ditolak!</h2>
          <p className="text-slate-600 text-sm mb-6">Pastikan aturan keamanan Firebase Anda tidak terkunci.</p>
          <button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition">Muat Ulang Halaman</button>
        </div>
      </div>
    );
  }

  if (isDbLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="animate-spin mb-4 text-emerald-600" size={48} />
        <p className="font-medium text-lg">Menghubungkan ke Cloud Database...</p>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
          
          {isRegisterModalOpen && (
            <div className="absolute inset-0 bg-white z-20 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <div><h3 className="font-bold text-xl text-slate-800">Registrasi Pelatih</h3><p className="text-xs text-slate-500">Daftar sebagai pemateri baru</p></div>
                <button onClick={() => setIsRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleRegisterPelatih} className="space-y-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap & Gelar</label><input required type="text" value={registerData.nama} onChange={e => setRegisterData({...registerData, nama: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="Cth: Dr. Ahmad Fauzi, M.Pd" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Alamat Domisili</label><textarea required rows="2" value={registerData.alamat} onChange={e => setRegisterData({...registerData, alamat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none" placeholder="Cth: Jl. Raya Kajen No. 12, Pekalongan" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nomor WhatsApp</label><input required type="text" value={registerData.wa} onChange={e => setRegisterData({...registerData, wa: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="Cth: +62812..." /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Bidang Keahlian / Materi</label><input required type="text" value={registerData.bidang} onChange={e => setRegisterData({...registerData, bidang: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="Cth: Ke-NU-an / Kepemimpinan" /></div>
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-xs mt-6 border border-emerald-100"><span className="font-bold">Info:</span> Setelah pendaftaran berhasil, Password default Anda adalah <b>123</b>.</div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition mt-6">Daftar Sekarang</button>
                </form>
              </div>
            </div>
          )}

          <div className="bg-emerald-600 p-8 text-center">
            <h1 className="text-3xl font-bold tracking-wider text-white mb-2">KADER<span className="text-emerald-300">PRO</span></h1>
            <p className="text-emerald-100 text-sm">Sistem Informasi Kaderisasi & Presensi</p>
          </div>
          <div className="p-8 pb-4">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Login Sistem</h2>
            {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 text-center font-medium border border-red-100">{loginError}</div>}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username / Nama (Admin/Panitia/Pelatih)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input required type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" placeholder="Cth: superadmin / admin / Dr. Andi" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" placeholder="••••••••" />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition mt-4">Masuk Sistem</button>
            </form>
            <div className="mt-5 text-center border-t border-slate-100 pt-5">
               <p className="text-sm text-slate-600">Belum terdaftar di database?</p>
               <button onClick={() => setIsRegisterModalOpen(true)} className="text-emerald-600 font-bold hover:underline text-sm mt-1">Daftar sebagai Pelatih Baru</button>
            </div>
            <div className="mt-6 flex justify-center items-center gap-2 text-xs font-medium text-slate-500">
              <span>Status Koneksi:</span>
              <span className={isOnline ? "text-emerald-500 flex items-center gap-1" : "text-red-500 flex items-center gap-1"}>
                {isOnline ? <><CheckCircle size={14}/> Online (Cloud Sync Aktif)</> : <><X size={14}/> Offline (Terputus)</>}
              </span>
            </div>
          </div>
        </div>
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map(toast => (<div key={toast.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-3 text-white transform transition-all duration-300 translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>{toast.type === 'success' ? <CheckCircle size={18} /> : <Settings size={18} className="animate-spin" />}{toast.message}</div>))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-10 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      {Sidebar()}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b border-slate-100 h-16 flex items-center justify-between px-4 lg:px-8 z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500 hover:text-slate-800" onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
            <h2 className="text-lg font-bold text-slate-800 hidden sm:block">Sistem Informasi Kaderisasi</h2>
            {isOnline ? 
              <span className="hidden md:flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-bold border border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online Sync</span> 
              : 
              <span className="hidden md:flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-full font-bold border border-red-100"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Offline</span>
            }
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-bold text-slate-800">{currentUser.name}</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase mt-0.5">
                {currentUser.role === 'superadmin' ? 'Super Admin' : currentUser.role === 'admin' ? 'Panitia / Scanner' : 'Pemateri / Pelatih'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">{currentUser.name.substring(0, 2).toUpperCase()}</div>
            
            <button onClick={() => setIsChangePassModalOpen(true)} className="ml-2 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Ganti Password">
              <Key size={20} />
            </button>
            <button onClick={handleLogout} className="ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Logout"><LogOut size={20} /></button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && DashboardView()}
            {activeTab === 'peserta' && PesertaView()}
            {activeTab === 'izin' && IzinView()}
            {activeTab === 'pelatih' && PelatihView()}
            {activeTab === 'jadwal' && JadwalView()}
            {activeTab === 'jadwal_saya' && JadwalSayaView({jenis: 'Materi'})}
            {activeTab === 'jadwal_piket' && JadwalSayaView({jenis: 'Piket'})}
            {activeTab === 'whatsapp' && WhatsAppView()}
          </div>
        </main>
      </div>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (<div key={toast.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-3 text-white transform transition-all duration-300 translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>{toast.type === 'success' ? <CheckCircle size={18} /> : <Settings size={18} className="animate-spin" />}{toast.message}</div>))}
      </div>

      {/* --- MODAL GANTI PASSWORD PELATIH --- */}
      {isChangePassModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Ganti Password Akun</h3>
              <button onClick={() => { setIsChangePassModalOpen(false); setChangePassError(''); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={submitChangePassword} className="p-5 space-y-4">
              {changePassError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium border border-red-100">{changePassError}</div>}
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Password Lama</label><input required type="password" value={changePassData.oldPass} onChange={e => setChangePassData({...changePassData, oldPass: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label><input required type="password" value={changePassData.newPass} onChange={e => setChangePassData({...changePassData, newPass: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500" minLength="6" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password Baru</label><input required type="password" value={changePassData.confirmPass} onChange={e => setChangePassData({...changePassData, confirmPass: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-emerald-500" minLength="6" /></div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100"><button type="button" onClick={() => { setIsChangePassModalOpen(false); setChangePassError(''); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan Password</button></div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL TAMBAH IZIN PESERTA --- */}
      {isAddIzinModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Catat Izin Keluar Peserta</h3>
              <button onClick={() => setIsAddIzinModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-5">
              <form onSubmit={submitAddIzin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Nama Peserta</label>
                  <select required value={newIzin.namaPeserta} onChange={e => setNewIzin({...newIzin, namaPeserta: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500 bg-slate-50 font-medium">
                    <option value="">-- Ketik / Pilih Peserta --</option>
                    {peserta.map(p => (<option key={p.docId} value={p.nama}>{p.nama} ({p.kecamatan})</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Dari Jam</label><input required type="time" value={newIzin.jamMulai} onChange={e => setNewIzin({...newIzin, jamMulai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Sampai Jam</label><input required type="time" value={newIzin.jamSelesai} onChange={e => setNewIzin({...newIzin, jamSelesai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Materi / Sesi yang Ditinggalkan</label>
                  <select required value={newIzin.materi} onChange={e => setNewIzin({...newIzin, materi: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500 bg-slate-50">
                    <option value="">-- Pilih Materi / Jadwal --</option>
                    {jadwal.map(j => (<option key={j.docId} value={j.materi}>{j.materi} ({j.waktuMulai} - {j.waktuSelesai})</option>))}
                    <option value="Lainnya">Lainnya / Tidak ada materi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Alasan Izin</label>
                  <textarea required rows="2" value={newIzin.alasan} onChange={e => setNewIzin({...newIzin, alasan: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500 resize-none" placeholder="Cth: Menghadiri acara keluarga mendadak..." />
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsAddIzinModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan Izin</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isAddPelatihModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-lg text-slate-800">Tambah Data Pelatih</h3><button onClick={() => setIsAddPelatihModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
            <form onSubmit={submitAddPelatih} className="p-4 space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap & Gelar</label><input required type="text" value={newPelatih.nama} onChange={e => setNewPelatih({...newPelatih, nama: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="Masukkan nama pelatih..." /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label><textarea required rows="2" value={newPelatih.alamat} onChange={e => setNewPelatih({...newPelatih, alamat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500 resize-none" placeholder="Alamat domisili..." /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Bidang / Materi Spesialisasi</label><input required type="text" value={newPelatih.bidang} onChange={e => setNewPelatih({...newPelatih, bidang: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="Contoh: Ke-NU-an" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nomor WhatsApp</label><input required type="text" value={newPelatih.wa} onChange={e => setNewPelatih({...newPelatih, wa: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="Contoh: +62812..." /></div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100"><button type="button" onClick={() => setIsAddPelatihModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan ke Cloud</button></div>
            </form>
          </div>
        </div>
      )}

      {isEditPelatihModalOpen && editPelatihData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Edit Data Pelatih</h3>
              <button onClick={() => { setIsEditPelatihModalOpen(false); setEditPelatihData(null); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={submitEditPelatih} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                <input required type="text" value={editPelatihData.nama} onChange={e => setEditPelatihData({...editPelatihData, nama: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
                <textarea required rows="2" value={editPelatihData.alamat} onChange={e => setEditPelatihData({...editPelatihData, alamat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bidang / Materi Spesialisasi</label>
                <input required type="text" value={editPelatihData.bidang} onChange={e => setEditPelatihData({...editPelatihData, bidang: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nomor WhatsApp</label>
                <input required type="text" value={editPelatihData.wa} onChange={e => setEditPelatihData({...editPelatihData, wa: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status Keaktifan</label>
                <select value={editPelatihData.status} onChange={e => setEditPelatihData({...editPelatihData, status: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500">
                  <option value="Aktif">Aktif</option>
                  <option value="Tidak Aktif">Tidak Aktif</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setIsEditPelatihModalOpen(false); setEditPelatihData(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddJadwalModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{newJadwal.jenis === 'Piket' ? 'Buat Tugas Piket Baru' : 'Buat Jadwal Materi Baru'}</h3>
              <button onClick={() => setIsAddJadwalModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-4">
              <form onSubmit={submitAddJadwal} className="space-y-4">
                
                {/* Field yang disembunyikan untuk mempermudah logika */}
                <input type="hidden" value={newJadwal.jenis} />

                {/* Sembunyikan Input Materi jika yang dipilih adalah PIKET */}
                {(!newJadwal.jenis || newJadwal.jenis === 'Materi') && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Materi Pelatihan</label>
                    <input required type="text" value={newJadwal.materi} onChange={e => setNewJadwal({...newJadwal, materi: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="Contoh: Ke-NU-an" />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pemateri / Petugas</label>
                    <select required value={newJadwal.pelatih} onChange={e => { const selected = pelatih.find(p => p.nama === e.target.value); setNewJadwal({...newJadwal, pelatih: selected ? selected.nama : e.target.value, waPelatih: selected ? selected.wa : ''}); }} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500">
                      <option value="">-- Pilih Pelatih --</option>
                      {pelatih.filter(p => p.status === 'Aktif').map(p => (<option key={p.docId} value={p.nama}>{p.nama}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">No. WA</label><input required type="text" value={newJadwal.waPelatih} onChange={e => setNewJadwal({...newJadwal, waPelatih: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="Otomatis terisi..." /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Satkoryon (Kecamatan)</label>
                    <select required value={newJadwal.kecamatan} onChange={e => setNewJadwal({...newJadwal, kecamatan: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500">
                      {daftarKecamatan.map(kec => (<option key={kec} value={kec}>{kec}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Tempat</label><input required type="text" value={newJadwal.tempat} onChange={e => setNewJadwal({...newJadwal, tempat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="Lokasi pelatihan..." /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Titik Koordinat Lokasi (Penting untuk GPS)</label><input required type="text" value={newJadwal.koordinat} onChange={e => setNewJadwal({...newJadwal, koordinat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="-6.8898, 109.6745" /></div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pelatihan</label><input required type="date" value={newJadwal.tanggal} onChange={e => setNewJadwal({...newJadwal, tanggal: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                  
                  {/* Sembunyikan Kuota jika Piket */}
                  {(!newJadwal.jenis || newJadwal.jenis === 'Materi') ? (
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Kuota Peserta</label><input required type="number" min="1" value={newJadwal.kuota} onChange={e => setNewJadwal({...newJadwal, kuota: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="Contoh: 50" /></div>
                  ) : (
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Kuota Peserta</label><input disabled type="text" value="Non-Materi" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-100 text-slate-400 cursor-not-allowed" /></div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Jam Mulai</label><input required type="time" value={newJadwal.waktuMulai} onChange={e => setNewJadwal({...newJadwal, waktuMulai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Jam Selesai</label><input required type="time" value={newJadwal.waktuSelesai} onChange={e => setNewJadwal({...newJadwal, waktuSelesai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                </div>
                <div className="flex items-center gap-2 mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100"><input type="checkbox" id="autoSend" checked={autoSendWA} onChange={(e) => setAutoSendWA(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer" /><label htmlFor="autoSend" className="text-sm text-emerald-800 cursor-pointer font-medium">Otomatis kirim info penugasan via WA (API) ke pelatih</label></div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100"><button type="button" onClick={() => setIsAddJadwalModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan ke Cloud</button></div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isEditJadwalModalOpen && editJadwalData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Edit Jadwal</h3>
              <button onClick={() => { setIsEditJadwalModalOpen(false); setEditJadwalData(null); }} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-4">
              <form onSubmit={submitEditJadwal} className="space-y-4">
                
                {/* --- TAMBAHAN JENIS PENUGASAN (EDIT) --- */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Penugasan</label>
                  <select required value={editJadwalData.jenis || 'Materi'} onChange={e => setEditJadwalData({...editJadwalData, jenis: e.target.value, materi: e.target.value === 'Piket' ? 'Tugas Piket Diklatsar' : ''})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500 font-medium bg-slate-50">
                    <option value="Materi">Pemateri / Instruktur (Sesuai Materi)</option>
                    <option value="Piket">Tugas Piket Diklatsar (Non-Materi)</option>
                  </select>
                </div>

                {(!editJadwalData.jenis || editJadwalData.jenis === 'Materi') && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Materi Pelatihan</label>
                    <input required type="text" value={editJadwalData.materi} onChange={e => setEditJadwalData({...editJadwalData, materi: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pemateri / Petugas</label>
                    <select required value={editJadwalData.pelatih} onChange={e => { const selected = pelatih.find(p => p.nama === e.target.value); setEditJadwalData({...editJadwalData, pelatih: selected ? selected.nama : e.target.value, waPelatih: selected ? selected.wa : ''}); }} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500">
                      <option value="">-- Pilih Pelatih --</option>
                      {pelatih.filter(p => p.status === 'Aktif').map(p => (<option key={p.docId} value={p.nama}>{p.nama}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">No. WA Pemateri</label><input required type="text" value={editJadwalData.waPelatih} onChange={e => setEditJadwalData({...editJadwalData, waPelatih: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Satkoryon (Kecamatan)</label>
                    <select required value={editJadwalData.kecamatan} onChange={e => setEditJadwalData({...editJadwalData, kecamatan: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500">
                      {daftarKecamatan.map(kec => (<option key={kec} value={kec}>{kec}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Tempat</label><input required type="text" value={editJadwalData.tempat} onChange={e => setEditJadwalData({...editJadwalData, tempat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Titik Koordinat Lokasi</label><input required type="text" value={editJadwalData.koordinat} onChange={e => setEditJadwalData({...editJadwalData, koordinat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" placeholder="-6.8898, 109.6745" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pelatihan</label><input required type="date" value={editJadwalData.tanggal} onChange={e => setEditJadwalData({...editJadwalData, tanggal: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                  
                  {(!editJadwalData.jenis || editJadwalData.jenis === 'Materi') ? (
                     <div><label className="block text-sm font-medium text-slate-700 mb-1">Kuota Peserta</label><input required type="number" min="1" value={editJadwalData.kuota} onChange={e => setEditJadwalData({...editJadwalData, kuota: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                  ) : (
                     <div><label className="block text-sm font-medium text-slate-700 mb-1">Kuota Peserta</label><input disabled type="text" value="Non-Materi" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-100 text-slate-400 cursor-not-allowed" /></div>
                  )}

                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Jam Mulai</label><input required type="time" value={editJadwalData.waktuMulai} onChange={e => setEditJadwalData({...editJadwalData, waktuMulai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Jam Selesai</label><input required type="time" value={editJadwalData.waktuSelesai} onChange={e => setEditJadwalData({...editJadwalData, waktuSelesai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500" /></div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => { setIsEditJadwalModalOpen(false); setEditJadwalData(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Simpan Perubahan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isBlastModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-lg text-slate-800">Blast WA ke Pelatih</h3><button onClick={() => setIsBlastModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
            <div className="overflow-y-auto p-4 space-y-4">
              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg text-sm border border-emerald-100">Sistem API akan mengirimkan pesan massal ke <b>{blastTargets.length} pelatih</b> di latar belakang.</div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Daftar Penerima:</label>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1">
                  {blastTargets.map((t, idx) => (<div key={idx} className="text-sm text-slate-600 flex justify-between"><span className="font-semibold">{t.pelatih}</span><span className="font-mono text-xs">{t.waPelatih}</span></div>))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template Pesan (Bisa diedit):</label>
                <textarea rows="5" value={blastMessage} onChange={(e) => setBlastMessage(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-emerald-500 resize-none"/>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => setIsBlastModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                <button onClick={executeBlastWA} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-2"><Send size={16} /> Kirim API Sekarang</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}