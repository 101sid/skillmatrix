import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from '../components/Navbar';

const SessionDetail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // We can get the ID from the URL or search params
  const sessionId = searchParams.get('id');

  // --- STATES ---
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [userRating, setUserRating] = useState(0);

  // 1. FETCH SESSION & MENTOR DATA
  useEffect(() => {
    const fetchFullSessionDetails = async () => {
      try {
        setLoading(true);
        if (!sessionId) return;

        // Fetch session and join the mentor's profile info
        const { data, error } = await supabase
          .from('sessions')
          .select(`
            *,
            mentor:profiles!sessions_mentor_id_fkey(id, full_name, avatar_seed, avatar_url, trust_score, role)
          `)
          .eq('id', sessionId)
          .single();

        if (error) throw error;
        setSessionData(data);
      } catch (err) {
        console.error("Error fetching session:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFullSessionDetails();
  }, [sessionId]);

  // 2. HANDLE RATING & SYSTEM MESSAGE
  const handleRateSession = async (rating) => {
    setUserRating(rating);
    try {
      // Update session status to completed and save rating
      await supabase
        .from('sessions')
        .update({ 
          rating: rating, 
          status: 'Completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', sessionId);

      // 👈 AUTOMATED SYSTEM MESSAGE
      await supabase.from('messages').insert([{
        sender_id: sessionData.student_id,
        receiver_id: sessionData.mentor_id,
        content: `⭐ RATING RECEIVED: ${sessionData.mentor.full_name} was rated ${rating} stars for "${sessionData.skill_topic}"!`,
        type: 'system'
      }]);

      setShowRatingModal(false);
      alert("Thanks for the feedback! Credits have been released to the mentor.");
      navigate('/dashboard');
    } catch (err) {
      alert("Rating failed: " + err.message);
    }
  };

  if (loading) return <div className="p-20 text-center font-bold">Synchronizing Session Data...</div>;
  if (!sessionData) return <div className="p-20 text-center">Session not found.</div>;

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col text-[#1E293B] font-sans">
      <Navbar />
      
      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full animate-fade-in">
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-gray-400 hover:text-gray-600 mb-8 flex items-center transition-colors">
          <i className="fa-solid fa-arrow-left mr-2"></i> Go Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: SESSION INFO */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-6">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${sessionData.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-[#F0F5FF] text-[#2563EB]'}`}>
                  {sessionData.status} Session
                </span>
                <span className="text-gray-400 text-sm font-bold flex items-center gap-2">
                  <i className="fa-regular fa-calendar"></i> {new Date(sessionData.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-extrabold text-[#1E293B] mb-12 tracking-tight">{sessionData.skill_topic}</h1>
              
              <div className="flex justify-between text-sm font-bold mb-3">
                <span className="text-[#1E293B]">Mastery Track</span>
                <span className="text-[#2563EB]">{sessionData.status === 'Completed' ? '100%' : '40%'} Complete</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div className="bg-[#2563EB] h-full rounded-full transition-all duration-1000" style={{ width: sessionData.status === 'Completed' ? '100%' : '40%' }}></div>
              </div>
            </div>

            <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-sm border border-gray-100">
              <h2 className="text-xl font-extrabold mb-8 text-[#1E293B]">Session Agenda</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-5 p-6 rounded-2xl border border-gray-50 bg-[#F8FAFC]">
                  <i className="fa-solid fa-check-double text-[#48CFCB] text-2xl"></i>
                  <div>
                    <h3 className="font-bold text-[#1E293B] text-base mb-1">Verify Knowledge</h3>
                    <p className="text-sm text-gray-500 m-0">Quick quiz to assess current understanding of {sessionData.skill_topic}.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5 p-6 rounded-2xl border border-gray-50 bg-[#F8FAFC]">
                  <i className="fa-solid fa-code text-[#48CFCB] text-2xl"></i>
                  <div>
                    <h3 className="font-bold text-[#1E293B] text-base mb-1">Live Implementation</h3>
                    <p className="text-sm text-gray-500 m-0">Build a mini-feature using the concepts learned.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: MENTOR & ACTION */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div 
                className="w-32 h-32 bg-[#E6F8F7] rounded-full flex items-center justify-center mb-6 overflow-hidden cursor-pointer"
                onClick={() => navigate(`/profile/${sessionData.mentor.id}`)}
              >
                <img src={sessionData.mentor.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sessionData.mentor.avatar_seed}`} alt="" className="w-28 h-28 mt-4" />
              </div>
              
              <h2 className="text-2xl font-extrabold text-[#1E293B] m-0">{sessionData.mentor.full_name}</h2>
              <p className="text-sm text-gray-400 font-bold mt-1 mb-8">{sessionData.mentor.role}</p>

              <div className="flex justify-center gap-12 w-full border-t border-gray-100 pt-8 mb-8">
                <div>
                  <div className="font-extrabold text-2xl text-[#1E293B] flex items-center justify-center gap-1.5">
                    {sessionData.mentor.trust_score / 20} <i className="fa-solid fa-star text-[#FBBF24] text-base mb-0.5"></i>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Trust Score</div>
                </div>
                <div>
                  <div className="font-extrabold text-2xl text-[#EF4444]">- {sessionData.kc_cost} KC</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Cost</div>
                </div>
              </div>

              <button 
                onClick={() => navigate('/messages')} 
                className="w-full py-4 rounded-2xl border-2 border-gray-100 text-gray-500 font-bold hover:bg-gray-50 hover:text-[#1E293B] transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-regular fa-message text-lg"></i> Message Mentor
              </button>
            </div>

            <div className="bg-[#1E293B] rounded-[24px] p-8 shadow-md flex flex-col items-center justify-center text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-4">Access Link</p>
              
              {sessionData.status === 'Completed' ? (
                <div className="text-white font-bold">This session has ended.</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-8">
                    <span className="w-3 h-3 rounded-full bg-[#48CFCB] shadow-[0_0_12px_#48CFCB] animate-pulse"></span>
                    <span className="text-white font-bold">Room is Active</span>
                  </div>
                  <button
                    onClick={() => navigate(`/live-session?id=${sessionData.id}`)}
                    className="w-full bg-[#48CFCB] hover:bg-[#3bb5b1] text-white font-extrabold py-4 rounded-2xl transition-all shadow-lg mb-4"
                  >
                    Join Video Call
                  </button>
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="text-[#48CFCB] text-xs font-bold uppercase tracking-widest hover:underline"
                  >
                    Complete & Rate Session
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* RATING MODAL */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1E293B]/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h3 className="font-black text-2xl mb-2">Finish Session?</h3>
            <p className="text-gray-500 text-sm mb-8">Rate your experience with {sessionData.mentor.full_name}.</p>
            
            <div className="flex justify-center gap-3 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <i 
                  key={star}
                  onClick={() => handleRateSession(star)}
                  className={`fa-solid fa-star text-3xl cursor-pointer transition-transform hover:scale-125 ${userRating >= star || star <= 4 ? 'text-[#FBBF24]' : 'text-gray-200'}`}
                ></i>
              ))}
            </div>
            
            <button onClick={() => setShowRatingModal(false)} className="text-gray-400 font-bold text-sm">Not finished yet</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionDetail;