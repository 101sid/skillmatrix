import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient';

const Marketplace = () => {
  const navigate = useNavigate();
  
  // --- UI STATES ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingStatus, setBookingStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [bookingError, setBookingError] = useState('');

  // --- DATABASE STATES ---
  const [mentors, setMentors] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMarketplaceData();
  }, []);

  // 1. FETCH DATA: Get current user wallet + all available mentors
  const fetchMarketplaceData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }

      // Fetch user's profile for credit balance
      const { data: userData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      setCurrentUser(userData);

      // Fetch skills where proficiency is 'Supply' (Mentors)
      const { data: supplySkills, error } = await supabase
        .from('skills')
        .select(`
          id,
          skill_name,
          proficiency_level,
          user_id,
          profiles!inner(id, full_name, avatar_seed, role, trust_score, avatar_url)
        `)
        .eq('proficiency_level', 'Supply')
        .neq('user_id', session.user.id); // Exclude yourself

      if (error) throw error;

      if (supplySkills) {
        const formattedMentors = supplySkills.map(item => ({
          id: item.user_id,
          skill_id: item.id,
          name: item.profiles.full_name,
          role: item.profiles.role || 'Peer Mentor',
          skill: item.skill_name,
          rating: (Math.random() * (5.0 - 4.5) + 4.5).toFixed(1),
          trust: `${item.profiles.trust_score}%`,
          sessions: Math.floor(Math.random() * 50) + 1,
          price: 40, // Fixed MVP price
          verified: item.profiles.trust_score > 90,
          seed: item.profiles.avatar_seed || 'Mentor',
          avatar_url: item.profiles.avatar_url
        }));
        
        setMentors(formattedMentors);
      }
    } catch (error) {
      console.error("Marketplace Load Error:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. SEARCH FILTERING
  const filteredMentors = mentors.filter(mentor => 
    mentor.skill.toLowerCase().includes(searchQuery.toLowerCase()) || 
    mentor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 3. BOOKING LOGIC: The Multi-Step Transaction
  const handleConfirmBooking = async () => {
    setBookingStatus('loading');
    setBookingError('');
    
    try {
      if (currentUser.knowledge_credits < selectedMentor.price) {
        throw new Error("Insufficient Knowledge Credits. Visit the Wallet to top up.");
      }

      // STEP A: Create the Session Record
      const { error: sessionError } = await supabase
        .from('sessions')
        .insert([{
          mentor_id: selectedMentor.id,
          student_id: currentUser.id,
          skill_topic: selectedMentor.skill,
          scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Set for +24h
          status: 'Pending',
          kc_cost: selectedMentor.price
        }]);

      if (sessionError) throw sessionError;

      // STEP B: Deduct Credits from Profile
      const newBalance = currentUser.knowledge_credits - selectedMentor.price;
      const { error: walletError } = await supabase
        .from('profiles')
        .update({ knowledge_credits: newBalance })
        .eq('id', currentUser.id);

      if (walletError) throw walletError;

      // STEP C: Insert record into Transactions Table (Wallet History)
      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          user_id: currentUser.id,
          amount: -selectedMentor.price,
          description: `Booked session: ${selectedMentor.skill} with ${selectedMentor.name}`,
          category: 'Lesson'
        }]);

      if (txError) throw txError;

      // STEP D: Send "System" Notification Message
      const { error: msgError } = await supabase
        .from('messages')
        .insert([{
          sender_id: currentUser.id,
          receiver_id: selectedMentor.id,
          content: `📅 NEW BOOKING: ${currentUser.full_name} has booked a session for "${selectedMentor.skill}"!`,
          type: 'system' 
        }]);

      if (msgError) console.error("Notification failed:", msgError);

      // --- ALL STEPS SUCCESSFUL ---
      setBookingStatus('success');
      setCurrentUser({...currentUser, knowledge_credits: newBalance});
      
      setTimeout(() => {
        setIsModalOpen(false);
        navigate('/messages'); 
      }, 2000);

    } catch (error) {
      setBookingError(error.message);
      setBookingStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar currentBalance={currentUser?.knowledge_credits} />

      {/* SEARCH BANNER */}
      <div className="bg-gradient-to-br from-brand-teal to-brand-blue py-16 text-center mb-10 shadow-inner">
        <div className="max-w-[1800px] mx-auto px-4 md:px-12 text-white">
          <h1 className="font-black text-4xl md:text-5xl mb-4 tracking-tight text-shadow-sm">Marketplace</h1>
          <p className="text-white/80 text-lg mb-8 font-medium italic">"The only thing more valuable than money is the skills you trade it for."</p>
          <div className="max-w-2xl mx-auto relative group">
            <input 
              type="text" 
              placeholder="Search by skill (Python, UX, Java) or mentor name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-5 px-8 rounded-full border-none shadow-2xl outline-none text-brand-navy text-lg focus:ring-4 focus:ring-white/20 transition-all"
            />
            <i className="fa-solid fa-magnifying-glass absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-brand-teal transition-colors"></i>
          </div>
        </div>
      </div>

      <main className="flex-grow pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* SIDEBAR */}
          <div className="lg:col-span-3">
             <div className="bg-brand-navy rounded-[32px] p-8 text-white mb-6 shadow-lg relative overflow-hidden">
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-400 block mb-1">Your Wallet</span>
                <h2 className="text-3xl font-black text-[#F6C90E] m-0">{currentUser?.knowledge_credits || 0} <span className="text-sm">KC</span></h2>
                <button onClick={() => navigate('/wallet')} className="mt-6 text-xs font-bold text-brand-teal hover:underline flex items-center gap-2">
                    Open Wallet <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
                <i className="fa-solid fa-bolt absolute -right-4 -bottom-4 text-7xl opacity-5 rotate-12"></i>
             </div>
             
             <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 hidden lg:block">
                <h4 className="text-xs font-black uppercase tracking-widest mb-6">Discovery</h4>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 text-sm font-bold text-gray-500 cursor-pointer hover:text-brand-teal transition-colors">
                        <input type="checkbox" defaultChecked className="w-4 h-4 accent-brand-teal" /> Peer Verified
                    </label>
                    <label className="flex items-center gap-3 text-sm font-bold text-gray-500 cursor-pointer hover:text-brand-teal transition-colors">
                        <input type="checkbox" className="w-4 h-4 accent-brand-teal" /> Top Rated
                    </label>
                </div>
             </div>
          </div>

          {/* MENTOR GRID */}
          <div className="lg:col-span-9">
            {isLoading ? (
               <div className="text-center py-20 flex flex-col items-center">
                   <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal mb-4"></i>
                   <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Syncing Network...</span>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredMentors.map((mentor) => (
                  <div key={`${mentor.id}-${mentor.skill_id}`} className="bg-white rounded-[32px] p-8 border border-gray-100 hover:shadow-2xl hover:border-brand-teal/30 transition-all group flex flex-col h-full relative">
                    
                    {mentor.verified && (
                        <div className="absolute top-6 right-6 text-green-500 text-sm font-black flex items-center gap-1.5 bg-green-50 px-3 py-1 rounded-full">
                            <i className="fa-solid fa-circle-check"></i> 
                        </div>
                    )}

                    <div className="flex items-center mb-8 cursor-pointer" onClick={() => navigate(`/profile/${mentor.id}`)}>
                      <img 
                        src={mentor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.seed}`} 
                        className="w-16 h-16 rounded-2xl border-2 border-gray-50 mr-5 group-hover:border-brand-teal transition-all shadow-sm object-cover" 
                        alt="" 
                      />
                      <div className="min-w-0">
                        <h3 className="text-lg font-black m-0 group-hover:text-brand-teal transition-colors truncate">{mentor.name}</h3>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest m-0 mt-1">{mentor.role}</p>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-4 mb-8">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Teaching expertise</div>
                        <div className="text-sm font-black text-brand-blue flex items-center gap-2">
                             <i className="fa-solid fa-graduation-cap text-brand-teal"></i> {mentor.skill}
                        </div>
                    </div>

                    <div className="flex justify-between mb-8">
                      <div className="text-center"><h6 className="font-black text-sm m-0">{mentor.rating} <i className="fa-solid fa-star text-brand-yellow text-[10px]"></i></h6><span className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Rating</span></div>
                      <div className="text-center"><h6 className="font-black text-sm m-0">{mentor.trust}</h6><span className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Trust</span></div>
                      <div className="text-center"><h6 className="font-black text-sm m-0">{mentor.sessions}</h6><span className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Completed</span></div>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <div>
                          <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Session Cost</span>
                          <div className="text-2xl font-black text-brand-navy">{mentor.price} <span className="text-xs text-brand-teal">KC</span></div>
                      </div>
                      <button 
                        onClick={() => handleOpenModal(mentor)}
                        className="bg-brand-navy hover:bg-brand-teal text-white py-3 px-6 rounded-2xl text-xs font-black transition-all active:scale-95 shadow-lg shadow-brand-navy/10"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL */}
      {isModalOpen && selectedMentor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-navy/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="p-10 text-center">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-gray-300 hover:text-brand-red transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
                
                <div className="w-20 h-20 bg-teal-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-file-invoice-dollar text-3xl text-brand-teal"></i>
                </div>
                
                <h5 className="font-black text-2xl mb-2 text-brand-navy">Confirm Booking</h5>
                <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                    You're booking <strong>{selectedMentor.skill}</strong> with <strong>{selectedMentor.name}</strong>. This transaction is secured by peer-review.
                </p>

                <div className="bg-gray-50 rounded-3xl p-8 border-2 border-dashed border-gray-100 mb-8">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Amount</div>
                    <h2 className="text-4xl font-black text-brand-navy m-0">-{selectedMentor.price} <span className="text-xl">KC</span></h2>
                    <span className="text-[10px] font-bold text-gray-400 mt-4 block">AVAILABLE: {currentUser?.knowledge_credits} KC</span>
                </div>

                {bookingStatus === 'error' && <p className="text-red-500 text-xs font-black mb-6 uppercase tracking-tight"><i className="fa-solid fa-triangle-exclamation mr-1"></i> {bookingError}</p>}
                
                {bookingStatus === 'success' ? (
                    <div className="bg-green-500 text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest animate-bounce">
                        <i className="fa-solid fa-check mr-2"></i> Session Secured!
                    </div>
                ) : (
                    <button 
                        onClick={handleConfirmBooking}
                        disabled={bookingStatus === 'loading'}
                        className="w-full bg-brand-navy hover:bg-brand-teal text-white font-black py-5 rounded-3xl text-sm transition-all shadow-xl shadow-brand-navy/20 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {bookingStatus === 'loading' ? (
                            <><i className="fa-solid fa-spinner fa-spin"></i> Encrypting...</>
                        ) : (
                            <>Confirm & Notify Peer</>
                        )}
                    </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;