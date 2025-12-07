import React, { useState, useEffect } from 'react';
import { Waves, Loader2, Clock, Users, AlertCircle, LogOut, Settings, ChevronDown, ChevronUp, Lock, Unlock, History, TrendingUp, X, Edit2, BarChart3 } from 'lucide-react';

const KYWashSystem = () => {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [showLogin, setShowLogin] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const [machines, setMachines] = useState([
    { id: 1, type: 'washer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 2, type: 'washer', status: 'maintenance', timeLeft: 0, mode: null, locked: true, userStudentId: null, userPhone: null },
    { id: 3, type: 'washer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 4, type: 'washer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 5, type: 'washer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 6, type: 'washer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 1, type: 'dryer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 2, type: 'dryer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 3, type: 'dryer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 4, type: 'dryer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 5, type: 'dryer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null },
    { id: 6, type: 'dryer', status: 'available', timeLeft: 0, mode: null, locked: false, userStudentId: null, userPhone: null }
  ]);

  const [waitlists, setWaitlists] = useState({ washers: [], dryers: [] });
  const [showWasherWaitlist, setShowWasherWaitlist] = useState(false);
  const [showDryerWaitlist, setShowDryerWaitlist] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [usageHistory, setUsageHistory] = useState([]);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const modes = [
    { name: 'Normal', duration: 30 },
    { name: 'Extra 5 min', duration: 35 },
    { name: 'Extra 10 min', duration: 40 },
    { name: 'Extra 15 min', duration: 45 }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMachines(prev => prev.map(machine => {
        if (machine.status === 'running' && machine.timeLeft > 0) {
          const newTimeLeft = machine.timeLeft - 1;
          
          if (newTimeLeft === 0) {
            playNotificationSound();
            showNotification(`${machine.type.charAt(0).toUpperCase() + machine.type.slice(1)} ${machine.id} is now available!`);
            notifyWaitlist(machine.type);
            
            return { ...machine, status: 'available', timeLeft: 0, mode: null, userStudentId: null, userPhone: null };
          }
          
          return { ...machine, timeLeft: newTimeLeft };
        }
        return machine;
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGm98OScTgwOUKjj8LVjHAU5ktjzy3osBSV2yPDekUALE2Cz6eyrVRQJSKDh8r9sIAUug8/z2ok3Bxdpvf');
    audio.play().catch(() => {});
  };

  const showNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('KY Wash Alert', { body: message, icon: '🧺' });
    }
  };

  const notifyWaitlist = (type) => {
    const listKey = type === 'washer' ? 'washers' : 'dryers';
    if (waitlists[listKey].length > 0) {
      showNotification(`A ${type} is now available! Check the app.`);
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const validateStudentId = (id) => /^\d{6}$/.test(id);
  const validatePhone = (phone) => /^\d{10,11}$/.test(phone);
  const validatePassword = (pass) => /^\d{8}$/.test(pass);

  const handleAuth = async () => {
    setError('');
    
    if (!validateStudentId(studentId)) {
      setError('Student ID must be exactly 6 digits');
      return;
    }
    if (!validatePhone(phoneNumber)) {
      setError('Phone number must be 10 or 11 digits');
      return;
    }
    if (!validatePassword(password)) {
      setError('Password must be exactly 8 digits');
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setUser({ studentId, phoneNumber });
    setShowLogin(false);
    setLoading(false);
  };

  const handleAdminLogin = () => {
    if (adminPassword === 'KYWASH2024') {
      setCurrentView('admin');
      setShowAdminLogin(false);
      setAdminPassword('');
      setError('');
    } else {
      setError('Invalid admin password');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('main');
    setShowLogin(true);
    setStudentId('');
    setPhoneNumber('');
    setPassword('');
  };

  const startMachine = (machineId, machineType, mode) => {
    setMachines(prev => prev.map(m => 
      m.id === machineId && m.type === machineType ? { 
        ...m, 
        status: 'running', 
        timeLeft: mode.duration * 60,
        mode: mode.name,
        userStudentId: user.studentId,
        userPhone: user.phoneNumber
      } : m
    ));

    setUsageHistory(prev => [...prev, {
      id: Date.now(),
      machineType: machineType,
      machineId: machineId,
      mode: mode.name,
      duration: mode.duration,
      date: new Date().toLocaleString(),
      studentId: user.studentId,
      timestamp: Date.now()
    }]);
  };

  const cancelMachine = (machineId, machineType) => {
    if (window.confirm('Are you sure you want to cancel this cycle?')) {
      setMachines(prev => prev.map(m => 
        m.id === machineId && m.type === machineType ? { 
          ...m, 
          status: 'available', 
          timeLeft: 0,
          mode: null,
          userStudentId: null,
          userPhone: null
        } : m
      ));
    }
  };

  const joinWaitlist = (type) => {
    const listKey = type === 'washer' ? 'washers' : 'dryers';
    const userData = { studentId: user.studentId, phone: user.phoneNumber };
    if (!waitlists[listKey].some(u => u.studentId === user.studentId)) {
      setWaitlists(prev => ({
        ...prev,
        [listKey]: [...prev[listKey], userData]
      }));
    }
  };

  const leaveWaitlist = (type) => {
    const listKey = type === 'washer' ? 'washers' : 'dryers';
    setWaitlists(prev => ({
      ...prev,
      [listKey]: prev[listKey].filter(u => u.studentId !== user.studentId)
    }));
  };

  const toggleMachineLock = (machineId, machineType) => {
    setMachines(prev => prev.map(m => 
      m.id === machineId && m.type === machineType ? { 
        ...m, 
        locked: !m.locked,
        status: !m.locked ? 'maintenance' : 'available'
      } : m
    ));
  };

  const reportIssue = () => {
    const mailtoLink = `mailto:admin@kywash.com?subject=Machine Issue Report&body=Machine: ${selectedMachine?.type} ${selectedMachine?.id}%0D%0AReported by: ${user.studentId}%0D%0APhone: ${user.phoneNumber}%0D%0ADescription: ${issueDescription}`;
    window.location.href = mailtoLink;
    setShowReportIssue(false);
    setIssueDescription('');
    setSelectedMachine(null);
  };

  const updateProfile = () => {
    if (!validateStudentId(studentId) || !validatePhone(phoneNumber)) {
      setError('Invalid Student ID or Phone Number');
      return;
    }
    setUser({ studentId, phoneNumber });
    setShowEditProfile(false);
    setError('');
  };

  const calculateWaitTime = (position, type) => {
    const avgCycleTime = 30;
    const machinesAvailable = machines.filter(m => m.type === type && !m.locked).length;
    return Math.ceil((position * avgCycleTime) / machinesAvailable);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const peakHours = [
    { time: '7-9 AM', load: 90 },
    { time: '12-2 PM', load: 75 },
    { time: '6-9 PM', load: 95 },
    { time: '9 PM-12 AM', load: 60 }
  ];

  const getUsageStats = () => {
    const totalWashes = usageHistory.filter(h => h.studentId === user?.studentId).length;
    const totalMinutes = usageHistory.filter(h => h.studentId === user?.studentId).reduce((sum, h) => sum + h.duration, 0);
    const mostUsedMode = usageHistory.length > 0 ? usageHistory.reduce((acc, h) => {
      acc[h.mode] = (acc[h.mode] || 0) + 1;
      return acc;
    }, {}) : {};
    const favoriteMode = Object.keys(mostUsedMode).length > 0 ? Object.keys(mostUsedMode).reduce((a, b) => mostUsedMode[a] > mostUsedMode[b] ? a : b) : 'None';
    
    return { totalWashes, totalMinutes, favoriteMode };
  };

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <Waves className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">KY Wash</h1>
            <p className="text-sm text-gray-500">College Laundry System</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID (6 digits)</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                placeholder="123456"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (10-11 digits)</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                placeholder="0123456789"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password (8 digits)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                placeholder="12345678"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isRegistering ? 'Register' : 'Login')}
            </button>
          </div>

          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            className="w-full mt-4 text-blue-600 text-sm hover:underline"
          >
            {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                <Waves className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">KY Wash</h1>
                <p className="text-xs text-gray-500">
                  {currentView === 'admin' ? 'Admin Panel' : user ? `ID: ${user.studentId}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setCurrentView('main')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                currentView === 'main' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Machines
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                currentView === 'history' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <History className="w-4 h-4" />
              My History
            </button>
            <button
              onClick={() => setCurrentView('profile')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                currentView === 'profile' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              Profile
            </button>
            <button
              onClick={() => setShowAdminLogin(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                currentView === 'admin' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              Admin Portal
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'main' && (
          <>
            <PeakHoursIndicator peakHours={peakHours} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <WaitlistCard
                title="Washer Waitlist"
                type="washers"
                waitlist={waitlists.washers}
                show={showWasherWaitlist}
                setShow={setShowWasherWaitlist}
                onJoin={() => joinWaitlist('washer')}
                onLeave={() => leaveWaitlist('washer')}
                isInList={waitlists.washers.some(u => u.studentId === user.studentId)}
                userStudentId={user.studentId}
                calculateWaitTime={calculateWaitTime}
                color="blue"
              />

              <WaitlistCard
                title="Dryer Waitlist"
                type="dryers"
                waitlist={waitlists.dryers}
                show={showDryerWaitlist}
                setShow={setShowDryerWaitlist}
                onJoin={() => joinWaitlist('dryer')}
                onLeave={() => leaveWaitlist('dryer')}
                isInList={waitlists.dryers.some(u => u.studentId === user.studentId)}
                userStudentId={user.studentId}
                calculateWaitTime={calculateWaitTime}
                color="cyan"
              />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Washers</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {machines.filter(m => m.type === 'washer').map(machine => (
                  <MachineCard
                    key={`${machine.type}-${machine.id}`}
                    machine={machine}
                    modes={modes}
                    onStart={startMachine}
                    onCancel={cancelMachine}
                    onReport={() => {
                      setSelectedMachine(machine);
                      setShowReportIssue(true);
                    }}
                    onToggleLock={toggleMachineLock}
                    isAdmin={currentView === 'admin'}
                    formatTime={formatTime}
                    currentUserId={user.studentId}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Dryers</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {machines.filter(m => m.type === 'dryer').map(machine => (
                  <MachineCard
                    key={`${machine.type}-${machine.id}`}
                    machine={machine}
                    modes={modes}
                    onStart={startMachine}
                    onCancel={cancelMachine}
                    onReport={() => {
                      setSelectedMachine(machine);
                      setShowReportIssue(true);
                    }}
                    onToggleLock={toggleMachineLock}
                    isAdmin={currentView === 'admin'}
                    formatTime={formatTime}
                    currentUserId={user.studentId}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {currentView === 'history' && (
          <HistoryView 
            history={usageHistory.filter(h => h.studentId === user.studentId)} 
            stats={getUsageStats()}
          />
        )}

        {currentView === 'profile' && (
          <ProfileView
            user={user}
            onEdit={() => {
              setStudentId(user.studentId);
              setPhoneNumber(user.phoneNumber);
              setShowEditProfile(true);
            }}
          />
        )}

        {currentView === 'admin' && (
          <AdminView machines={machines} usageHistory={usageHistory} />
        )}
      </div>

      {showAdminLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Admin Login</h3>
              <button onClick={() => {
                setShowAdminLogin(false);
                setAdminPassword('');
                setError('');
              }}>
                <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <button
                onClick={handleAdminLogin}
                className="w-full bg-gray-800 text-white py-3 rounded-lg hover:bg-gray-900"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Report Issue</h3>
            <p className="text-sm text-gray-600 mb-4">
              Reporting issue for {selectedMachine?.type} {selectedMachine?.id}
            </p>
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={reportIssue}
                className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50"
                disabled={!issueDescription.trim()}
              >
                Send Report
              </button>
              <button
                onClick={() => {
                  setShowReportIssue(false);
                  setIssueDescription('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID (6 digits)</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (10-11 digits)</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={updateProfile}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setShowEditProfile(false);
                    setStudentId(user.studentId);
                    setPhoneNumber(user.phoneNumber);
                    setError('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PeakHoursIndicator = ({ peakHours }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
    <div className="flex items-center gap-2 mb-4">
      <TrendingUp className="w-5 h-5 text-blue-600" />
      <h3 className="font-bold text-lg">Peak Hours Today</h3>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {peakHours.map(hour => (
        <div key={hour.time} className="text-center">
          <p className="text-sm font-medium mb-2">{hour.time}</p>
          <div className="relative h-20 bg-gray-100 rounded-lg overflow-hidden">
            <div 
              className={`absolute bottom-0 w-full ${
                hour.load > 80 ? 'bg-red-500' : 
                hour.load > 50 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{height: `${hour.load}%`}}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">{hour.load}% busy</p>
        </div>
      ))}
    </div>
    <p className="text-sm text-gray-600 mt-4 text-center">
      💡 Best time to wash: <span className="font-semibold text-green-600">2-6 PM</span>
    </p>
  </div>
);

const WaitlistCard = ({ title, type, waitlist, show, setShow, onJoin, onLeave, isInList, userStudentId, calculateWaitTime, color }) => {
  const position = waitlist.findIndex(u => u.studentId === userStudentId) + 1;
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Users className={`w-5 h-5 text-${color}-600`} />
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <span className={`bg-${color}-100 text-${color}-600 px-2 py-1 rounded-full text-xs font-bold`}>
            {waitlist.length}
          </span>
        </div>
        <button onClick={() => setShow(!show)} className={`text-${color}-600 hover:text-${color}-700`}>
          {show ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>
      
      {isInList && position > 0 && (
        <div className={`bg-${color}-50 p-3 rounded-lg mb-4`}>
          <p className="text-sm font-semibold">Your position: #{position}</p>
          <p className="text-xs text-gray-600">
            Estimated wait: ~{calculateWaitTime(position, type.slice(0, -1))} minutes
          </p>
        </div>
      )}
      
      {show && (
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {waitlist.length > 0 ? (
            waitlist.map((user, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 p-2 rounded">
                <span className="font-mono font-semibold">{idx + 1}.</span>
                <span className="flex-1 ml-2">ID: {user.studentId}</span>
                <span className="text-xs text-gray-500">{user.phone}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">No one in waitlist</p>
          )}
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={onJoin}
          className={`flex-1 py-2 bg-${color}-500 text-white rounded-lg hover:bg-${color}-600 text-sm font-medium disabled:opacity-50`}
          disabled={isInList}
        >
          Join Waitlist
        </button>
        <button
          onClick={onLeave}
          className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
          disabled={!isInList}
        >
          Leave
        </button>
      </div>
    </div>
  );
};

const MachineCard = ({ machine, modes, onStart, onCancel, onReport, onToggleLock, isAdmin, formatTime, currentUserId }) => {
  const [showModes, setShowModes] = useState(false);
  const isCurrentUser = machine.userStudentId === currentUserId;

  const getStatusColor = () => {
    if (machine.locked) return 'bg-gray-100 border-gray-300';
    if (machine.status === 'running') return 'bg-blue-50 border-blue-300';
    if (machine.status === 'maintenance') return 'bg-red-50 border-red-300';
    return 'bg-green-50 border-green-300';
  };

  const getStatusText = () => {
    if (machine.locked) return 'Locked';
    if (machine.status === 'running') return 'Running';
    if (machine.status === 'maintenance') return 'Maintenance';
    return 'Available';
  };

  return (
    <div className={`rounded-xl p-6 shadow-lg border-2 transition-all ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Waves className={`w-6 h-6 ${machine.type === 'washer' ? 'text-blue-600' : 'text-cyan-600'}`} />
          <h3 className="font-bold text-gray-800">
            {machine.type.charAt(0).toUpperCase() + machine.type.slice(1)} {machine.id}
          </h3>
        </div>
        {isAdmin && (
          <button
            onClick={() => onToggleLock(machine.id, machine.type)}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            {machine.locked ? <Lock className="w-5 h-5 text-gray-600" /> : <Unlock className="w-5 h-5 text-gray-600" />}
          </button>
        )}
      </div>

      <div className={`text-sm font-semibold mb-3 px-3 py-1 rounded-full inline-block ${
        machine.locked ? 'bg-gray-200 text-gray-700' :
        machine.status === 'running' ? 'bg-blue-200 text-blue-700' :
        machine.status === 'maintenance' ? 'bg-red-200 text-red-700' :
        'bg-green-200 text-green-700'
      }`}>
        {getStatusText()}
      </div>

      {machine.status === 'running' && (
        <div className="mb-4">
          <div className="bg-white p-3 rounded-lg mb-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">In Use By:</p>
            <p className="text-sm font-semibold text-gray-800">Student ID: {machine.userStudentId}</p>
            <p className="text-xs text-gray-600">Phone: {machine.userPhone}</p>
          </div>
          
          <div className="flex items-center space-x-2 text-gray-700 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">{machine.mode}</span>
          </div>
          <div className="text-3xl font-bold text-gray-800 font-mono">
            {formatTime(machine.timeLeft)}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{
                width: `${((modes.find(m => m.name === machine.mode)?.duration * 60 - machine.timeLeft) / (modes.find(m => m.name === machine.mode)?.duration * 60)) * 100}%`
              }}
            />
          </div>
          
          {isCurrentUser && (
            <button
              onClick={() => onCancel(machine.id, machine.type)}
              className="w-full mt-3 flex items-center justify-center space-x-2 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
            >
              <X className="w-4 h-4" />
              <span>Cancel Cycle</span>
            </button>
          )}
        </div>
      )}

      {machine.status === 'available' && !machine.locked && (
        <div className="space-y-2">
          <button
            onClick={() => setShowModes(!showModes)}
            className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 font-medium transition-all"
          >
            Start Machine
          </button>
          {showModes && (
            <div className="space-y-2 pt-2">
              {modes.map(mode => (
                <button
                  key={mode.name}
                  onClick={() => {
                    onStart(machine.id, machine.type, mode);
                    setShowModes(false);
                  }}
                  className="w-full bg-white border border-blue-300 text-blue-700 py-2 rounded-lg hover:bg-blue-50 text-sm font-medium"
                >
                  {mode.name} ({mode.duration} min)
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onReport}
        className="w-full mt-3 flex items-center justify-center space-x-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
      >
        <AlertCircle className="w-4 h-4" />
        <span>Report Issue</span>
      </button>
    </div>
  );
};

const HistoryView = ({ history, stats }) => (
  <div className="space-y-6">
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Wash Statistics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg">
          <p className="text-3xl font-bold text-blue-600">{stats.totalWashes}</p>
          <p className="text-sm text-gray-600">Total Washes</p>
        </div>
        <div className="bg-white p-4 rounded-lg">
          <p className="text-3xl font-bold text-cyan-600">{stats.totalMinutes}</p>
          <p className="text-sm text-gray-600">Minutes Used</p>
        </div>
        <div className="bg-white p-4 rounded-lg">
          <p className="text-lg font-bold text-green-600">{stats.favoriteMode}</p>
          <p className="text-sm text-gray-600">Favorite Mode</p>
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {history.length > 0 ? (
          history.slice().reverse().map(item => (
            <div key={item.id} className="bg-white p-4 rounded-lg shadow border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800">
                    {item.machineType.charAt(0).toUpperCase() + item.machineType.slice(1)} {item.machineId}
                  </p>
                  <p className="text-sm text-gray-600">{item.mode} - {item.duration} minutes</p>
                  <p className="text-xs text-gray-500 mt-1">{item.date}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  item.machineType === 'washer' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'
                }`}>
                  {item.machineType}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No wash history yet</p>
            <p className="text-sm text-gray-400">Start using machines to see your history here</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

const ProfileView = ({ user, onEdit }) => (
  <div className="max-w-2xl mx-auto">
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">My Profile</h2>
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Edit2 className="w-4 h-4" />
          Edit Profile
        </button>
      </div>
      
              <div className="space-y-4">
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Student ID</p>
            <p className="text-xl font-bold text-gray-800">{user.studentId}</p>
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">Phone Number</p>
          <p className="text-lg font-semibold text-gray-800">{user.phoneNumber}</p>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
          <p className="text-sm font-semibold text-green-700 mb-2">✓ Account Active</p>
          <p className="text-xs text-gray-600">Your account is in good standing</p>
        </div>
      </div>
    </div>
  </div>
);

const AdminView = ({ machines, usageHistory }) => {
  const activeMachines = machines.filter(m => m.status === 'running').length;
  const totalMachines = machines.filter(m => !m.locked).length;
  const utilizationRate = totalMachines > 0 ? ((activeMachines / totalMachines) * 100).toFixed(1) : 0;
  
  const getMostUsedMachine = () => {
    const usage = usageHistory.reduce((acc, h) => {
      const key = `${h.machineType}-${h.machineId}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const max = Object.keys(usage).reduce((a, b) => usage[a] > usage[b] ? a : b, '');
    return max || 'N/A';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{activeMachines}/{totalMachines}</p>
              <p className="text-sm text-gray-600">Active Machines</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{utilizationRate}%</p>
              <p className="text-sm text-gray-600">Utilization Rate</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Waves className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">{getMostUsedMachine()}</p>
              <p className="text-sm text-gray-600">Most Used Machine</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Machine Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {machines.map(m => (
            <div key={`${m.type}-${m.id}`} className={`p-4 rounded-lg border-2 ${
              m.locked ? 'bg-gray-50 border-gray-300' :
              m.status === 'running' ? 'bg-blue-50 border-blue-300' :
              'bg-green-50 border-green-300'
            }`}>
              <p className="text-sm font-semibold text-gray-700">
                {m.type.charAt(0).toUpperCase() + m.type.slice(1)} {m.id}
              </p>
              <p className={`text-xs mt-1 ${
                m.locked ? 'text-gray-600' :
                m.status === 'running' ? 'text-blue-600' :
                'text-green-600'
              }`}>
                {m.locked ? 'Locked' : m.status === 'running' ? 'In Use' : 'Available'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Recent System Activity</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {usageHistory.slice().reverse().slice(0, 20).map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {item.machineType} {item.machineId} - {item.mode}
                </p>
                <p className="text-xs text-gray-600">Student: {item.studentId}</p>
              </div>
              <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KYWashSystem;
