import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, MessageSquare, CheckCircle, 
  Settings, Bell, Search, Plus, UserPlus, 
  Send, Clock, Menu, X, Printer, Briefcase,
  LogOut, Lock, User, MapPin, Key, RefreshCcw, 
  Trash2, AlertTriangle, Navigation, Loader2, Map,
  Pencil, QrCode, Shield
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, addDoc, getDocs, deleteDoc } from 'firebase/firestore';

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

// --- PENGAMAN PERHITUNGAN PERSENTASE KUOTA ---
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

  // States untuk Auth Aplikasi (Login Form)
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  
  // States untuk data dari Cloud Firestore
  const [pelatih, setPelatih] = useState([]);
  const [jadwal, setJadwal] = useState([]);
  const [waLogs, setWaLogs] = useState([]);

  // States untuk Modal Form Admin
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

  // --- STATE DETEKSI LOKASI OTOMATIS ---
  const [selectedJadwalPresensi, setSelectedJadwalPresensi] = useState('');
  const [userDistance, setUserDistance] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  // --- FIREBASE & KONEKSI INISIALISASI ---
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

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- FIREBASE DATA SYNC (REAL-TIME) ---
  useEffect(() => {
    if (!firebaseUser) return;

    let isMounted = true;
    let unsubPelatih = () => {};
    let unsubJadwal = () => {};
    let unsubLogs = () => {};

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

      const checkAndSeedData = async () => {
        try {
          const pSnap = await getDocs(pelatihRef);
          if (pSnap.empty) {
            const initialPelatih = [
              { displayId: 'P001', nama: 'Dr. Andi Pratama', alamat: 'Kajen, Pekalongan', wa: '+628111222333', bidang: 'Kepemimpinan & Organisasi', status: 'Aktif', password: '123' }
            ];
            initialPelatih.forEach(p => addDoc(pelatihRef, p));
          }
        } catch(err) { handlePermissionError(err, 'Seeding'); }
      };
      
      checkAndSeedData();

      unsubPelatih = onSnapshot(
        pelatihRef, 
        (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => (a.displayId > b.displayId) ? 1 : -1);
          setPelatih(data);
          setIsDbLoading(false); 
        }, 
        (err) => handlePermissionError(err, 'Pelatih')
      );

      unsubJadwal = onSnapshot(
        jadwalRef, 
        (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => (b.displayId > a.displayId) ? 1 : -1);
          setJadwal(data);
        }, 
        (err) => handlePermissionError(err, 'Jadwal')
      );

      unsubLogs = onSnapshot(
        logsRef, 
        (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
          data.sort((a, b) => b.timestamp - a.timestamp);
          setWaLogs(data);
        }, 
        (err) => handlePermissionError(err, 'Logs')
      );

    } catch (err) {
      handlePermissionError(err, 'Init Collection');
    }

    return () => {
      isMounted = false;
      unsubPelatih();
      unsubJadwal();
      unsubLogs();
    };
  }, [firebaseUser]);

  // --- FUNGSI GLOBAL ---
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const openGoogleMaps = (koordinat) => {
    if (!koordinat || koordinat.trim() === '') {
      addToast('Titik koordinat lokasi belum diatur.', 'error');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${koordinat}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // --- HANDLER LOGIN, REGISTRASI & LOGOUT ---
  const handleLogin = (e) => {
    e.preventDefault();
    const cleanInputUser = username.trim().toLowerCase();

    if (cleanInputUser === 'admin' && password === '123') {
      setCurrentUser({ username: 'admin', role: 'admin', name: 'Admin Satkorcab' });
      setActiveTab('dashboard');
      setLoginError('');
      addToast(`Selamat datang, Admin Satkorcab!`, 'success');
      return;
    }

    const foundPelatih = pelatih.find(p => p.nama.trim().toLowerCase() === cleanInputUser);
    
    if (foundPelatih) {
      const currentDbPassword = foundPelatih.password || '123';
      if (password === currentDbPassword) {
        setCurrentUser({ username: foundPelatih.nama, role: 'pelatih', name: foundPelatih.nama, docId: foundPelatih.docId });
        setActiveTab('dashboard'); 
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
    const pelatihRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih');
    try {
      await addDoc(pelatihRef, { 
        displayId, nama: registerData.nama.trim(), alamat: registerData.alamat, wa: registerData.wa, bidang: registerData.bidang, status: 'Aktif', password: '123'
      });
      setIsRegisterModalOpen(false);
      setRegisterData({ nama: '', alamat: '', wa: '', bidang: '' });
      addToast('Registrasi berhasil! Silakan Login.', 'success');
    } catch (error) {
      addToast('Gagal melakukan pendaftaran.', 'error');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUsername('');
    setPassword('');
    setActiveTab('dashboard');
    setSelectedJadwalPresensi('');
    setUserDistance(null);
    setLocationError('');
    addToast('Anda telah logout.', 'info');
  };

  // --- CRUD CLOUD FIRESTORE PELATIH ---
  const submitAddPelatih = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Menyimpan ke Cloud...', 'info');
    const displayId = `P${String(pelatih.length + 1).padStart(3, '0')}`;
    const pelatihRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih');
    try {
      await addDoc(pelatihRef, { displayId, ...newPelatih, nama: newPelatih.nama.trim(), password: '123' });
      setIsAddPelatihModalOpen(false);
      setNewPelatih({ nama: '', alamat: '', wa: '', bidang: '', status: 'Aktif' });
      addToast('Data pelatih berhasil disimpan di Cloud!', 'success');
    } catch (error) {
      addToast('Gagal menyimpan data.', 'error');
    }
  };

  const submitEditPelatih = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Menyimpan perubahan...', 'info');
    const pelatihRef = doc(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih', editPelatihData.docId);
    try {
      await updateDoc(pelatihRef, { 
        nama: editPelatihData.nama.trim(), alamat: editPelatihData.alamat, bidang: editPelatihData.bidang, wa: editPelatihData.wa, status: editPelatihData.status 
      });
      setIsEditPelatihModalOpen(false);
      setEditPelatihData(null);
      addToast('Data pelatih berhasil diperbarui!', 'success');
    } catch (error) {
      addToast('Gagal memperbarui data.', 'error');
    }
  };

  const openEditPelatih = (p) => { setEditPelatihData({ ...p }); setIsEditPelatihModalOpen(true); };

  const handleResetPassword = async (p) => {
    if (!firebaseUser) return;
    const confirmReset = window.confirm(`Apakah Anda yakin ingin mereset password pelatih ${p.nama} menjadi "123"?`);
    if (!confirmReset) return;
    addToast(`Mereset password ${p.nama}...`, 'info');
    const pelatihRef = doc(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih', p.docId);
    try {
      await updateDoc(pelatihRef, { password: '123' });
      addToast(`Password ${p.nama} berhasil direset ke 123!`, 'success');
    } catch (error) {
      addToast('Gagal mereset password.', 'error');
    }
  };

  const submitChangePassword = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (changePassData.newPass !== changePassData.confirmPass) { setChangePassError('Konfirmasi Password tidak cocok!'); return; }
    const userInDb = pelatih.find(p => p.docId === currentUser.docId);
    const currentDbPassword = userInDb?.password || '123';
    if (changePassData.oldPass !== currentDbPassword) { setChangePassError('Password Lama salah!'); return; }
    addToast('Menyimpan password baru...', 'info');
    const pelatihRef = doc(db, 'artifacts', appId, 'public', 'data', 'kader_pelatih', currentUser.docId);
    try {
      await updateDoc(pelatihRef, { password: changePassData.newPass });
      setIsChangePassModalOpen(false);
      setChangePassData({ oldPass: '', newPass: '', confirmPass: '' });
      setChangePassError('');
      addToast('Password berhasil diganti!', 'success');
    } catch (error) {
      setChangePassError('Gagal mengubah password di database.');
    }
  };

  // --- CRUD CLOUD FIRESTORE JADWAL ---
  const submitAddJadwal = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Menyimpan jadwal ke Cloud...', 'info');
    const displayId = `J${String(jadwal.length + 1).padStart(3, '0')}`;
    const jadwalRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal');
    const addedJadwal = { 
      displayId, 
      ...newJadwal, 
      jenis: newJadwal.jenis || 'Materi',
      materi: newJadwal.jenis === 'Piket' ? 'Tugas Piket Diklatsar' : newJadwal.materi,
      kuota: newJadwal.jenis === 'Piket' ? 0 : newJadwal.kuota,
      terdaftar: 0, 
      statusPelatih: 'Belum Hadir', 
      waktuDatang: '-', 
      waktuPulang: '-' 
    };
    try {
      await addDoc(jadwalRef, addedJadwal);
      setIsAddJadwalModalOpen(false);
      setNewJadwal({ jenis: 'Materi', materi: '', pelatih: '', waPelatih: '', tanggal: '', waktuMulai: '', waktuSelesai: '', tempat: '', koordinat: '', kuota: '', kecamatan: 'Buaran', waktuDatang: '-', waktuPulang: '-' });
      addToast('Jadwal baru berhasil disimpan di Cloud!', 'success');
      if (autoSendWA && addedJadwal.waPelatih) { setTimeout(() => sendWhatsAppMock(addedJadwal.pelatih, 'Jadwal Pemateri Baru'), 1000); }
    } catch (error) {
      addToast('Gagal menyimpan jadwal.', 'error');
    }
  };

  const openEditJadwal = (j) => { setEditJadwalData({ ...j, jenis: j.jenis || 'Materi', koordinat: j.koordinat || '' }); setIsEditJadwalModalOpen(true); };

  const submitEditJadwal = async (e) => {
    e.preventDefault();
    if (!firebaseUser) return;
    addToast('Menyimpan perubahan jadwal...', 'info');
    const jRef = doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', editJadwalData.docId);
    try {
      await updateDoc(jRef, {
        jenis: editJadwalData.jenis || 'Materi',
        materi: editJadwalData.jenis === 'Piket' ? 'Tugas Piket Diklatsar' : editJadwalData.materi,
        pelatih: editJadwalData.pelatih, waPelatih: editJadwalData.waPelatih,
        kecamatan: editJadwalData.kecamatan, tempat: editJadwalData.tempat, koordinat: editJadwalData.koordinat,
        tanggal: editJadwalData.tanggal, 
        kuota: editJadwalData.jenis === 'Piket' ? 0 : editJadwalData.kuota, 
        waktuMulai: editJadwalData.waktuMulai, waktuSelesai: editJadwalData.waktuSelesai,
      });
      setIsEditJadwalModalOpen(false);
      setEditJadwalData(null);
      addToast('Jadwal berhasil diperbarui!', 'success');
    } catch (error) {
      addToast('Gagal memperbarui jadwal.', 'error');
    }
  };

  const handleResetPresensiJadwal = async (id, materi) => {
    if (!firebaseUser) return;
    const confirmReset = window.confirm(`Apakah Anda yakin ingin mereset data presensi untuk jadwal "${materi}"?`);
    if (!confirmReset) return;
    addToast('Mereset data presensi...', 'info');
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', id), { waktuDatang: '-', waktuPulang: '-', statusPelatih: 'Belum Hadir' });
      addToast('Presensi jadwal berhasil dikosongkan!', 'success');
    } catch (error) { addToast('Gagal mereset presensi jadwal.', 'error'); }
  };

  const handleDeleteJadwal = async (id, materi) => {
    if (!firebaseUser) return;
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin MENGHAPUS jadwal "${materi}" secara permanen?`);
    if (!confirmDelete) return;
    addToast('Menghapus jadwal...', 'info');
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', id));
      addToast('Jadwal berhasil dihapus!', 'success');
    } catch (error) { addToast('Gagal menghapus jadwal.', 'error'); }
  };

  const handlePelatihPresensi = async (target) => {
    if (!firebaseUser) return;
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const jRef = doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', target.id);
    try {
      const updateData = { statusPelatih: 'Hadir' };
      if (target.type === 'datang') updateData.waktuDatang = now;
      if (target.type === 'pulang') updateData.waktuPulang = now;
      await updateDoc(jRef, updateData);
      addToast(`Presensi ${target.type} tersimpan di Cloud pada ${now} WIB`, 'success');
    } catch (error) {
      addToast('Gagal mencatat presensi di Cloud.', 'error');
    }
  };

  const addLogToCloud = async (target, type, status) => {
    if (!firebaseUser) return;
    const timestamp24h = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'kader_logs');
    try { await addDoc(logsRef, { target: target, type: type, status: status, waktu: timestamp24h, timestamp: Date.now() }); } catch (error) {}
  };

  const openWhatsAppWeb = (phone, text, targetName, type) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank', 'noopener,noreferrer');
    addToast(`Membuka WhatsApp untuk ${targetName}...`, 'success');
    addLogToCloud(targetName, type, 'Dialihkan ke WA App');
  };

  const sendWhatsAppMock = (target, type) => {
    addToast(`Memproses ${type} via Cloud API ke ${target}...`, 'info');
    setTimeout(() => {
      addToast(`Berhasil mengirim pesan ke ${target}!`, 'success');
      addLogToCloud(target, type, 'Terkirim');
    }, 1500);
  };

  const prepareBlastWAPelatih = () => {
    const uniquePelatih = [];
    const map = new Map();
    for (const j of jadwal) {
      if (j.waPelatih && j.waPelatih !== '-' && !map.has(j.waPelatih)) {
        map.set(j.waPelatih, true); uniquePelatih.push(j);
      }
    }
    if (uniquePelatih.length === 0) { addToast('Belum ada data jadwal pelatih dengan nomor WA valid.', 'error'); return; }
    setBlastTargets(uniquePelatih);
    setIsBlastModalOpen(true);
  };

  const executeBlastWA = () => {
    setIsBlastModalOpen(false);
    addToast(`Memulai broadcast API ke ${blastTargets.length} pelatih...`, 'info');
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

  // --- LOGIKA PELACAKAN LOKASI OTOMATIS (GPS) ---
  const checkLocation = (koordinat) => {
    if (!koordinat || koordinat.trim() === '') {
      setLocationError('Admin belum mengatur titik koordinat (Silakan hubungi Admin).');
      setUserDistance(null);
      return;
    }

    const coords = koordinat.split(',').map(c => parseFloat(c.trim()));
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
      setLocationError('Format koordinat tidak valid.');
      setUserDistance(null);
      return;
    }

    setIsLocating(true);
    setLocationError('');
    setUserDistance(null);

    if (!navigator.geolocation) {
      setLocationError('Browser/HP Anda tidak mendukung fitur GPS.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, coords[0], coords[1]);
        setUserDistance(dist);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setLocationError('Akses GPS ditolak! Anda harus Mengizinkan (Allow) Izin Lokasi di browser saat diminta.');
        } else {
          setLocationError('Sinyal GPS lemah atau gagal dideteksi. Pastikan GPS HP menyala dan coba di area terbuka.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Memicu pencarian lokasi secara otomatis setiap kali jadwal dipilih
  useEffect(() => {
    if (selectedJadwalPresensi) {
      const sj = jadwal.find(j => j.docId === selectedJadwalPresensi);
      if (sj) checkLocation(sj.koordinat);
    } else {
      setUserDistance(null);
      setLocationError('');
    }
  }, [selectedJadwalPresensi, jadwal]);

  // --- KOMPONEN PANEL PRESENSI (REUSABLE) ---
  const renderPanelPresensi = (myJadwal) => (
    <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="p-4 bg-blue-100 text-blue-600 rounded-full w-max">
          <MapPin size={28} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800">Panel Presensi Geofencing (GPS)</h3>
          <p className="text-sm text-slate-500">Pilih jadwal mengajar/piket Anda di bawah ini, sistem akan otomatis melacak jarak Anda.</p>
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
              {myJadwal.map(j => (
                <option key={j.docId} value={j.docId}>
                  {j.tanggal} | {j.waktuMulai} WIB - {j.jenis === 'Piket' ? 'Tugas Piket' : `Materi: ${j.materi}`} (Kec. {j.kecamatan})
                </option>
              ))}
            </select>
          </div>

          {selectedJadwalPresensi && (() => {
            const sj = myJadwal.find(j => j.docId === selectedJadwalPresensi);
            if (!sj) return null;
            
            return (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      Informasi Jarak Anda Saat Ini
                    </h4>
                    {isLocating ? (
                      <p className="text-xs text-blue-500 flex items-center gap-1.5 mt-2 font-bold bg-blue-50 w-max px-3 py-1.5 rounded-full">
                        <Loader2 className="animate-spin" size={14}/> Mendeteksi sinyal GPS...
                      </p>
                    ) : locationError ? (
                      <p className="text-xs text-red-500 mt-2 font-medium flex items-center gap-1.5 bg-red-50 p-2 rounded-lg border border-red-100">
                        <AlertTriangle size={14} className="shrink-0"/> {locationError}
                      </p>
                    ) : userDistance !== null ? (
                      <p className={`text-sm mt-2 font-bold flex items-center gap-1.5 bg-slate-50 w-max px-3 py-1.5 rounded-lg border ${userDistance <= 200 ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-500 border-red-200 bg-red-50'}`}>
                        {userDistance <= 200 ? <CheckCircle size={16}/> : <X size={16}/>}
                        📍 {userDistance} meter {userDistance > 200 && '(Di luar batas 200m)'}
                      </p>
                    ) : null}
                  </div>
                  <button onClick={() => checkLocation(sj.koordinat)} className="p-2.5 bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition shrink-0 border border-slate-200 shadow-sm" title="Refresh Lokasi GPS">
                    <RefreshCcw size={18} className={isLocating ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                  <button 
                    disabled={sj.waktuDatang !== '-' || userDistance === null || userDistance > 200 || isLocating} 
                    onClick={() => handlePelatihPresensi({ id: sj.docId, type: 'datang' })} 
                    className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm ${sj.waktuDatang !== '-' || userDistance === null || userDistance > 200 || isLocating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    <Navigation size={18} /> {sj.waktuDatang !== '-' ? 'Telah Absen Datang' : 'Absen Datang Sekarang'}
                  </button>
                  <button 
                    disabled={sj.waktuDatang === '-' || sj.waktuPulang !== '-' || userDistance === null || userDistance > 200 || isLocating} 
                    onClick={() => handlePelatihPresensi({ id: sj.docId, type: 'pulang' })} 
                    className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm ${sj.waktuDatang === '-' || sj.waktuPulang !== '-' || userDistance === null || userDistance > 200 || isLocating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                  >
                    <Navigation size={18} /> {sj.waktuPulang !== '-' ? 'Telah Absen Pulang' : 'Absen Pulang Sekarang'}
                  </button>
                </div>

                {/* Tombol Rahasia Untuk Pengujian Admin/Developer */}
                <div className="mt-5 text-center">
                  <button onClick={() => { addToast('Menggunakan Bypass GPS Dev', 'info'); handlePelatihPresensi({ id: sj.docId, type: sj.waktuDatang === '-' ? 'datang' : 'pulang' }); }} className="text-[10px] text-slate-300 font-medium hover:text-blue-500 transition">
                    [Mode Admin] Bypass GPS jika lokasi bermasalah
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );

  // --- KOMPONEN TAMPILAN ---
  const Sidebar = () => {
    const menus = currentUser?.role === 'admin' 
      ? [ { id: 'dashboard', icon: <Calendar size={20}/>, label: 'Dashboard' }, { id: 'pelatih', icon: <Briefcase size={20}/>, label: 'Data Pelatih' }, { id: 'jadwal', icon: <Clock size={20}/>, label: 'Jadwal & Presensi' }, { id: 'whatsapp', icon: <MessageSquare size={20}/>, label: 'Log WhatsApp' } ]
      : [ { id: 'dashboard', icon: <Calendar size={20}/>, label: 'Dashboard Pelatih' }, { id: 'jadwal_saya', icon: <Clock size={20}/>, label: 'Semua Jadwal Saya' } ];

    return (
      <div className={`${isSidebarOpen ? 'block' : 'hidden'} md:block w-64 bg-slate-900 text-white min-h-screen flex flex-col transition-all duration-300 z-20`}>
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-wider text-blue-400">KADER<span className="text-white">PRO</span></h1>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <div className="flex-1 py-6 flex flex-col gap-2 px-3">
          {menus.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              {item.icon} <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const DashboardView = () => {
    if (currentUser?.role === 'admin') {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Utama</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-4 bg-blue-100 text-blue-600 rounded-full"><Briefcase size={28} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Total Pelatih</p><p className="text-3xl font-bold text-slate-800">{pelatih.length}</p></div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-4 bg-amber-100 text-amber-600 rounded-full"><Calendar size={28} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Jadwal Mendatang</p><p className="text-3xl font-bold text-slate-800">{jadwal.length}</p></div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full"><CheckCircle size={28} /></div>
              <div><p className="text-sm text-slate-500 font-medium">Pelatih Aktif</p><p className="text-3xl font-bold text-slate-800">{pelatih.filter(p => p.status === 'Aktif').length}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Pelatihan Terdekat</h3></div>
              <div className="space-y-4">
                {jadwal.slice(0, 5).map(j => (
                  <div key={j.docId} className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-slate-800">{j.jenis === 'Piket' ? '🛡️ Tugas Piket Diklatsar' : j.materi}</h4>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Clock size={14}/> {j.tanggal} | {j.waktuMulai} - {j.waktuSelesai}</p>
                      <p className="text-xs text-indigo-600 font-medium mt-1">Satkoryon {j.kecamatan}</p>
                    </div>
                    <button onClick={() => sendWhatsAppMock(`Peserta ${j.materi}`, 'Reminder H-1')} className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-md font-medium hover:bg-blue-200">Auto-Remind WA</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Log Pesan Terbaru</h3>
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
        <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-md">
          <h2 className="text-2xl font-bold mb-1">Selamat Datang, {currentUser.name}!</h2>
          <p className="text-blue-100 text-sm">Dashboard Pemateri & Pelatih Kaderisasi</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-amber-100 text-amber-600 rounded-full"><Calendar size={28} /></div>
            <div><p className="text-sm text-slate-500 font-medium">Total Jadwal Anda</p><p className="text-3xl font-bold text-slate-800">{myJadwal.length}</p></div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full"><CheckCircle size={28} /></div>
            <div><p className="text-sm text-slate-500 font-medium">Total Kehadiran</p><p className="text-3xl font-bold text-slate-800">{jadwalHadir}</p></div>
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mt-6 border-b border-slate-200 pb-2">Jadwal Terdekat & Absensi</h3>
        
        {myJadwal.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center text-slate-500">Belum ada jadwal pelatihan yang ditugaskan kepada Anda.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {myJadwal.slice(0, 4).map((j) => (
              <div key={j.docId} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="bg-indigo-50 border-b border-indigo-100 p-5 flex flex-col justify-center relative">
                  <span className="absolute top-4 right-4 bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded font-bold">{j.displayId}</span>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight mb-1 pr-10">
                    {j.jenis === 'Piket' ? '🛡️ Tugas Piket Diklatsar' : j.materi}
                  </h3>
                  <p className="text-sm text-indigo-600 font-medium">Satkoryon {j.kecamatan}</p>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2 mb-6">
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2"><Calendar size={16} className="text-slate-400"/> {j.tanggal}</p>
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2"><Clock size={16} className="text-slate-400"/> {j.waktuMulai} - {j.waktuSelesai} WIB</p>
                    <p className="text-sm font-medium text-slate-700 flex items-start gap-2"><MapPin size={16} className="text-slate-400 mt-0.5"/> <span>{j.tempat}</span></p>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium bg-slate-50 p-3 rounded-lg">
                      <span className={j.waktuDatang !== '-' ? 'text-emerald-600' : 'text-slate-500'}>Datang: {j.waktuDatang}</span>
                      <span className={j.waktuPulang !== '-' ? 'text-emerald-600' : 'text-slate-500'}>Pulang: {j.waktuPulang}</span>
                    </div>
                    {j.koordinat && (
                      <button onClick={() => openGoogleMaps(j.koordinat)} className="w-full mt-2 py-2 flex items-center justify-center gap-2 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-200 transition">
                        <Map size={16} /> Buka di Google Maps
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {renderPanelPresensi(myJadwal)}
      </div>
    );
  };

  const PelatihView = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Data Seluruh Pelatih</h2>
        <button onClick={() => setIsAddPelatihModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm">
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

  const JadwalSayaView = () => {
    const myJadwal = jadwal.filter(j => j.pelatih === currentUser.name);

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Semua Jadwal Mengajar Saya</h2>
        {myJadwal.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center text-slate-500">Belum ada jadwal pelatihan yang ditugaskan kepada Anda.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {myJadwal.map((j) => (
              <div key={j.docId} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col md:flex-row">
                <div className="bg-blue-50 border-b md:border-b-0 md:border-r border-blue-100 p-6 md:w-1/3 flex flex-col justify-center">
                  <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold w-max mb-2">{j.displayId}</span>
                  <h3 className="text-xl font-bold text-slate-800 leading-tight mb-2">
                    {j.jenis === 'Piket' ? '🛡️ Tugas Piket Diklatsar' : j.materi}
                  </h3>
                  <p className="text-sm text-blue-600 font-medium">Satkoryon {j.kecamatan}</p>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div><p className="text-xs text-slate-500 font-medium mb-1">Tanggal & Sesi</p><p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Calendar size={16} className="text-slate-400"/> {j.tanggal}</p><p className="text-sm font-semibold text-slate-800 flex items-center gap-2 mt-1"><Clock size={16} className="text-slate-400"/> {j.waktuMulai} - {j.waktuSelesai} WIB</p></div>
                    <div><p className="text-xs text-slate-500 font-medium mb-1">Lokasi</p><p className="text-sm font-semibold text-slate-800">{j.tempat}</p></div>
                  </div>
                  <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
                    <div className="flex items-center gap-4 text-sm font-medium bg-slate-50 p-3 rounded-lg w-full">
                      <span className={j.waktuDatang !== '-' ? 'text-emerald-600' : 'text-slate-500'}>Datang: {j.waktuDatang}</span>
                      <span className={j.waktuPulang !== '-' ? 'text-emerald-600' : 'text-slate-500'}>Pulang: {j.waktuPulang}</span>
                    </div>
                    {j.koordinat && (
                      <button onClick={() => openGoogleMaps(j.koordinat)} className="mt-2 sm:mt-0 py-2 px-4 flex items-center justify-center gap-2 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-200 transition whitespace-nowrap">
                        <Map size={16} /> Buka Peta
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Panel Presensi Ditempatkan Tersendiri */}
        {renderPanelPresensi(myJadwal)}
      </div>
    );
  };

  const JadwalView = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Manajemen Jadwal</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={prepareBlastWAPelatih} className="bg-teal-100 text-teal-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-teal-200 font-medium"><Send size={18} /> Blast WA Pelatih</button>
          <button onClick={handleCetakPresensi} className="bg-amber-100 text-amber-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-amber-200 font-medium"><Printer size={18} /> Cetak PDF Presensi</button>
          <button onClick={() => setIsAddJadwalModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 font-medium shadow-md"><Plus size={18} /> Buat Jadwal Baru</button>
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
                        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-md font-bold border border-amber-200">
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
                        <button onClick={() => j.waPelatih ? openWhatsAppWeb(j.waPelatih, `Halo Admin Satkorcab disini,\n\nMengingatkan kembali untuk jadwal pengisian materi *${j.materi}* pada hari/tanggal ${j.tanggal} jam ${j.waktuMulai} WIB di ${j.tempat}.`, j.pelatih, 'Reminder') : addToast('WA kosong', 'error')} className="p-2 text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-600 hover:text-white transition shadow-sm" title="WA Pelatih">
                          <Send size={16} />
                        </button>
                        <button onClick={() => openEditJadwal(j)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm" title="Edit Jadwal">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleResetPresensiJadwal(j.docId, j.materi)} className="p-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-600 hover:text-white transition shadow-sm" title="Reset Absensi">
                          <RefreshCcw size={16} />
                        </button>
                        <button onClick={() => handleDeleteJadwal(j.docId, j.materi)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition shadow-sm" title="Hapus Jadwal">
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
        <Loader2 className="animate-spin mb-4 text-blue-600" size={48} />
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
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap & Gelar</label><input required type="text" value={registerData.nama} onChange={e => setRegisterData({...registerData, nama: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Cth: Dr. Ahmad Fauzi, M.Pd" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Alamat Domisili</label><textarea required rows="2" value={registerData.alamat} onChange={e => setRegisterData({...registerData, alamat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none" placeholder="Cth: Jl. Raya Kajen No. 12, Pekalongan" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nomor WhatsApp</label><input required type="text" value={registerData.wa} onChange={e => setRegisterData({...registerData, wa: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Cth: +62812..." /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Bidang Keahlian / Materi</label><input required type="text" value={registerData.bidang} onChange={e => setRegisterData({...registerData, bidang: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Cth: Ke-NU-an / Kepemimpinan" /></div>
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs mt-6 border border-blue-100"><span className="font-bold">Info:</span> Setelah pendaftaran berhasil, Password default Anda adalah <b>123</b>.</div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition mt-6">Daftar Sekarang</button>
                </form>
              </div>
            </div>
          )}

          <div className="bg-blue-600 p-8 text-center">
            <h1 className="text-3xl font-bold tracking-wider text-white mb-2">KADER<span className="text-blue-200">PRO</span></h1>
            <p className="text-blue-100 text-sm">Sistem Informasi Kaderisasi & Presensi</p>
          </div>
          <div className="p-8 pb-4">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Login Sistem</h2>
            {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 text-center font-medium border border-red-100">{loginError}</div>}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username / Nama Pelatih</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input required type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="Contoh: admin / Dr. Andi Pratama" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="••••••••" />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition mt-4">Masuk Sistem</button>
            </form>
            <div className="mt-5 text-center border-t border-slate-100 pt-5">
               <p className="text-sm text-slate-600">Belum terdaftar di database?</p>
               <button onClick={() => setIsRegisterModalOpen(true)} className="text-blue-600 font-bold hover:underline text-sm mt-1">Daftar sebagai Pelatih Baru</button>
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
          {toasts.map(toast => (<div key={toast.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-3 text-white transform transition-all duration-300 translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>{toast.type === 'success' ? <CheckCircle size={18} /> : <Settings size={18} className="animate-spin" />}{toast.message}</div>))}
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
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase mt-0.5">{currentUser.role === 'admin' ? 'Admin Kabupaten' : 'Pemateri / Pelatih'}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">{currentUser.name.substring(0, 2).toUpperCase()}</div>
            
            {currentUser.role === 'pelatih' && (
              <button onClick={() => setIsChangePassModalOpen(true)} className="ml-2 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Ganti Password">
                <Key size={20} />
              </button>
            )}
            <button onClick={handleLogout} className="ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Logout"><LogOut size={20} /></button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && DashboardView()}
            {activeTab === 'pelatih' && PelatihView()}
            {activeTab === 'jadwal' && JadwalView()}
            {activeTab === 'jadwal_saya' && JadwalSayaView()}
            {activeTab === 'whatsapp' && WhatsAppView()}
          </div>
        </main>
      </div>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (<div key={toast.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-3 text-white transform transition-all duration-300 translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>{toast.type === 'success' ? <CheckCircle size={18} /> : <Settings size={18} className="animate-spin" />}{toast.message}</div>))}
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
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Password Lama</label><input required type="password" value={changePassData.oldPass} onChange={e => setChangePassData({...changePassData, oldPass: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label><input required type="password" value={changePassData.newPass} onChange={e => setChangePassData({...changePassData, newPass: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500" minLength="6" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password Baru</label><input required type="password" value={changePassData.confirmPass} onChange={e => setChangePassData({...changePassData, confirmPass: e.target.value})} className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500" minLength="6" /></div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100"><button type="button" onClick={() => { setIsChangePassModalOpen(false); setChangePassError(''); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Simpan Password</button></div>
            </form>
          </div>
        </div>
      )}

      {isAddPelatihModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-lg text-slate-800">Tambah Data Pelatih</h3><button onClick={() => setIsAddPelatihModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
            <form onSubmit={submitAddPelatih} className="p-4 space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap & Gelar</label><input required type="text" value={newPelatih.nama} onChange={e => setNewPelatih({...newPelatih, nama: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="Masukkan nama pelatih..." /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label><textarea required rows="2" value={newPelatih.alamat} onChange={e => setNewPelatih({...newPelatih, alamat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500 resize-none" placeholder="Alamat domisili..." /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Bidang / Materi Spesialisasi</label><input required type="text" value={newPelatih.bidang} onChange={e => setNewPelatih({...newPelatih, bidang: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="Contoh: Ke-NU-an" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nomor WhatsApp</label><input required type="text" value={newPelatih.wa} onChange={e => setNewPelatih({...newPelatih, wa: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="Contoh: +62812..." /></div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100"><button type="button" onClick={() => setIsAddPelatihModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Simpan ke Cloud</button></div>
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
                <input required type="text" value={editPelatihData.nama} onChange={e => setEditPelatihData({...editPelatihData, nama: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
                <textarea required rows="2" value={editPelatihData.alamat} onChange={e => setEditPelatihData({...editPelatihData, alamat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bidang / Materi Spesialisasi</label>
                <input required type="text" value={editPelatihData.bidang} onChange={e => setEditPelatihData({...editPelatihData, bidang: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nomor WhatsApp</label>
                <input required type="text" value={editPelatihData.wa} onChange={e => setEditPelatihData({...editPelatihData, wa: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status Keaktifan</label>
                <select value={editPelatihData.status} onChange={e => setEditPelatihData({...editPelatihData, status: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500">
                  <option value="Aktif">Aktif</option>
                  <option value="Tidak Aktif">Tidak Aktif</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setIsEditPelatihModalOpen(false); setEditPelatihData(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddJadwalModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Buat Jadwal Baru</h3>
              <button onClick={() => setIsAddJadwalModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto p-4">
              <form onSubmit={submitAddJadwal} className="space-y-4">
                
                {/* --- TAMBAHAN JENIS PENUGASAN --- */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Penugasan</label>
                  <select required value={newJadwal.jenis || 'Materi'} onChange={e => setNewJadwal({...newJadwal, jenis: e.target.value, materi: e.target.value === 'Piket' ? 'Tugas Piket Diklatsar' : ''})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500 font-medium bg-slate-50">
                    <option value="Materi">Pemateri / Instruktur (Sesuai Materi)</option>
                    <option value="Piket">Tugas Piket Diklatsar (Non-Materi)</option>
                  </select>
                </div>

                {/* Sembunyikan Input Materi jika yang dipilih adalah PIKET */}
                {(!newJadwal.jenis || newJadwal.jenis === 'Materi') && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Materi Pelatihan</label>
                    <input required type="text" value={newJadwal.materi} onChange={e => setNewJadwal({...newJadwal, materi: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="Contoh: Ke-NU-an" />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pemateri / Petugas</label>
                    <select required value={newJadwal.pelatih} onChange={e => { const selected = pelatih.find(p => p.nama === e.target.value); setNewJadwal({...newJadwal, pelatih: selected ? selected.nama : e.target.value, waPelatih: selected ? selected.wa : ''}); }} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500">
                      <option value="">-- Pilih Pelatih --</option>
                      {pelatih.filter(p => p.status === 'Aktif').map(p => (<option key={p.docId} value={p.nama}>{p.nama}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">No. WA</label><input required type="text" value={newJadwal.waPelatih} onChange={e => setNewJadwal({...newJadwal, waPelatih: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="Otomatis terisi..." /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Satkoryon (Kecamatan)</label>
                    <select required value={newJadwal.kecamatan} onChange={e => setNewJadwal({...newJadwal, kecamatan: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500">
                      {daftarKecamatan.map(kec => (<option key={kec} value={kec}>{kec}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Tempat</label><input required type="text" value={newJadwal.tempat} onChange={e => setNewJadwal({...newJadwal, tempat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="Lokasi pelatihan..." /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Titik Koordinat Lokasi (Penting untuk GPS)</label><input required type="text" value={newJadwal.koordinat} onChange={e => setNewJadwal({...newJadwal, koordinat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="-6.8898, 109.6745" /></div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pelatihan</label><input required type="date" value={newJadwal.tanggal} onChange={e => setNewJadwal({...newJadwal, tanggal: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                  
                  {/* Sembunyikan Kuota jika Piket */}
                  {(!newJadwal.jenis || newJadwal.jenis === 'Materi') ? (
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Kuota Peserta</label><input required type="number" min="1" value={newJadwal.kuota} onChange={e => setNewJadwal({...newJadwal, kuota: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="Contoh: 50" /></div>
                  ) : (
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Kuota Peserta</label><input disabled type="text" value="Non-Materi" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-100 text-slate-400 cursor-not-allowed" /></div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Jam Mulai</label><input required type="time" value={newJadwal.waktuMulai} onChange={e => setNewJadwal({...newJadwal, waktuMulai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Jam Selesai</label><input required type="time" value={newJadwal.waktuSelesai} onChange={e => setNewJadwal({...newJadwal, waktuSelesai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                </div>
                <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100"><input type="checkbox" id="autoSend" checked={autoSendWA} onChange={(e) => setAutoSendWA(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" /><label htmlFor="autoSend" className="text-sm text-blue-800 cursor-pointer font-medium">Otomatis kirim info jadwal via WA (API) ke pemateri</label></div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100"><button type="button" onClick={() => setIsAddJadwalModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Simpan ke Cloud</button></div>
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
                  <select required value={editJadwalData.jenis || 'Materi'} onChange={e => setEditJadwalData({...editJadwalData, jenis: e.target.value, materi: e.target.value === 'Piket' ? 'Tugas Piket Diklatsar' : ''})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500 font-medium bg-slate-50">
                    <option value="Materi">Pemateri / Instruktur (Sesuai Materi)</option>
                    <option value="Piket">Tugas Piket Diklatsar (Non-Materi)</option>
                  </select>
                </div>

                {(!editJadwalData.jenis || editJadwalData.jenis === 'Materi') && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Materi Pelatihan</label>
                    <input required type="text" value={editJadwalData.materi} onChange={e => setEditJadwalData({...editJadwalData, materi: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pemateri / Petugas</label>
                    <select required value={editJadwalData.pelatih} onChange={e => { const selected = pelatih.find(p => p.nama === e.target.value); setEditJadwalData({...editJadwalData, pelatih: selected ? selected.nama : e.target.value, waPelatih: selected ? selected.wa : ''}); }} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500">
                      <option value="">-- Pilih Pelatih --</option>
                      {pelatih.filter(p => p.status === 'Aktif').map(p => (<option key={p.docId} value={p.nama}>{p.nama}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">No. WA Pemateri</label><input required type="text" value={editJadwalData.waPelatih} onChange={e => setEditJadwalData({...editJadwalData, waPelatih: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Satkoryon (Kecamatan)</label>
                    <select required value={editJadwalData.kecamatan} onChange={e => setEditJadwalData({...editJadwalData, kecamatan: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500">
                      {daftarKecamatan.map(kec => (<option key={kec} value={kec}>{kec}</option>))}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Tempat</label><input required type="text" value={editJadwalData.tempat} onChange={e => setEditJadwalData({...editJadwalData, tempat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Titik Koordinat Lokasi</label><input required type="text" value={editJadwalData.koordinat} onChange={e => setEditJadwalData({...editJadwalData, koordinat: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" placeholder="-6.8898, 109.6745" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Pelatihan</label><input required type="date" value={editJadwalData.tanggal} onChange={e => setEditJadwalData({...editJadwalData, tanggal: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                  
                  {(!editJadwalData.jenis || editJadwalData.jenis === 'Materi') ? (
                     <div><label className="block text-sm font-medium text-slate-700 mb-1">Kuota Peserta</label><input required type="number" min="1" value={editJadwalData.kuota} onChange={e => setEditJadwalData({...editJadwalData, kuota: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                  ) : (
                     <div><label className="block text-sm font-medium text-slate-700 mb-1">Kuota Peserta</label><input disabled type="text" value="Non-Materi" className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-100 text-slate-400 cursor-not-allowed" /></div>
                  )}

                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Jam Mulai</label><input required type="time" value={editJadwalData.waktuMulai} onChange={e => setEditJadwalData({...editJadwalData, waktuMulai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Jam Selesai</label><input required type="time" value={editJadwalData.waktuSelesai} onChange={e => setEditJadwalData({...editJadwalData, waktuSelesai: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500" /></div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => { setIsEditJadwalModalOpen(false); setEditJadwalData(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Batal</button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Simpan Perubahan</button>
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
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100">Sistem API akan mengirimkan pesan massal ke <b>{blastTargets.length} pelatih</b> di latar belakang.</div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Daftar Penerima:</label>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1">
                  {blastTargets.map((t, idx) => (<div key={idx} className="text-sm text-slate-600 flex justify-between"><span className="font-semibold">{t.pelatih}</span><span className="font-mono text-xs">{t.waPelatih}</span></div>))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template Pesan (Bisa diedit):</label>
                <textarea rows="5" value={blastMessage} onChange={(e) => setBlastMessage(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-500 resize-none"/>
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