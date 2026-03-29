import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 

const Auth = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // --- STATES ---
  const [isLogin, setIsLogin] = useState(true); 
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(''); 
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  // 👈 NEW: Avatar Upload States
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // --- HANDLERS ---
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 👈 NEW: Handle Image Selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic validation (must be image, under 2MB)
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please upload an image file (JPEG, PNG).');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('Image must be less than 2MB.');
        return;
      }
      
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file)); // Show preview instantly
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        // --- REAL LOGIN LOGIC ---
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;
        navigate('/dashboard');

      } else {
        // --- REAL REGISTER LOGIC ---
        
        // 1. Create the user in Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        if (authError) throw authError;
        const userId = authData.user.id;

        // 2. 👈 NEW: Upload Avatar to Storage (if they selected one)
        let finalAvatarUrl = null;
        if (avatarFile) {
          const fileExt = avatarFile.name.split('.').pop();
          const fileName = `${userId}-${Date.now()}.${fileExt}`; // Unique filename

          // Upload to Supabase Storage 'avatars' bucket
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile);

          if (uploadError) throw uploadError;

          // Get the public URL to save in the database
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
          finalAvatarUrl = publicUrlData.publicUrl;
        }

        // 3. Create their public profile
        if (userId) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: userId,
                full_name: formData.fullName,
                avatar_seed: formData.fullName.split(' ')[0] || 'User',
                avatar_url: finalAvatarUrl // 👈 Save the new image URL!
              }
            ]);

          if (profileError) throw profileError;
        }

        navigate('/dashboard');
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F9FD] p-4 relative overflow-hidden">
      
      {/* BACKGROUND DECO */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-teal/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-blue/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-[1000px] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] relative z-10 border border-gray-100">
        
        {/* LEFT SIDE: BRANDING/MARKETING */}
        <div className="md:w-1/2 bg-brand-navy p-10 md:p-16 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
              Skill<span className="text-brand-teal">Matrix</span>
            </h1>
            <h2 className="text-xl md:text-2xl font-bold mb-4 opacity-90">
              {isLogin ? "Welcome Back to the Network." : "Start Trading Your Expertise Today."}
            </h2>
            <p className="text-gray-400 text-sm md:text-base mb-10 leading-relaxed">
              Join thousands of peer-mentors exchanging knowledge through a decentralized credit system. 
              {isLogin ? " Your next breakthrough is one session away." : " Your skills are a liquid asset—it's time to leverage them."}
            </p>

            <div className="flex gap-8">
              <div>
                <h4 className="text-brand-teal font-extrabold text-2xl">12k+</h4>
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Mentors</span>
              </div>
              <div>
                <h4 className="text-brand-yellow font-extrabold text-2xl">98%</h4>
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Trust Score</span>
              </div>
            </div>
          </div>
          <i className="fa-solid fa-dna absolute -right-10 -bottom-10 text-[200px] opacity-5 -rotate-12"></i>
        </div>

        {/* RIGHT SIDE: THE FORM */}
        <div className="md:w-1/2 p-10 md:p-16 flex flex-col justify-center bg-white overflow-y-auto">
          <div className="max-w-sm mx-auto w-full">
            <div className="mb-8">
              <h3 className="text-3xl font-extrabold text-brand-navy mb-2">
                {isLogin ? "Login" : "Register"}
              </h3>
              <p className="text-sm text-gray-500 font-medium">
                {isLogin ? "Enter your credentials to access your DNA." : "Create an account to start your journey."}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 text-xs font-bold flex items-center gap-3 animate-fade-in">
                <i className="fa-solid fa-circle-exclamation text-lg"></i>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {!isLogin && (
                <div className="animate-fade-in space-y-5">
                  
                  {/* 👈 NEW: AVATAR UPLOAD UI */}
                  <div className="flex flex-col items-center mb-6">
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      className="hidden" 
                    />
                    <div 
                      onClick={() => fileInputRef.current.click()}
                      className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-brand-teal transition-colors group overflow-hidden bg-gray-50"
                    >
                      {avatarPreview ? (
                        <>
                          <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="fa-solid fa-camera text-white text-xl"></i>
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-gray-400 group-hover:text-brand-teal transition-colors">
                          <i className="fa-solid fa-cloud-arrow-up text-xl mb-1"></i>
                          <span className="block text-[8px] font-bold uppercase tracking-widest">Photo</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                    <div className="relative">
                      <i className="fa-regular fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                      <input 
                        type="text" 
                        name="fullName"
                        value={formData.fullName} 
                        onChange={handleInputChange} 
                        required={!isLogin}
                        placeholder="Siddhant Doe"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm outline-none focus:border-brand-teal focus:bg-white transition-all font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                <div className="relative">
                  <i className="fa-regular fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email} 
                    onChange={handleInputChange} 
                    required
                    placeholder="siddhant@example.com"
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm outline-none focus:border-brand-teal focus:bg-white transition-all font-semibold"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className="block text-xs font-extrabold text-gray-400 uppercase tracking-widest">Password</label>
                  {isLogin && (
                    <a href="#" className="text-[10px] font-bold text-brand-blue hover:underline">Forgot?</a>
                  )}
                </div>
                <div className="relative">
                  <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input 
                    type="password" 
                    name="password"
                    value={formData.password} 
                    onChange={handleInputChange} 
                    required
                    placeholder="••••••••"
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm outline-none focus:border-brand-teal focus:bg-white transition-all font-semibold"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-brand-navy hover:bg-gray-800 text-white font-extrabold py-4 px-6 rounded-2xl text-base transition-all hover:shadow-xl hover:-translate-y-1 flex items-center justify-center disabled:opacity-70 disabled:hover:translate-y-0 mt-4"
              >
                {isLoading ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Processing...</>
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500 font-bold">
                {isLogin ? "Don't have an account?" : "Already a member?"}
                <button 
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrorMsg('');
                    setAvatarFile(null); // Clear avatar state when switching
                    setAvatarPreview(null);
                  }}
                  className="ml-2 text-brand-teal hover:text-brand-darkTeal underline decoration-2 underline-offset-4 transition-colors"
                >
                  {isLogin ? "Register now" : "Login here"}
                </button>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Auth;