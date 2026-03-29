import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 
import Navbar from '../components/Navbar';
import LiveClock from '../components/LiveClock';

const Dashboard = () => {
  const navigate = useNavigate();
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);

  // --- DATABASE STATES ---
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);

  // Dashboard specific states
  const [stats, setStats] = useState({ totalSessions: 0, avgRating: '5.0', pendingReqs: 0 });
  const [recentTx, setRecentTx] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [liveMarket, setLiveMarket] = useState([]);
  
  // 👈 NEW: State for the Up Next section
  const [upcomingSessions, setUpcomingSessions] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/');
          return;
        }
        
        const userId = session.user.id;

        // 1. Fetch Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        setProfile(profileData);

        // 2. Fetch User's Supply Skills
        const { data: skillsData } = await supabase
          .from('skills')
          .select('*')
          .eq('user_id', userId)
          .eq('proficiency_level', 'Supply')
          .limit(3);
        setSkills(skillsData || []);

        // 3. Fetch Total Sessions (Count)
        const { count: totalCount } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .or(`mentor_id.eq.${userId},student_id.eq.${userId}`);

        // 4. Fetch Pending Requests (Count)
        const { count: pendingCount } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('mentor_id', userId)
          .eq('status', 'Pending');

        // Calculate dynamic rating
        const calculatedRating = profileData?.trust_score ? (profileData.trust_score / 20).toFixed(1) : '5.0';
        setStats({ totalSessions: totalCount || 0, avgRating: calculatedRating, pendingReqs: pendingCount || 0 });

        // 5. Fetch Recent Transactions (Completed)
        const { data: txData } = await supabase
          .from('sessions')
          .select('*, mentor:profiles!sessions_mentor_id_fkey(full_name), student:profiles!sessions_student_id_fkey(full_name)')
          .eq('status', 'Completed')
          .or(`mentor_id.eq.${userId},student_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(2);
        setRecentTx(txData || []);

        // 6. 👈 NEW: Fetch Upcoming Sessions (Pending)
        const { data: upcomingData } = await supabase
          .from('sessions')
          .select('*, mentor:profiles!sessions_mentor_id_fkey(full_name), student:profiles!sessions_student_id_fkey(full_name)')
          .eq('status', 'Pending')
          .or(`mentor_id.eq.${userId},student_id.eq.${userId}`)
          .order('scheduled_time', { ascending: true }) // Closest dates first
          .limit(2);
        setUpcomingSessions(upcomingData || []);

        // 7. Fetch Top Instructors
        const { data: instructorsData } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', userId)
          .order('trust_score', { ascending: false })
          .limit(3);
        setInstructors(instructorsData || []);

        // 8. Fetch Live Market (Recent activity by OTHERS)
        const { data: marketData } = await supabase
          .from('sessions')
          .select('*, student:profiles!sessions_student_id_fkey(full_name)')
          .neq('student_id', userId)
          .order('created_at', { ascending: false })
          .limit(4);
        setLiveMarket(marketData || []);

      } catch (error) {
        console.error("Error fetching dashboard data:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center text-brand-navy">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal mb-4"></i>
        <h2 className="font-bold tracking-widest uppercase text-sm text-gray-500">Loading Network Data...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar />

      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        
        {/* HEADER AREA */}
        <div className="flex justify-between items-end mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-navy">Welcome back, {profile?.full_name?.split(' ')[0] || 'Explorer'}</h1>
            <p className="text-gray-500 text-sm font-medium">Monitoring your peer-to-peer exchange network.</p>
          </div>
          <LiveClock />
        </div>
        
        {/* ROW 1: BANNER & UP NEXT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-8 bg-brand-teal rounded-[40px] p-10 flex flex-col justify-center relative overflow-hidden min-h-[280px] shadow-sm">
            <div className="relative z-10 text-white">
              <h2 className="font-extrabold text-4xl mb-3 text-white">Expertise is a Liquid Asset.</h2>
              <p className="text-lg opacity-90 mb-8 text-white/90">Trade skills, earn credits, and grow your professional DNA.</p>
              <div className="flex flex-wrap gap-4">
                <button onClick={() => navigate('/wallet')} className="bg-white/20 px-6 py-4 rounded-3xl flex items-center hover:bg-white/30 transition-all border border-white/10">
                  <i className="fa-solid fa-bolt text-brand-yellow text-2xl mr-3"></i>
                  <div>
                    <h3 className="m-0 text-2xl font-bold text-white">{profile?.knowledge_credits || 0}</h3>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Credits</span>
                  </div>
                </button>
                <div className="bg-white/20 px-6 py-4 rounded-3xl flex items-center border border-white/10">
                  <i className="fa-solid fa-shield-halved text-white text-2xl mr-3"></i>
                  <div>
                    <h3 className="m-0 text-2xl font-bold text-white">{profile?.trust_score || 0}%</h3>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Trust Score</span>
                  </div>
                </div>
              </div>
            </div>
            <i className="fa-solid fa-dna absolute -right-10 -bottom-10 text-[200px] opacity-5 -rotate-12"></i>
          </div>

          {/* 👈 UPDATED: DYNAMIC UP NEXT SECTION */}
          <div className="lg:col-span-4 bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm flex flex-col justify-center">
            <h4 className="font-extrabold text-lg mb-6 flex justify-between items-center">
              Up Next 
              <Link to="/sessions-log" className="text-[10px] bg-brand-blue text-white px-2 py-1 rounded-md uppercase tracking-widest hover:bg-[#2B6CB0] transition-colors">
                View All
              </Link>
            </h4>
            
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <i className="fa-regular fa-calendar text-3xl mb-3 opacity-50"></i>
                <p className="text-sm font-medium">No upcoming sessions.</p>
                <button onClick={() => navigate('/marketplace')} className="mt-3 text-xs font-bold text-brand-teal hover:underline">Find a Mentor</button>
              </div>
            ) : (
              upcomingSessions.map((session, index) => {
                // Determine Peer Name
                const isMentor = session.mentor_id === profile?.id;
                const peerNameFull = isMentor ? session.student?.full_name : session.mentor?.full_name;
                const peerNameShort = peerNameFull ? `${peerNameFull.split(' ')[0]} ${peerNameFull.split(' ')[1]?.[0] || ''}.` : 'Peer';
                
                // Format Date
                const dateObj = new Date(session.scheduled_time || session.created_at);
                const day = dateObj.getDate();
                const month = dateObj.toLocaleString('default', { month: 'short' });
                const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                // Cycle colors (Teal for first, Red for second)
                const colorClass = index === 0 ? 'border-brand-teal group-hover:text-brand-teal' : 'border-brand-red group-hover:text-brand-red';

                return (
                  <div 
                    key={session.id}
                    onClick={() => navigate(`/live-session?room=${session.id}`)} 
                    className={`flex items-center mb-6 last:mb-0 pl-4 border-l-4 cursor-pointer hover:translate-x-1 transition-transform group ${colorClass.split(' ')[0]}`}
                  >
                    <div className="bg-gray-50 rounded-2xl p-3 text-center w-16 mr-4 flex-shrink-0">
                      <h4 className="font-extrabold text-xl m-0 text-brand-navy">{day}</h4>
                      <span className="text-gray-400 text-[10px] font-extrabold uppercase">{month}</span>
                    </div>
                    <div className="flex-grow overflow-hidden">
                      <h5 className="font-bold text-sm m-0 truncate w-full" title={session.skill_topic}>{session.skill_topic}</h5>
                      <p className="text-xs text-gray-500 m-0 mt-1 truncate">
                        <i className="fa-regular fa-clock mr-1"></i> {time} • {peerNameShort}
                      </p>
                    </div>
                    <i className={`fa-solid fa-chevron-right text-gray-300 transition-colors ml-2 ${colorClass.split(' ')[1]}`}></i>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ROW 2: INTERACTIVE STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div onClick={() => navigate('/sessions-log')} className="bg-brand-yellow p-7 rounded-[32px] text-white relative h-32 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer group overflow-hidden">
            <h3 className="text-3xl font-extrabold text-white">{stats.totalSessions}</h3><span className="text-xs font-bold uppercase tracking-widest text-white/90">Total Sessions</span>
            <i className="fa-solid fa-video absolute right-4 bottom-4 text-5xl opacity-20 group-hover:opacity-40 transition-opacity"></i>
          </div>
          <div onClick={() => navigate('/profile')} className="bg-brand-red p-7 rounded-[32px] text-white relative h-32 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer group overflow-hidden">
            <h3 className="text-3xl font-extrabold text-white">{stats.avgRating}</h3><span className="text-xs font-bold uppercase tracking-widest text-white/90">Avg Rating</span>
            <i className="fa-solid fa-star absolute right-4 bottom-4 text-5xl opacity-20 group-hover:opacity-40 transition-opacity"></i>
          </div>
          <div onClick={() => navigate('/sessions-log')} className="bg-brand-blue p-7 rounded-[32px] text-white relative h-32 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer group overflow-hidden">
            <h3 className="text-3xl font-extrabold text-white">{stats.pendingReqs}</h3><span className="text-xs font-bold uppercase tracking-widest text-white/90">Pending Requests</span>
            <i className="fa-solid fa-envelope absolute right-4 bottom-4 text-5xl opacity-20 group-hover:opacity-40 transition-opacity"></i>
          </div>
          <div onClick={() => setIsStreakModalOpen(true)} className="bg-gradient-to-br from-[#667EEA] to-[#764BA2] p-7 rounded-[32px] text-white relative h-32 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer group overflow-hidden">
            <h3 className="text-3xl font-extrabold text-white">3 Day</h3><span className="text-xs font-bold uppercase tracking-widest text-white/90">Learning Streak</span>
            <i className="fa-solid fa-fire absolute right-4 bottom-4 text-5xl opacity-20 group-hover:opacity-40 transition-opacity"></i>
          </div>
        </div>

        {/* ROW 3: MIDDLE SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          
          <div className="lg:col-span-4 bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
            <h4 className="font-extrabold text-lg mb-8">How it Works</h4>
            <div className="space-y-6">
              <div onClick={() => navigate('/mydna')} className="flex items-start group cursor-pointer">
                <div className="bg-teal-50 text-brand-teal p-3 rounded-xl mr-4 group-hover:bg-brand-teal group-hover:text-white transition-all"><i className="fa-solid fa-map-location-dot"></i></div>
                <div><h5 className="font-bold text-sm m-0 group-hover:text-brand-teal transition-colors">Map Skills</h5><p className="text-xs text-gray-500 font-medium">List your supply & demand.</p></div>
              </div>
              <div onClick={() => navigate('/marketplace')} className="flex items-start group cursor-pointer">
                <div className="bg-yellow-50 text-brand-yellow p-3 rounded-xl mr-4 group-hover:bg-brand-yellow group-hover:text-white transition-all"><i className="fa-solid fa-people-arrows"></i></div>
                <div><h5 className="font-bold text-sm m-0 group-hover:text-brand-yellow transition-colors">Connect</h5><p className="text-xs text-gray-500 font-medium">Find verified peer mentors.</p></div>
              </div>
              <div onClick={() => navigate('/sessions-log')} className="flex items-start group cursor-pointer">
                <div className="bg-red-50 text-brand-red p-3 rounded-xl mr-4 group-hover:bg-brand-red group-hover:text-white transition-all"><i className="fa-solid fa-bolt"></i></div>
                <div><h5 className="font-bold text-sm m-0 group-hover:text-brand-red transition-colors">Earn Credits</h5><p className="text-xs text-gray-500 font-medium">Teach to earn Knowledge Credits.</p></div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white rounded-[32px] p-8 border-2 border-dashed border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-teal-50 text-brand-teal rounded-full flex items-center justify-center mb-4 text-2xl"><i className="fa-solid fa-chalkboard-user"></i></div>
            <h4 className="font-extrabold text-lg mb-2">Ready to teach?</h4>
            <p className="text-xs text-gray-500 mb-6 px-4 font-medium">Earn credits by sharing your knowledge with the network.</p>
            <button onClick={() => navigate('/sessions-log')} className="w-full bg-brand-navy hover:bg-gray-800 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md active:scale-95">
              Check Pending Requests
            </button>
          </div>

          {/* DYNAMIC BEST INSTRUCTORS */}
          <div className="lg:col-span-4 bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-extrabold text-lg m-0">Top Instructors</h4>
              <Link to="/marketplace" className="text-xs font-bold text-brand-blue hover:underline">See All</Link>
            </div>
            <div className="space-y-5">
              {instructors.length === 0 ? (
                <p className="text-xs text-gray-400">Loading network...</p>
              ) : (
                instructors.map(inst => (
                  <div key={inst.id} onClick={() => navigate(`/profile?peer=${encodeURIComponent(inst.full_name)}`)} className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${inst.avatar_seed || 'User'}`} className="w-10 h-10 rounded-full mr-3 border group-hover:border-brand-teal transition-colors shadow-sm bg-gray-50" alt=""/>
                      <div>
                        <h5 className="font-bold text-sm m-0 group-hover:text-brand-teal transition-colors">{inst.full_name}</h5>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Trust: {inst.trust_score}%</span>
                      </div>
                    </div>
                    <button className="bg-gray-50 group-hover:bg-brand-teal group-hover:text-white text-[10px] font-black px-3 py-1.5 rounded-lg transition-all">VIEW</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ROW 4: BOTTOM SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-extrabold text-lg m-0">Skills DNA</h4>
              <Link to="/mydna" className="text-xs font-bold text-brand-teal hover:underline">Edit DNA</Link>
            </div>
            <div className="space-y-6">
              {skills.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <i className="fa-solid fa-dna mb-2 text-2xl"></i>
                  <p className="text-sm font-medium">No verified skills yet.</p>
                </div>
              ) : (
                skills.map((skill, index) => {
                  const colors = ['bg-brand-teal', 'bg-brand-yellow', 'bg-brand-red'];
                  const textColors = ['text-brand-teal', 'text-brand-yellow', 'text-brand-red'];
                  const colorClass = colors[index % colors.length];
                  const textClass = textColors[index % textColors.length];

                  return (
                    <div key={skill.id} className="animate-fade-in">
                      <div className="flex justify-between text-[11px] font-bold mb-2">
                        <span>{skill.skill_name}</span>
                        <span className={textClass}>Verified</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden shadow-inner">
                        <div className={`${colorClass} h-full transition-all duration-1000`} style={{width: '100%'}}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* DYNAMIC RECENT TRANSACTIONS */}
          <div className="lg:col-span-4 bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h4 className="font-extrabold text-lg m-0">Recent Transactions</h4>
              <Link to="/wallet" className="text-xs font-bold text-brand-blue hover:underline">Wallet</Link>
            </div>
            <div className="space-y-6 flex-grow">
              {recentTx.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No completed sessions yet.</p>
              ) : (
                recentTx.map(tx => {
                  const isMentor = tx.mentor_id === profile?.id;
                  const dateString = new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return (
                    <div key={tx.id} className="flex justify-between items-center pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                      <div>
                        <h5 className="font-bold text-sm m-0 truncate w-40" title={tx.skill_topic}>{isMentor ? 'Mentored:' : 'Learned:'} {tx.skill_topic}</h5>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{dateString}</span>
                      </div>
                      <span className={`font-extrabold text-sm ${isMentor ? 'text-green-500' : 'text-brand-red'}`}>
                        {isMentor ? '+' : '-'}{tx.kc_cost} KC
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* DYNAMIC LIVE MARKET */}
          <div className="lg:col-span-4 bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex flex-col justify-between">
            <h4 className="font-extrabold text-lg mb-6">Live Market</h4>
            <div className="space-y-4 flex-grow">
              {liveMarket.length === 0 ? (
                <p className="text-xs text-gray-400">Waiting for network activity...</p>
              ) : (
                liveMarket.map(market => (
                  <div key={market.id} className="flex items-center text-[10px] text-gray-500 font-bold uppercase tracking-widest animate-fade-in">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse flex-shrink-0"></div>
                    <span className="truncate">{market.student?.full_name?.split(' ')[0] || 'A user'} booked {market.skill_topic}</span>
                  </div>
                ))
              )}
              {liveMarket.length > 0 && (
                <div className="flex items-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse"></div>
                  System: Daily bonus of 10 KC added
                </div>
              )}
            </div>
            <button onClick={() => navigate('/marketplace')} className="mt-10 text-[10px] font-black text-brand-blue hover:text-brand-darkTeal flex items-center gap-1 transition-all tracking-widest uppercase">
              EXPLORE LIVE DEALS <i className="fa-solid fa-arrow-right text-[8px] ml-1"></i>
            </button>
          </div>
          
        </div>
      </main>

      {/* STREAK MODAL (Unchanged) */}
      {isStreakModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[40px] overflow-hidden w-full max-w-md shadow-2xl relative border border-white/20">
            <button onClick={() => setIsStreakModalOpen(false)} className="absolute top-6 right-6 text-white hover:text-gray-200 z-10 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            <div className="bg-gradient-to-br from-[#667EEA] to-[#764BA2] p-12 text-center text-white">
              <i className="fa-solid fa-fire text-6xl text-brand-yellow mb-4 drop-shadow-md"></i>
              <h2 className="font-extrabold text-4xl mb-2">3 Day Streak!</h2>
              <p className="opacity-90 text-sm font-medium">Keep growing your DNA. You're in the top 5% of learners today.</p>
            </div>
            <div className="p-8 text-center">
              <button onClick={() => setIsStreakModalOpen(false)} className="w-full bg-brand-navy text-white font-extrabold py-4 rounded-2xl shadow-xl hover:bg-gray-800 transition-all active:scale-[0.98]">Keep Learning</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;