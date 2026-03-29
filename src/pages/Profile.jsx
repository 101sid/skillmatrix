import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // 👈 Switched searchParams to useParams
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; 

const Profile = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // 👈 Grabs the ID from /profile/:id
  
  // Database States
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Track if we are looking at our own profile
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        let targetId = id;

        // SCENARIO 1: No ID in URL? Load my own profile
        if (!targetId) {
          if (!session) {
            navigate('/');
            return;
          }
          targetId = session.user.id;
          setIsOwnProfile(true);
        } else {
          // SCENARIO 2: ID exists, check if it's actually mine
          setIsOwnProfile(session?.user.id === targetId);
        }

        // 1. Fetch the Profile by ID
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetId)
          .single();

        if (profileError || !profileData) {
          throw new Error("Peer DNA not found in the network.");
        }
        
        setProfile(profileData);

        // 2. Fetch their "Supply" Skills
        const { data: skillsData, error: skillsError } = await supabase
          .from('skills')
          .select('*')
          .eq('user_id', targetId)
          .eq('proficiency_level', 'Supply');

        if (!skillsError && skillsData) {
          setSkills(skillsData);
        }

      } catch (err) {
        console.error("Error fetching profile:", err.message);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [id, navigate]); // Re-run if the ID in the URL changes

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center text-brand-navy">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal mb-4"></i>
        <h2 className="font-bold tracking-widest uppercase text-sm text-gray-500">Scanning Network...</h2>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex flex-col text-brand-navy">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center">
          <i className="fa-solid fa-user-slash text-5xl text-gray-300 mb-4"></i>
          <h2 className="text-xl font-bold text-gray-500 mb-4">{error || "Profile not found."}</h2>
          <button onClick={() => navigate('/dashboard')} className="bg-brand-navy text-white px-6 py-2 rounded-xl font-bold">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const seed = profile.avatar_seed || 'User';
  const displayRole = profile.role || 'Peer Member';
  const trustScore = profile.trust_score || 0;
  const primarySkill = skills.length > 0 ? skills[0].skill_name : 'Knowledge Exchange';

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col text-brand-navy">
      <Navbar />
      
      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full animate-fade-in">
        
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-gray-400 hover:text-brand-teal mb-6 flex items-center transition-colors">
          <i className="fa-solid fa-arrow-left mr-2 text-[10px]"></i> Go Back
        </button>

        {/* Profile Header Card */}
        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="h-48 bg-gradient-to-r from-brand-teal to-brand-blue relative">
             <i className="fa-solid fa-dna absolute -right-10 -bottom-10 text-[150px] opacity-10 text-white"></i>
          </div>
          
          <div className="px-10 pb-10 relative">
            <div className="flex justify-between items-end -mt-16 mb-6">
              
              <img 
                src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} 
                className="w-32 h-32 rounded-full border-4 border-white bg-gray-50 shadow-lg object-cover" 
                alt={profile.full_name} 
              />
              
              <div className="flex gap-4">
                {!isOwnProfile ? (
                  <>
                    <button 
                      onClick={() => navigate('/messages')}
                      className="bg-gray-50 text-gray-600 hover:text-brand-navy font-bold py-3 px-6 rounded-2xl transition-all shadow-sm"
                    >
                      <i className="fa-regular fa-message mr-2"></i> Message
                    </button>
                    <button 
                      onClick={() => navigate(`/marketplace`)}
                      className="bg-brand-teal hover:bg-brand-darkTeal text-white font-extrabold py-3 px-8 rounded-2xl transition-all shadow-md active:scale-95 flex items-center shadow-brand-teal/20"
                    >
                      <i className="fa-regular fa-calendar-check mr-3"></i> Book Session
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => navigate(`/settings`)}
                    className="bg-gray-50 text-brand-teal hover:bg-teal-50 border border-teal-100 font-extrabold py-3 px-6 rounded-2xl transition-all shadow-sm"
                  >
                    <i className="fa-solid fa-pen-to-square mr-2"></i> Edit Profile
                  </button>
                )}
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-extrabold m-0 flex items-center gap-3">
                {profile.full_name} {trustScore > 90 && <i className="fa-solid fa-circle-check text-green-500 text-lg"></i>}
              </h1>
              <p className="text-sm font-bold text-brand-teal uppercase tracking-widest mt-1 mb-4">{displayRole}</p>
              <p className="text-gray-500 text-sm max-w-2xl leading-relaxed">
                {profile.bio || `Passionate about sharing knowledge in ${primarySkill}. Let's connect and grow together.`}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
               <h3 className="font-extrabold text-lg mb-6">Peer Reputation</h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-center"><span className="text-gray-500 text-sm font-bold">Trust Rating</span><span className="font-extrabold text-brand-navy">{trustScore}%</span></div>
                 <div className="flex justify-between items-center"><span className="text-gray-500 text-sm font-bold">Network Reach</span><span className="font-extrabold text-brand-navy">Level 4</span></div>
               </div>
            </div>
          </div>

          <div className="lg:col-span-8">
             <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 min-h-[250px]">
               <h3 className="font-extrabold text-lg mb-6">Expertise DNA</h3>
               {skills.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">No verified supply skills listed yet.</p>
               ) : (
                 <div className="space-y-6">
                   {skills.map((s, index) => (
                     <div key={s.id}>
                       <div className="flex justify-between text-xs font-bold mb-2">
                         <span>{s.skill_name}</span>
                         <span className="text-brand-teal uppercase">Verified</span>
                       </div>
                       <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                         <div className="bg-brand-teal h-full" style={{width: '85%'}}></div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;