const addToast = (message, type = 'success') => {
  const id = Date.now();
  setToasts(prev => [...prev, { id, message, type }]);
  setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 3000);
};

const openGoogleMaps = (koordinat) => {
  if (!koordinat || koordinat.trim() === '') { addToast('Titik koordinat belum diatur.', 'error'); return; }
  window.open(`https://www.google.com/maps/search/?api=1&query=${koordinat}`, '_blank', 'noopener,noreferrer');
};

const handleLogin = (e) => {
  e.preventDefault();
  const cleanInputUser = username.trim().toLowerCase();
  if (cleanInputUser === 'superadmin' && password === (authConfig.superadminPass || '123')) {
    setCurrentUser({ username: 'superadmin', role: 'superadmin', name: 'Super Admin' }); setActiveTab('dashboard'); setLoginError(''); addToast(`Welcome, Super Admin!`, 'success'); return;
  }
  if (cleanInputUser === 'admin' && password === (authConfig.adminPass || '123')) {
    setCurrentUser({ username: 'admin', role: 'admin', name: 'Panitia Kehadiran' }); setActiveTab('peserta'); setLoginError(''); addToast(`Akses Panitia!`, 'success'); return;
  }
  const foundPelatih = pelatih.find(p => p.nama.trim().toLowerCase() === cleanInputUser);
  if (foundPelatih) {
    if (password === (foundPelatih.password || '123')) {
      setCurrentUser({ username: foundPelatih.nama, role: 'pelatih', name: foundPelatih.nama, docId: foundPelatih.docId });
      const isPemateri = jadwal.some(j => j.pelatih === foundPelatih.nama && j.jenis !== 'Piket');
      setActiveTab(isPemateri ? 'jadwal_saya' : 'jadwal_piket'); setLoginError(''); addToast(`Welcome, ${foundPelatih.nama}!`, 'success'); return;
    }
  }
  setLoginError('Username/Password salah!');
};

const handleLogout = () => {
  setCurrentUser(null); setUsername(''); setPassword(''); setActiveTab('dashboard'); setSelectedJadwalPresensi(''); setLocationTarget(null); addToast('Anda telah logout.', 'info');
};

const handlePelatihPresensi = async (target) => {
  if (!firebaseUser) return;
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  try {
    const updateData = { statusPelatih: 'Hadir' };
    if (target.type === 'datang') updateData.waktuDatang = now;
    if (target.type === 'pulang') updateData.waktuPulang = now;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'kader_jadwal', target.id), updateData);
    addToast(`Presensi ${target.type} tersimpan pada ${now}`, 'success');
    setLocationTarget(null);
  } catch (error) { addToast('Gagal absen.', 'error'); }
};

// --- RENDER HALAMAN ---
if (dbPermissionError) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl text-center shadow-lg">
        <AlertTriangle size={40} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-red-600 font-bold text-2xl mb-2">Akses Ditolak</h2>
        <p className="text-slate-500 mb-4">Aturan Firebase terkunci.</p>
        <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded">Muat Ulang</button>
      </div>
    </div>
  );
}

if (isDbLoading) {
  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={48} /></div>;
}

if (!currentUser) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <div className="bg-emerald-600 p-8 text-center"><h1 className="text-3xl font-bold text-white mb-2">KADERPRO</h1></div>
        <div className="p-8 pb-4">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Login Sistem</h2>
          {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 text-center border border-red-100">{loginError}</div>}
          <form onSubmit={handleLogin} className="space-y-5">
            <div><label className="block text-sm font-medium mb-1">Username / Nama</label><input required type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-3 border rounded-lg" placeholder="admin / nama pelatih" /></div>
            <div><label className="block text-sm font-medium mb-1">Password</label><input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg" placeholder="••••••••" /></div>
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg mt-4">Masuk</button>
          </form>
        </div>
      </div>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (<div key={toast.id} className="px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-emerald-600"><CheckCircle size={18} className="inline mr-2"/>{toast.message}</div>))}
      </div>
    </div>
  );
}

return (
  <div className="flex h-screen bg-slate-50 overflow-hidden">
    <div className={`${isSidebarOpen ? 'block' : 'hidden'} md:block w-64 bg-slate-900 text-white flex flex-col z-20`}>
      <div className="p-5 border-b border-slate-800"><h1 className="text-xl font-bold text-emerald-500">KADERPRO</h1></div>
      <div className="flex-1 py-6 px-3 flex flex-col gap-2">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-emerald-600' : 'hover:bg-slate-800'}`}><Calendar size={20}/> Dashboard</button>
        <button onClick={() => handleLogout()} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 text-red-400 mt-auto"><LogOut size={20}/> Logout</button>
      </div>
    </div>

    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="bg-white border-b h-16 flex items-center justify-between px-4 lg:px-8 z-10">
        <h2 className="text-lg font-bold text-slate-800">Selamat datang, {currentUser.name}</h2>
        <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><LogOut size={20} /></button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-md">
            <h2 className="text-2xl font-bold mb-1">Beranda KADERPRO</h2>
            <p className="text-emerald-100 text-sm">Pilih jadwal Anda di bawah untuk melakukan presensi GPS.</p>
          </div>

          {currentUser.role === 'pelatih' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><MapPin/> Panel Presensi GPS</h3>
              <select value={selectedJadwalPresensi} onChange={(e) => setSelectedJadwalPresensi(e.target.value)} className="w-full border p-3 rounded-lg mb-4">
                <option value="">-- Pilih Jadwal --</option>
                {jadwal.filter(j => j.pelatih === currentUser.name).map(j => (
                  <option key={j.docId} value={j.docId}>{j.materi} - {j.tanggal}</option>
                ))}
              </select>
              {selectedJadwalPresensi && (
                <div className="flex gap-4">
                  <button onClick={() => setLocationTarget({ id: selectedJadwalPresensi, type: 'datang', koordinat: jadwal.find(j=>j.docId===selectedJadwalPresensi)?.koordinat })} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold">Verifikasi Datang</button>
                  <button onClick={() => setLocationTarget({ id: selectedJadwalPresensi, type: 'pulang', koordinat: jadwal.find(j=>j.docId===selectedJadwalPresensi)?.koordinat })} className="flex-1 bg-amber-500 text-white py-3 rounded-lg font-bold">Verifikasi Pulang</button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>

    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (<div key={toast.id} className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>{toast.message}</div>))}
    </div>

    {locationTarget && <LocationVerificationModal target={locationTarget} onClose={() => setLocationTarget(null)} onSuccess={handlePelatihPresensi} addToast={addToast} />}
  </div>
);
}