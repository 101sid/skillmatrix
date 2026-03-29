import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; // 👈 IMPORT SUPABASE

const SessionsLog = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  
  // 👈 NEW: Real state for database sessions
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 👈 NEW: Fetch real sessions from the database
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }
      
      const currentUserId = session.user.id;

      // 1. Fetch all sessions where the user is involved
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .or(`mentor_id.eq.${currentUserId},student_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      if (!sessionsData || sessionsData.length === 0) {
        setSessions([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch the profiles of the peers we are meeting with
      const peerIds = [...new Set(sessionsData.map(s => 
        s.mentor_id === currentUserId ? s.student_id : s.mentor_id
      ))];

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_seed')
        .in('id', peerIds);

      const profileMap = {};
      if (profilesData) {
        profilesData.forEach(p => { profileMap[p.id] = p; });
      }

      // 3. Format the data to match your UI perfectly
      const formattedSessions = sessionsData.map(s => {
        const isTeaching = s.mentor_id === currentUserId;
        const peerId = isTeaching ? s.student_id : s.mentor_id;
        const peerInfo = profileMap[peerId] || { full_name: 'Unknown User', avatar_seed: 'User' };
        
        // Format the date string
        const sessionDate = new Date(s.scheduled_time || s.created_at);
        const formattedDate = sessionDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });

        return {
          id: s.id,
          peer: peerInfo.full_name,
          skill: s.skill_topic,
          type: isTeaching ? "Teaching" : "Learning",
          date: formattedDate,
          status: s.status, // e.g., "Pending", "Completed"
          kc: isTeaching ? s.kc_cost : -s.kc_cost, // Positive for teaching, negative for learning
          seed: peerInfo.avatar_seed
        };
      });

      setSessions(formattedSessions);

    } catch (error) {
      console.error("Error fetching sessions:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter based on the selected tab
  const filteredSessions = sessions.filter(s => filter === "All" || s.type === filter);

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar />
      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        
        {/* HEADER & BACK BUTTON */}
        <div className="flex justify-between items-center mb-8 animate-fade-in">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-sm font-bold text-gray-400 hover:text-brand-teal mb-2 flex items-center transition-colors">
              <i className="fa-solid fa-arrow-left mr-2 text-[10px]"></i> Dashboard
            </button>
            <h2 className="text-3xl font-extrabold">Sessions History</h2>
          </div>
          
          {/* FILTER BUTTONS */}
          <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
            {["All", "Teaching", "Learning"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${filter === f ? 'bg-brand-navy text-white shadow-md' : 'text-gray-400 hover:text-brand-navy'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* LOG TABLE */}
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-fade-in min-h-[400px]">
          
          {isLoading ? (
            <div className="flex justify-center items-center h-full py-32">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal"></i>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">
                    <th className="px-8 py-5 font-extrabold">Peer Mentor/Student</th>
                    <th className="py-5 font-extrabold">Skill / Competency</th>
                    <th className="py-5 font-extrabold text-center">Type</th>
                    <th className="py-5 font-extrabold">Date Scheduled</th>
                    <th className="py-5 font-extrabold">Status</th>
                    <th className="pr-8 py-5 font-extrabold text-right">KC Impact</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredSessions.map(session => (
                    // 👈 Added a click event to route to the live room if it's pending
                    <tr 
                      key={session.id} 
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors group cursor-pointer" 
                      onClick={() => navigate(session.status === 'Pending' ? `/live-session?room=${session.id}` : `/profile?peer=${encodeURIComponent(session.peer)}`)}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session.seed}`} className="w-9 h-9 rounded-full mr-3 border border-gray-100 bg-white" alt="" />
                          <span className="font-bold text-brand-navy group-hover:text-brand-teal transition-colors">{session.peer}</span>
                        </div>
                      </td>
                      <td className="py-6 text-gray-600 font-medium">{session.skill}</td>
                      <td className="py-6 text-center">
                        <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${session.type === 'Teaching' ? 'bg-red-50 text-brand-red border border-red-100' : 'bg-blue-50 text-brand-blue border border-blue-100'}`}>
                          {session.type}
                        </span>
                      </td>
                      <td className="py-6 text-gray-400 font-bold text-xs">{session.date}</td>
                      <td className="py-6">
                        <span className={`flex items-center gap-2 font-bold ${session.status === 'Completed' ? 'text-green-500' : session.status === 'Pending' ? 'text-brand-yellow' : session.status === 'Cancelled' ? 'text-red-500' : 'text-gray-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${session.status === 'Completed' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : session.status === 'Pending' ? 'bg-brand-yellow animate-pulse' : session.status === 'Cancelled' ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                          {session.status}
                        </span>
                      </td>
                      <td className={`pr-8 py-6 text-right font-extrabold text-base ${session.kc > 0 ? 'text-green-500' : session.kc < 0 ? 'text-brand-red' : 'text-gray-400'}`}>
                        {session.kc > 0 ? `+${session.kc}` : session.kc} <span className="text-[10px] ml-0.5 text-gray-400">KC</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!isLoading && filteredSessions.length === 0 && (
                <div className="py-20 text-center">
                  <i className="fa-solid fa-folder-open text-gray-200 text-5xl mb-4"></i>
                  <p className="text-gray-400 font-bold">No sessions found for this category.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default SessionsLog;