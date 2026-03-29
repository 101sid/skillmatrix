import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; // 👈 IMPORT SUPABASE

const Marketplace = () => {
  const navigate = useNavigate();
  
  // React States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingStatus, setBookingStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [bookingError, setBookingError] = useState('');

  // 👈 NEW: Database States
  const [mentors, setMentors] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 👈 NEW: Fetch actual mentors from the database
  useEffect(() => {
    fetchMentors();
  }, []);

  const fetchMentors = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }

      // 1. Get current user's wallet info (to check if they can afford a session)
      const { data: userData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setCurrentUser(userData);

      // 2. Fetch all users who have "Supply" skills (excluding the current user)
      // Note: In a production app, this would be a complex SQL JOIN or an AI Edge Function.
      // For this MVP, we fetch the skills and map them manually to create the Mentor cards.
      const { data: supplySkills, error } = await supabase
        .from('skills')
        .select(`
          id,
          skill_name,
          proficiency_level,
          user_id,
          profiles!inner(id, full_name, avatar_seed, role, trust_score)
        `)
        .eq('proficiency_level', 'Supply')
        .neq('user_id', session.user.id); // Don't show the user themselves

      if (error) throw error;

      // Transform the raw database rows into the clean format your UI expects
      if (supplySkills) {
        const formattedMentors = supplySkills.map(item => ({
          id: item.user_id, // We use the user_id as the mentor ID
          skill_id: item.id, // We need this specific skill ID for booking
          name: item.profiles.full_name,
          role: item.profiles.role || 'Peer Mentor',
          skill: item.skill_name,
          icon: "fa-solid fa-laptop-code text-brand-teal", // Generic icon for dynamic skills
          rating: (Math.random() * (5.0 - 4.5) + 4.5).toFixed(1), // Simulated rating for MVP
          trust: `${item.profiles.trust_score}%`,
          sessions: Math.floor(Math.random() * 50) + 1, // Simulated session count
          price: 40, // Standard MVP price for all sessions
          verified: item.profiles.trust_score > 90,
          seed: item.profiles.avatar_seed || 'Mentor'
        }));
        
        setMentors(formattedMentors);
      }
    } catch (error) {
      console.error("Error fetching marketplace:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic Filtering Logic
  const filteredMentors = mentors.filter(mentor => 
    mentor.skill.toLowerCase().includes(searchQuery.toLowerCase()) || 
    mentor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Booking Actions
  const handleOpenModal = (mentor) => {
    setSelectedMentor(mentor);
    setBookingStatus('idle');
    setBookingError('');
    setIsModalOpen(true);
  };

  // 👈 NEW: Real Booking Logic connecting to the database
  const handleConfirmBooking = async () => {
    setBookingStatus('loading');
    setBookingError('');
    
    try {
      // 1. Check if user has enough credits
      if (currentUser.knowledge_credits < selectedMentor.price) {
        throw new Error("Insufficient Knowledge Credits. Please earn more by teaching or add funds.");
      }

      // 2. Create the Session Record in the database
      const { error: sessionError } = await supabase
        .from('sessions')
        .insert([{
          mentor_id: selectedMentor.id,
          student_id: currentUser.id,
          skill_topic: selectedMentor.skill,
          scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Schedule for tomorrow MVP
          status: 'Pending',
          kc_cost: selectedMentor.price
        }]);

      if (sessionError) throw sessionError;

      // 3. Deduct Credits from Student's Wallet
      const newBalance = currentUser.knowledge_credits - selectedMentor.price;
      const { error: walletError } = await supabase
        .from('profiles')
        .update({ knowledge_credits: newBalance })
        .eq('id', currentUser.id);

      if (walletError) throw walletError;

      // Success!
      setBookingStatus('success');
      
      // Update local state so the UI reflects the new balance if they stay on the page
      setCurrentUser({...currentUser, knowledge_credits: newBalance});
      
      // Redirect after showing success message
      setTimeout(() => {
        setIsModalOpen(false);
        navigate('/sessions-log'); // 👈 Changed to route to the sessions page!
      }, 2000);

    } catch (error) {
      console.error("Booking Error:", error);
      setBookingError(error.message);
      setBookingStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-brand-navy">
      <Navbar />

      {/* SEARCH BANNER */}
      <div className="bg-gradient-to-br from-brand-teal to-brand-blue py-16 text-center mb-10">
        <div className="max-w-[1800px] mx-auto px-4 md:px-12">
          <h1 className="text-white font-extrabold text-4xl md:text-5xl mb-4 text-shadow-sm">Find Your Next Mentor</h1>
          <p className="text-white/90 text-lg mb-8">Spend your Knowledge Credits to master new skills.</p>
          
          <div className="max-w-2xl mx-auto relative">
            <input 
              type="text" 
              placeholder="Search for Figma, Java, React..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-4 px-6 rounded-full border-none text-base shadow-xl outline-none text-brand-navy focus:ring-4 focus:ring-white/30 transition-all"
            />
            <button className="absolute right-2 top-2 bg-brand-navy hover:bg-gray-800 text-white border-none py-2 px-6 rounded-full font-bold transition-colors">
              Search
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-grow pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDEBAR: FILTERS */}
          <div className="lg:col-span-3">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
              <h4 className="text-sm font-extrabold uppercase tracking-wide text-brand-navy mb-4">Categories</h4>
              <label className="flex items-center text-sm text-gray-600 mb-3 cursor-pointer hover:text-brand-teal transition-colors">
                <input type="checkbox" defaultChecked className="mr-3 w-4 h-4 accent-brand-teal" /> Programming
              </label>
              <label className="flex items-center text-sm text-gray-600 mb-3 cursor-pointer hover:text-brand-teal transition-colors">
                <input type="checkbox" defaultChecked className="mr-3 w-4 h-4 accent-brand-teal" /> Design & UI/UX
              </label>
              <label className="flex items-center text-sm text-gray-600 mb-3 cursor-pointer hover:text-brand-teal transition-colors">
                <input type="checkbox" className="mr-3 w-4 h-4 accent-brand-teal" /> Marketing
              </label>
              <label className="flex items-center text-sm text-gray-600 cursor-pointer hover:text-brand-teal transition-colors">
                <input type="checkbox" className="mr-3 w-4 h-4 accent-brand-teal" /> Data Science
              </label>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
              <h4 className="text-sm font-extrabold uppercase tracking-wide text-brand-navy mb-4">Verification</h4>
              <label className="flex items-center text-sm text-gray-600 mb-3 cursor-pointer hover:text-brand-teal transition-colors">
                <input type="checkbox" defaultChecked className="mr-3 w-4 h-4 accent-brand-teal" /> Peer Verified Only
              </label>
              <label className="flex items-center text-sm text-gray-600 cursor-pointer hover:text-brand-teal transition-colors">
                <input type="checkbox" className="mr-3 w-4 h-4 accent-brand-teal" /> Top 10% Mentors
              </label>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="text-sm font-extrabold uppercase tracking-wide text-brand-navy mb-4">Price Range</h4>
              <input type="range" min="10" max="200" defaultValue="100" className="w-full accent-brand-teal mb-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>10 KC</span>
                <span className="font-bold">Max: 100 KC</span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: MENTOR GRID */}
          <div className="lg:col-span-9">
            {isLoading ? (
               <div className="flex justify-center items-center py-20">
                 <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal"></i>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* Dynamic Mapping of Real Mentors */}
                {filteredMentors.length > 0 ? (
                  filteredMentors.map((mentor) => (
                    <div key={`${mentor.id}-${mentor.skill_id}`} className="bg-white rounded-2xl p-6 transition-all border border-gray-200 hover:-translate-y-1 hover:shadow-xl hover:border-brand-teal relative flex flex-col h-full group">
                      
                      {mentor.verified && (
                        <i className="fa-solid fa-circle-check absolute top-5 right-5 text-green-500 text-lg" title="Peer Verified"></i>
                      )}
                      
                      <div className="flex items-start mb-5">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.seed}`} alt={mentor.name} className="w-14 h-14 rounded-full border-2 border-gray-100 mr-4 group-hover:border-brand-teal transition-colors" />
                        <div>
                          <h3 onClick={() => navigate(`/profile?peer=${encodeURIComponent(mentor.name)}`)} className="text-lg font-extrabold m-0 cursor-pointer hover:text-brand-teal transition-colors">{mentor.name}</h3>
                          <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full inline-block mt-1">{mentor.role}</span>
                        </div>
                      </div>
                      
                      <div className="text-sm font-bold text-brand-blue mb-5">
                        <i className={`${mentor.icon} mr-2 text-lg align-middle`}></i> Teaching: {mentor.skill}
                      </div>
                      
                      <div className="flex justify-between mb-5 border-t border-dashed border-gray-200 pt-4">
                        <div className="text-center"><h6 className="font-extrabold text-sm m-0">{mentor.rating} <i className="fa-solid fa-star text-[#F6C90E] text-[10px]"></i></h6><span className="text-[10px] text-gray-400 uppercase font-bold">Rating</span></div>
                        <div className="text-center"><h6 className="font-extrabold text-sm m-0">{mentor.trust}</h6><span className="text-[10px] text-gray-400 uppercase font-bold">Trust</span></div>
                        <div className="text-center"><h6 className="font-extrabold text-sm m-0">{mentor.sessions}</h6><span className="text-[10px] text-gray-400 uppercase font-bold">Sessions</span></div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <div className="text-xl font-extrabold text-[#F6C90E]">{mentor.price} KC</div>
                        <button 
                          onClick={() => handleOpenModal(mentor)}
                          className="bg-brand-navy hover:bg-brand-teal text-white border-none py-2 px-5 rounded-xl text-sm font-bold transition-colors"
                        >
                          Book Session
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl">
                    <i className="fa-solid fa-magnifying-glass text-4xl text-gray-300 mb-4"></i>
                    <h3 className="text-xl font-bold text-gray-500">No mentors found</h3>
                    <p className="text-gray-400 text-sm">Be the first to add a Supply Skill in My DNA!</p>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* BOOKING MODAL */}
      {isModalOpen && selectedMentor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md shadow-2xl relative">
            
            <div className="border-b border-gray-100 p-5 flex justify-between items-center">
              <h5 className="font-extrabold text-lg m-0"><i className="fa-regular fa-calendar-check text-brand-teal mr-2"></i> Confirm Booking</h5>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-brand-red transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="p-8 text-center">
              <p className="text-gray-600 mb-6">
                You are about to book a session for <strong className="text-brand-blue">{selectedMentor.skill}</strong> with <strong>{selectedMentor.name}</strong>.
              </p>
              
              <div className="bg-gray-50 rounded-2xl p-5 border-2 border-dashed border-gray-200 inline-block mb-6 min-w-[200px]">
                <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">This will deduct</span>
                <h2 className="text-[#F6C90E] font-extrabold text-3xl m-0">-{selectedMentor.price} KC</h2>
                <span className="text-xs text-gray-400 mt-1 block">from your wallet ({currentUser?.knowledge_credits || 0} KC)</span>
              </div>

              {/* Error Display */}
              {bookingStatus === 'error' && (
                <div className="mb-4 text-xs font-bold text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
                  <i className="fa-solid fa-circle-exclamation mr-1"></i> {bookingError}
                </div>
              )}
              
              {/* Success Display */}
              {bookingStatus === 'success' && (
                <div className="bg-teal-50 text-brand-teal p-4 rounded-xl font-bold animate-fade-in">
                  <i className="fa-solid fa-circle-check mr-2"></i> Session Booked! Redirecting...
                </div>
              )}
            </div>

            {bookingStatus !== 'success' && (
              <div className="p-5 pt-0 flex justify-center gap-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 px-6 rounded-xl transition-colors w-full"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmBooking}
                  disabled={bookingStatus === 'loading'}
                  className="bg-brand-teal hover:bg-brand-darkTeal text-white font-bold py-3 px-6 rounded-xl transition-colors w-full flex items-center justify-center disabled:opacity-70"
                >
                  {bookingStatus === 'loading' ? (
                    <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Processing...</>
                  ) : (
                    'Confirm Payment'
                  )}
                </button>
              </div>
            )}
            
          </div>
        </div>
      )}

    </div>
  );
};

export default Marketplace;