import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; // 👈 IMPORT SUPABASE

const Teaching = () => {
  const navigate = useNavigate();
  
  // React States
  const [totalEarned, setTotalEarned] = useState(0);
  const [supplyCount, setSupplyCount] = useState(0);
  const [requests, setRequests] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 👈 NEW: Fetch data on load
  useEffect(() => {
    fetchTeachingData();
  }, []);

  const fetchTeachingData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const userId = session.user.id;

      // 1. Fetch count of supply skills
      const { count: skillCount } = await supabase
        .from('skills')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('proficiency_level', 'Supply');
      
      setSupplyCount(skillCount || 0);

      // 2. Fetch total KC earned this month (Completed mentoring sessions)
      const currentMonth = new Date().getMonth();
      const { data: completedData } = await supabase
        .from('sessions')
        .select('kc_cost, created_at')
        .eq('mentor_id', userId)
        .eq('status', 'Completed');

      if (completedData) {
        const monthlyEarnings = completedData.reduce((sum, s) => {
          if (new Date(s.created_at).getMonth() === currentMonth) {
            return sum + s.kc_cost;
          }
          return sum;
        }, 0);
        setTotalEarned(monthlyEarnings);
      }

      // 3. Fetch Pending Requests
      const { data: pendingData } = await supabase
        .from('sessions')
        .select('id, skill_topic, kc_cost, status, student:profiles!sessions_student_id_fkey(full_name, avatar_seed)')
        .eq('mentor_id', userId)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (pendingData) {
        setRequests(pendingData.map(req => ({
          id: req.id,
          name: req.student.full_name,
          skill: req.skill_topic,
          kc: req.kc_cost,
          seed: req.student.avatar_seed || 'User',
          status: req.status.toLowerCase()
        })));
      }

      // 4. Fetch Hosting Schedule (Active or Pending)
      const { data: scheduleData } = await supabase
        .from('sessions')
        .select('id, skill_topic, scheduled_time, status, student:profiles!sessions_student_id_fkey(full_name, avatar_seed)')
        .eq('mentor_id', userId)
        .in('status', ['Active', 'Pending'])
        .order('scheduled_time', { ascending: true })
        .limit(3);

      if (scheduleData) {
        setSchedule(scheduleData);
      }

    } catch (error) {
      console.error("Error fetching teaching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 👈 NEW: Database Handlers for Accept/Decline
  const handleAccept = async (id, kcAmount) => {
    // 1. Visually update instantly
    setRequests(currentRequests => 
      currentRequests.map(req => 
        req.id === id ? { ...req, status: 'accepted' } : req
      )
    );
    
    try {
      // 2. Update Database to 'Active'
      await supabase
        .from('sessions')
        .update({ status: 'Active' })
        .eq('id', id);

      // Refresh schedule to show the accepted session
      fetchTeachingData();
    } catch (err) {
      console.error("Failed to accept", err);
    }

    // 3. Remove the card after animation
    setTimeout(() => {
      setRequests(currentRequests => currentRequests.filter(req => req.id !== id));
    }, 1500);
  };

  const handleDecline = async (id) => {
    // 1. Visually update instantly
    setRequests(currentRequests => 
      currentRequests.map(req => 
        req.id === id ? { ...req, status: 'declined' } : req
      )
    );

    try {
      // 2. Update Database to 'Declined'
      await supabase
        .from('sessions')
        .update({ status: 'Cancelled' }) // We use 'Cancelled' for declined MVP
        .eq('id', id);
    } catch (err) {
      console.error("Failed to decline", err);
    }

    // 3. Remove after animation
    setTimeout(() => {
      setRequests(currentRequests => currentRequests.filter(req => req.id !== id));
    }, 1500);
  };

  // Helper for Schedule Dates
  const formatScheduleDate = (dateString) => {
    const d = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center text-brand-navy">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal mb-4"></i>
        <h2 className="font-bold tracking-widest uppercase text-sm text-gray-500">Loading Mentor Hub...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-brand-navy">
      <Navbar />

      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        
        {/* BANNER */}
        <div className="bg-gradient-to-br from-brand-red to-[#FF9A9E] rounded-3xl p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-10 shadow-sm relative overflow-hidden">
          <div className="relative z-10 text-white mb-6 md:mb-0">
            <h2 className="font-extrabold text-3xl md:text-4xl mb-2">Mentor Hub</h2>
            <p className="opacity-90 text-base m-0">You are currently offering <strong>{supplyCount}</strong> skills to the network.</p>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-white/20 px-6 py-4 rounded-2xl border border-white/10">
              <h3 className="text-white m-0 text-3xl font-extrabold leading-tight">+{totalEarned} KC</h3>
              <span className="text-white text-[11px] font-bold uppercase tracking-wide">Earned this month</span>
            </div>
            <Link to="/mydna" className="bg-white text-brand-red hover:bg-gray-50 font-extrabold py-3 px-6 rounded-xl transition-colors shadow-sm">
              + Add Skills
            </Link>
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full z-0 blur-2xl"></div>
        </div>

        {/* 3-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMN 1: PENDING REQUESTS */}
          <div className="flex flex-col">
            <h4 className="font-extrabold text-lg mb-5">Pending Requests</h4>
            
            {requests.length > 0 ? (
              requests.map(req => (
                <div key={req.id} className="bg-white p-5 rounded-2xl border-l-4 border-l-[#F6C90E] shadow-sm border border-gray-100 mb-4 transition-all">
                  <div className="flex items-center mb-4">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${req.seed}`} alt={req.name} className="w-10 h-10 rounded-full mr-4 border border-gray-200 bg-gray-50" />
                    <div>
                      <h5 className="font-bold text-sm m-0">{req.name}</h5>
                      <span className="text-[11px] text-gray-500 font-semibold">Wants to learn: {req.skill}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-brand-teal">{req.kc} KC</span>
                    
                    <div className="flex gap-2">
                      {req.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleAccept(req.id, req.kc)}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-1.5 px-4 rounded-full text-[11px] transition-colors"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => handleDecline(req.id)}
                            className="bg-brand-red hover:bg-red-600 text-white font-bold py-1.5 px-4 rounded-full text-[11px] transition-colors"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {req.status === 'accepted' && (
                        <button disabled className="bg-gray-400 text-white font-bold py-1.5 px-4 rounded-full text-[11px] cursor-default">
                          <i className="fa-solid fa-check mr-1"></i> Accepted
                        </button>
                      )}
                      {req.status === 'declined' && (
                        <button disabled className="bg-gray-400 text-white font-bold py-1.5 px-4 rounded-full text-[11px] cursor-default">
                          Declined
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <i className="fa-regular fa-face-smile-wink text-3xl text-gray-400 mb-3"></i>
                <p className="text-gray-400 text-sm font-semibold m-0">You are all caught up!</p>
              </div>
            )}
          </div>

          {/* COLUMN 2: HOSTING SCHEDULE */}
          <div className="flex flex-col">
            <h4 className="font-extrabold text-lg mb-5">Hosting Schedule</h4>
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex-grow">
              
              {schedule.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No upcoming hosting sessions.</p>
              ) : (
                schedule.map((session, index) => {
                  const dateStr = formatScheduleDate(session.scheduled_time);
                  const timeStr = new Date(session.scheduled_time || session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  // Alternate colors for visual interest
                  const colorClass = index % 2 === 0 ? 'border-brand-teal' : 'border-[#F6C90E]';
                  const bgClass = index % 2 === 0 ? 'bg-teal-50 text-brand-darkTeal' : 'bg-yellow-50 text-[#D69E2E]';
                  const timeClass = index % 2 === 0 ? 'text-brand-teal' : 'text-[#F6C90E]';

                  return (
                    <div 
                      key={session.id}
                      onClick={() => navigate(`/live-session?room=${session.id}`)}
                      className={`flex items-center mb-4 pl-4 border-l-4 ${colorClass} cursor-pointer hover:translate-x-1 transition-transform group`}
                    >
                      <div className={`${bgClass} rounded-xl p-2 text-center w-16 mr-4 flex-shrink-0`}>
                        <h4 className="font-extrabold text-[11px] m-0 leading-tight uppercase tracking-wide truncate">{dateStr}</h4>
                        <span className={`${timeClass} text-[10px] font-bold`}>{timeStr}</span>
                      </div>
                      <div className="flex-grow overflow-hidden">
                        <h5 className="font-bold text-sm m-0 truncate" title={session.skill_topic}>{session.skill_topic}</h5>
                        <p className="text-xs text-gray-500 m-0 mt-1 truncate">
                          <i className="fa-solid fa-video mr-1"></i> Mentoring {session.student?.full_name?.split(' ')[0]}
                        </p>
                      </div>
                      <i className={`fa-solid fa-chevron-right text-gray-300 group-hover:${timeClass} transition-colors`}></i>
                    </div>
                  );
                })
              )}

            </div>
          </div>

          {/* COLUMN 3: RECENT FEEDBACK (STATIC FOR MVP) */}
          <div className="flex flex-col">
            <h4 className="font-extrabold text-lg mb-5">Recent Feedback</h4>
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex-grow">
              
              <div className="border-b border-gray-100 pb-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm">"Great explainer!"</span>
                  <span className="text-[#F6C90E] font-extrabold text-sm"><i className="fa-solid fa-star text-[10px]"></i> 5.0</span>
                </div>
                <p className="text-xs text-gray-500 m-0">- From recent session</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm">"Helped me debug my app."</span>
                  <span className="text-[#F6C90E] font-extrabold text-sm"><i className="fa-solid fa-star text-[10px]"></i> 4.8</span>
                </div>
                <p className="text-xs text-gray-500 m-0">- From recent session</p>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Teaching;