import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 

const Navbar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate(); 
  
  // 👈 NEW: Ref for the hidden file input
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [isUploading, setIsUploading] = useState(false); // 👈 NEW: Track upload status

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUserEmail(session.user.email); 

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        setProfile(data);
      }
    };

    fetchUserData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut(); 
    navigate('/'); 
  };

  // 👈 NEW: Handle the image upload directly from the Navbar
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !profile) return;

    // Validate file type and size (max 2MB)
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB.');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Get the new Public URL
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const newAvatarUrl = publicUrlData.publicUrl;

      // 3. Update the user's profile in the database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // 4. Update local state so the UI changes instantly!
      setProfile(prev => ({ ...prev, avatar_url: newAvatarUrl }));

    } catch (error) {
      console.error('Error uploading image:', error.message);
      alert('Failed to update profile picture. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const getNavClass = (path) => {
    return location.pathname === path 
      ? "text-brand-teal font-bold" 
      : "text-[#4A5568] font-semibold hover:text-brand-teal transition-colors";
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1800px] mx-auto px-4 md:px-12 py-4 flex items-center justify-between">
        
        <Link to="/dashboard" className="text-2xl font-extrabold text-brand-navy">
          Skill<span className="text-brand-teal">Matrix</span>
        </Link>

        <nav className="hidden lg:flex space-x-8">
          <Link to="/dashboard" className={getNavClass('/dashboard')}>Dashboard</Link>
          <Link to="/teaching" className={getNavClass('/teaching')}>Teaching</Link>
          <Link to="/learning" className={getNavClass('/learning')}>Learning</Link>
          <Link to="/marketplace" className={getNavClass('/marketplace')}>Marketplace</Link>
          <Link to="/mydna" className={getNavClass('/mydna')}>My DNA</Link>
          <Link to="/messages" className={getNavClass('/messages')}>Messages</Link>
        </nav>

        <div className="flex items-center justify-end relative">
          
          <Link to="/wallet" className="bg-[#F6C90E]/20 px-4 py-1.5 rounded-full mr-4 hover:bg-[#F6C90E]/30 transition-colors">
            <span className="text-[#D69E2E] font-extrabold text-sm">
              {profile?.knowledge_credits !== undefined ? profile.knowledge_credits : '...'} KC
            </span>
          </Link>

          {/* MAIN NAVBAR AVATAR */}
          <div 
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className="font-bold text-brand-navy mr-3 hidden sm:block">
              {profile?.full_name?.split(' ')[0] || 'Loading'} <i className="fa-solid fa-chevron-down text-[10px] ml-1 text-gray-400"></i>
            </span>
            <img 
              src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.avatar_seed || 'User'}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-brand-teal bg-gray-50 object-cover"
            />
          </div>

          {/* DROPDOWN MENU */}
          {isDropdownOpen && (
            <div className="absolute top-[50px] right-0 bg-white border border-gray-200 rounded-2xl shadow-xl w-64 animate-fade-in overflow-hidden">
              
              {/* 👈 UPDATED: Interactive Dropdown Header */}
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                
                {/* Hidden file input */}
                <input 
                  type="file" 
                  accept="image/jpeg, image/png"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden" 
                />

                {/* Clickable Avatar Container */}
                <div 
                  onClick={() => fileInputRef.current.click()}
                  className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-brand-teal group cursor-pointer flex-shrink-0 bg-white"
                  title="Change Profile Picture"
                >
                  <img 
                    src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.avatar_seed || 'User'}`} 
                    alt="Upload Profile" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploading ? (
                      <i className="fa-solid fa-spinner fa-spin text-white text-xs"></i>
                    ) : (
                      <i className="fa-solid fa-camera text-white text-xs"></i>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden">
                  <h6 className="m-0 font-extrabold text-brand-navy text-sm truncate">{profile?.full_name || 'Loading...'}</h6>
                  <span className="text-xs text-gray-500 truncate block">{userEmail || '...'}</span>
                </div>
              </div>
              
              <div className="p-2">
                <Link to="/profile" onClick={() => setIsDropdownOpen(false)} className="flex items-center text-sm font-semibold text-gray-600 p-2.5 rounded-xl hover:bg-gray-50 hover:text-brand-teal transition-colors">
                  <i className="fa-regular fa-user w-5 text-brand-teal mr-2 text-center"></i> Public Profile
                </Link>
                <Link to="/wallet" onClick={() => setIsDropdownOpen(false)} className="flex items-center text-sm font-semibold text-gray-600 p-2.5 rounded-xl hover:bg-gray-50 hover:text-brand-teal transition-colors">
                  <i className="fa-solid fa-wallet w-5 text-[#F6C90E] mr-2 text-center"></i> My Wallet
                </Link>
                <Link to="/settings" onClick={() => setIsDropdownOpen(false)} className="flex items-center text-sm font-semibold text-gray-600 p-2.5 rounded-xl hover:bg-gray-50 hover:text-brand-teal transition-colors">
                  <i className="fa-solid fa-gear w-5 text-brand-blue mr-2 text-center"></i> Settings
                </Link>
                <Link to="/support" onClick={() => setIsDropdownOpen(false)} className="flex items-center text-sm font-semibold text-gray-600 p-2.5 rounded-xl hover:bg-gray-50 hover:text-brand-teal transition-colors">
                  <i className="fa-regular fa-circle-question w-5 text-green-500 mr-2 text-center"></i> Help & Support
                </Link>
                
                <div className="border-t border-gray-100 my-1"></div>
                
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center text-sm font-semibold text-[#F5385A] p-2.5 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket w-5 mr-2 text-center"></i> Log Out
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </header>
  );
};

export default Navbar;