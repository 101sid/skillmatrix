import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; 

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get the target user's name from the URL
  const targetName = searchParams.get('peer');
  
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

        // Get the current logged-in user session
        const { data: { session } } = await supabase.auth.getSession();
        let profileDataToSet = null;

        // SCENARIO 1: Looking at someone else's profile via the ?peer= URL param
        if (targetName) {
          const { data: peerData, error: peerError } = await supabase
            .from('profiles')
            .select('*')
            .ilike('full_name', targetName) // Case-insensitive search
            .single();

          if (peerError || !peerData) {
            throw new Error("User not found in the network.");
          }
          profileDataToSet = peerData;
        } 
        // SCENARIO 2: URL is just "/profile" -> Load our own data
        else if (session) {
          const { data: myData, error: myError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (myError || !myData) {
            throw new Error("Could not load your profile.");
          }
          profileDataToSet = myData;
        } 
        // SCENARIO 3: No URL param and not logged in
        else {
          throw new Error("No user specified and not logged in.");
        }
        
        setProfile(profileDataToSet);

        // Check if the profile we loaded belongs to the logged-in user
        if (session && session.user.id === profileDataToSet.id) {
          setIsOwnProfile(true);
        } else {
          setIsOwnProfile(false);
        }

        // Fetch their "Supply" Skills
        const { data: skillsData, error: skillsError } = await supabase
          .from('skills')
          .select('*')
          .eq('user_id', profileDataToSet.id)
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
  }, [targetName]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center text-brand-navy">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal mb-4"></i>
        <h2 className="font-bold tracking-widest uppercase text-sm text-gray-500">Retrieving DNA...</h2>
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
          <button onClick={() => navigate(-1)} className="bg-brand-navy text-white px-6 py-2 rounded-xl font-bold">Go Back</button>
        </div>
      </div>
    );
  }

  // Determine dynamic values based on the real profile data
  const seed = profile.avatar_seed || 'User';
  const displayRole = profile.role || 'Peer Mentor';
  const trustScore = profile.trust_score || 0;
  // If they have supply skills, use the first one as their primary display skill
  const primarySkill = skills.length > 0 ? skills[0].skill_name : 'Knowledge Exchange';

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col text-brand-navy">
      <Navbar />
      
      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full animate-fade-in">
        
        {/* Back Button */}
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
              
              {/* 👈 UPDATED: Real uploaded profile picture with fallback and object-cover */}
              <img 
                src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} 
                className="w-32 h-32 rounded-full border-4 border-white bg-gray-50 shadow-lg object-cover" 
                alt={profile.full_name} 
              />
              
              <div className="flex gap-4">
                {!isOwnProfile ? (
                  <>
                    <button className="bg-gray-50 text-gray-600 hover:text-brand-navy font-bold py-3 px-6 rounded-2xl transition-all shadow-sm">
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
                    onClick={() => navigate(`/mydna`)}
                    className="bg-gray-50 text-brand-teal hover:bg-teal-50 border border-teal-100 font-extrabold py-3 px-6 rounded-2xl transition-all shadow-sm"
                  >
                    <i className="fa-solid fa-pen-to-square mr-2"></i> Edit DNA
                  </button>
                )}
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-extrabold m-0 flex items-center gap-3">
                {profile.full_name} {trustScore > 90 && <i className="fa-solid fa-circle-check text-green-500 text-lg" title="Verified Member"></i>}
              </h1>
              <p className="text-sm font-bold text-brand-teal uppercase tracking-widest mt-1 mb-4">{displayRole}</p>
              <p className="text-gray-500 text-sm max-w-2xl leading-relaxed">
                Passionate educator and peer mentor specializing in {primarySkill}. I believe knowledge is the ultimate liquid asset, and I'm here to help you debug, architecture, and deploy your next big project.
              </p>
            </div>
          </div>
        </div>

        {/* Stats & Skills Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Metrics */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
               <h3 className="font-extrabold text-lg mb-6">Metrics</h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-center"><span className="text-gray-500 text-sm font-bold">Trust Score</span><span className="font-extrabold text-brand-navy">{trustScore}%</span></div>
                 {/* Simulating sessions and rating for the MVP */}
                 <div className="flex justify-between items-center"><span className="text-gray-500 text-sm font-bold">Sessions</span><span className="font-extrabold text-brand-navy">{Math.floor(Math.random() * 50) + 5}</span></div>
                 <div className="flex justify-between items-center"><span className="text-gray-500 text-sm font-bold">Avg Rating</span><span className="font-extrabold text-brand-navy">{(Math.random() * (5.0 - 4.5) + 4.5).toFixed(1)} <i className="fa-solid fa-star text-brand-yellow text-[10px]"></i></span></div>
               </div>
            </div>
          </div>

          {/* Right Column: Skills */}
          <div className="lg:col-span-8 space-y-8">
             <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 min-h-[250px]">
               <h3 className="font-extrabold text-lg mb-6">Verified DNA (Supply)</h3>
               
               {skills.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <i className="fa-solid fa-dna mb-2 text-3xl opacity-50"></i>
                    <p className="text-sm font-medium mt-2">No verified skills listed yet.</p>
                  </div>
               ) : (
                 <div className="space-y-6">
                   {skills.map((s, index) => {
                      // Cycle through brand colors for visual effect
                      const colors = ['bg-brand-teal', 'bg-brand-yellow', 'bg-brand-red'];
                      const textColors = ['text-brand-teal', 'text-brand-yellow', 'text-brand-red'];
                      const colorClass = colors[index % colors.length];
                      const textClass = textColors[index % textColors.length];
                      // Simulate proficiency bar width
                      const width = `${Math.floor(Math.random() * (100 - 60) + 60)}%`;

                      return (
                        <div key={s.id}>
                          <div className="flex justify-between text-xs font-bold mb-2">
                            <span>{s.skill_name}</span>
                            <span className={textClass}>Expert</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden shadow-inner">
                            <div className={`${colorClass} h-full transition-all duration-1000`} style={{width: width}}></div>
                          </div>
                        </div>
                      );
                   })}
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