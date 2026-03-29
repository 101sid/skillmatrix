import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from '../components/Navbar';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [loading, setLoading] = useState(true);

  // --- PROFILE STATE ---
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    timezone: 'India Standard Time (IST)',
    avatarUrl: ''
  });

  // --- SECURITY STATE ---
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  // --- NOTIFICATION STATE ---
  const [notifications, setNotifications] = useState({
    reminders: true,
    requests: true,
    wallet: false
  });

  // 1. FETCH DATA ON LOAD
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        const nameParts = data.full_name ? data.full_name.split(' ') : ['', ''];
        setProfile({
          firstName: nameParts[0],
          lastName: nameParts[1] || '',
          bio: data.bio || '',
          timezone: data.timezone || 'India Standard Time (IST)',
          avatarUrl: data.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.avatar_seed}`
        });
        setNotifications({
          reminders: data.notify_reminders,
          requests: data.notify_requests,
          wallet: data.notify_wallet
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. HANDLE PHOTO UPLOAD
  const handlePhotoUpload = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;

      setSaveStatus('saving');
      const { data: { session } } = await supabase.auth.getSession();
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage Bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update Profile state and DB
      setProfile({ ...profile, avatarUrl: publicUrl });
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', session.user.id);
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      alert(error.message);
      setSaveStatus('idle');
    }
  };

  // 3. GLOBAL SAVE (For Profile & Notifications)
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const updates = {
        full_name: `${profile.firstName} ${profile.lastName}`,
        bio: profile.bio,
        timezone: profile.timezone,
        notify_reminders: notifications.reminders,
        notify_requests: notifications.requests,
        notify_wallet: notifications.wallet,
        updated_at: new Date()
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id);
      if (error) throw error;

      // If on Security tab, handle password separately
      if (activeTab === 'security' && passwords.new) {
        if (passwords.new !== passwords.confirm) throw new Error("Passwords do not match!");
        const { error: authError } = await supabase.auth.updateUser({ password: passwords.new });
        if (authError) throw authError;
        setPasswords({ current: '', new: '', confirm: '' });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      alert(error.message);
      setSaveStatus('idle');
    }
  };

  const ToggleSwitch = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-teal"></div>
    </label>
  );

  if (loading) return <div className="p-20 text-center font-bold">Encrypting Settings...</div>;

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar />
      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        <div className="mb-8">
          <h2 className="font-extrabold text-brand-navy text-3xl md:text-4xl mb-2">Account Settings</h2>
          <p className="text-gray-500 text-sm md:text-base m-0">Manage your profile, preferences, and platform security.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm sticky top-28">
              <button onClick={() => setActiveTab('profile')} className={`w-full text-left px-5 py-4 rounded-2xl font-bold text-sm transition-colors mb-2 flex items-center ${activeTab === 'profile' ? 'bg-teal-50 text-brand-darkTeal' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-teal'}`}>
                <i className="fa-regular fa-user w-6 text-center mr-2 text-lg"></i> General Profile
              </button>
              <button onClick={() => setActiveTab('security')} className={`w-full text-left px-5 py-4 rounded-2xl font-bold text-sm transition-colors mb-2 flex items-center ${activeTab === 'security' ? 'bg-teal-50 text-brand-darkTeal' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-teal'}`}>
                <i className="fa-solid fa-shield-halved w-6 text-center mr-2 text-lg"></i> Security & Privacy
              </button>
              <button onClick={() => setActiveTab('notifications')} className={`w-full text-left px-5 py-4 rounded-2xl font-bold text-sm transition-colors mb-2 flex items-center ${activeTab === 'notifications' ? 'bg-teal-50 text-brand-darkTeal' : 'text-gray-500 hover:bg-gray-50 hover:text-brand-teal'}`}>
                <i className="fa-regular fa-bell w-6 text-center mr-2 text-lg"></i> Notifications
              </button>
            </div>
          </div>

          <div className="lg:col-span-9">
            <div className="bg-white rounded-3xl p-8 md:p-10 border border-gray-100 shadow-sm min-h-[500px]">
              
              {activeTab === 'profile' && (
                <div className="animate-fade-in">
                  <h4 className="font-extrabold text-2xl text-brand-navy mb-8">Public Profile</h4>
                  <div className="flex items-center mb-10">
                    <img src={profile.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full border-4 border-gray-100 mr-6 object-cover" />
                    <div>
                      <label className="bg-white border-2 border-gray-200 text-brand-navy hover:bg-gray-50 hover:border-gray-300 font-bold py-2 px-5 rounded-xl text-sm transition-colors mb-2 cursor-pointer inline-block">
                        Change Photo
                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                      </label>
                      <p className="text-xs text-gray-400 m-0 font-semibold">JPG or PNG. Max size 2MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">First Name</label>
                      <input type="text" value={profile.firstName} onChange={(e) => setProfile({...profile, firstName: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-teal focus:bg-white transition-colors text-brand-navy font-semibold" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">Last Name</label>
                      <input type="text" value={profile.lastName} onChange={(e) => setProfile({...profile, lastName: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-teal focus:bg-white transition-colors text-brand-navy font-semibold" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-gray-600 mb-2">Bio / About Me</label>
                      <textarea rows="4" value={profile.bio} onChange={(e) => setProfile({...profile, bio: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-teal focus:bg-white transition-colors text-brand-navy font-semibold resize-none"></textarea>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-gray-600 mb-2">Timezone</label>
                      <select value={profile.timezone} onChange={(e) => setProfile({...profile, timezone: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-teal focus:bg-white transition-colors text-brand-navy font-semibold appearance-none cursor-pointer">
                        <option>India Standard Time (IST)</option>
                        <option>Eastern Standard Time (EST)</option>
                        <option>Pacific Standard Time (PST)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="animate-fade-in">
                  <h4 className="font-extrabold text-2xl text-brand-navy mb-8">Password & Security</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">New Password</label>
                      <input type="password" value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} placeholder="Create new password" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-teal focus:bg-white transition-colors text-brand-navy font-semibold" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">Confirm New Password</label>
                      <input type="password" value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} placeholder="Confirm new password" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-teal focus:bg-white transition-colors text-brand-navy font-semibold" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="animate-fade-in">
                  <h4 className="font-extrabold text-2xl text-brand-navy mb-8">Communication Preferences</h4>
                  <div className="space-y-6 mb-8">
                    <div className="flex items-center justify-between bg-gray-50 p-5 rounded-2xl border border-gray-100">
                      <div>
                        <h6 className="font-extrabold text-sm text-brand-navy m-0 mb-1">Session Reminders</h6>
                        <span className="text-xs text-gray-500 font-semibold">Get email alerts 30 minutes before sessions.</span>
                      </div>
                      <ToggleSwitch checked={notifications.reminders} onChange={() => setNotifications({...notifications, reminders: !notifications.reminders})} />
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 p-5 rounded-2xl border border-gray-100">
                      <div>
                        <h6 className="font-extrabold text-sm text-brand-navy m-0 mb-1">Mentorship Requests</h6>
                        <span className="text-xs text-gray-500 font-semibold">Notify me when someone wants to learn from me.</span>
                      </div>
                      <ToggleSwitch checked={notifications.requests} onChange={() => setNotifications({...notifications, requests: !notifications.requests})} />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-6 border-t border-gray-50">
                <button onClick={handleSave} disabled={saveStatus !== 'idle'} className={`font-extrabold py-3 px-8 rounded-xl text-sm transition-all flex items-center justify-center min-w-[160px] ${saveStatus === 'saved' ? 'bg-green-500 text-white' : 'bg-brand-navy text-white hover:bg-gray-800'}`}>
                  {saveStatus === 'idle' && 'Save Changes'}
                  {saveStatus === 'saving' && <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Saving...</>}
                  {saveStatus === 'saved' && <><i className="fa-solid fa-check mr-2"></i> Saved!</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;