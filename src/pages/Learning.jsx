import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; // 👈 IMPORT SUPABASE

const Learning = () => {
  const navigate = useNavigate();
  
  // React States for Backend Data
  const [investedKC, setInvestedKC] = useState(0);
  const [activeGoals, setActiveGoals] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [recommendedMentors, setRecommendedMentors] = useState([]);
  const [demandCount, setDemandCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLearningData();
  }, []);

  const fetchLearningData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const userId = session.user.id;

      // 1. Fetch User's Demand Skills (Active Goals)
      const { data: demandSkills } = await supabase
        .from('skills')
        .select('*')
        .eq('user_id', userId)
        .eq('proficiency_level', 'Demand');

      setDemandCount(demandSkills?.length || 0);

      // 2. Fetch all sessions where the user is the STUDENT
      const { data: studentSessions } = await supabase
        .from('sessions')
        .select('*, mentor:profiles!sessions_mentor_id_fkey(full_name, avatar_seed, trust_score)')
        .eq('student_id', userId)
        .order('scheduled_time', { ascending: true });

      if (studentSessions) {
        const currentMonth = new Date().getMonth();
        let spent = 0;
        const upcoming = [];
        const completedSessionsBySkill = {};

        studentSessions.forEach(s => {
          // Calculate Invested KC this month
          if (s.status === 'Completed' && new Date(s.created_at).getMonth() === currentMonth) {
            spent += s.kc_cost;
          }

          // Separate upcoming schedule
          if (s.status === 'Pending' || s.status === 'Active') {
            upcoming.push(s);
          }

          // Count completed sessions per skill to track goal progress
          if (s.status === 'Completed') {
            completedSessionsBySkill[s.skill_topic] = (completedSessionsBySkill[s.skill_topic] || 0) + 1;
          }
        });

        setInvestedKC(spent);
        setSchedule(upcoming.slice(0, 3)); // Show top 3 upcoming

        // Format Active Goals (Assume target is 3 sessions per skill to 'level up')
        const colors = ['bg-brand-blue', 'bg-brand-teal', 'bg-[#F6C90E]', 'bg-[#667EEA]'];
        if (demandSkills) {
          const goals = demandSkills.map((skill, index) => {
            const progress = completedSessionsBySkill[skill.skill_name] || 0;
            const total = 3; // MVP Target
            const percent = Math.min((progress / total) * 100, 100);
            
            return {
              id: skill.id,
              name: skill.skill_name,
              progress,
              total,
              color: colors[index % colors.length],
              percent: `${percent}%`
            };
          });
          setActiveGoals(goals);
        }
      }

      // 3. Matchmaking: Find Recommended Mentors based on Demand Skills
      if (demandSkills && demandSkills.length > 0) {
        const demandNames = demandSkills.map(s => s.skill_name);
        
        // Find users supplying those skills
        const { data: mentorsData } = await supabase
          .from('skills')
          .select('skill_name, user_id, profiles!inner(full_name, avatar_seed, trust_score)')
          .eq('proficiency_level', 'Supply')
          .neq('user_id', userId)
          .in('skill_name', demandNames)
          .limit(4);

        if (mentorsData) {
          // Deduplicate mentors (if one mentor offers multiple matching skills)
          const uniqueMentors = [];
          const seenUserIds = new Set();
          
          mentorsData.forEach(m => {
            if (!seenUserIds.has(m.user_id)) {
              seenUserIds.add(m.user_id);
              uniqueMentors.push({
                id: m.user_id,
                name: m.profiles.full_name,
                match: m.skill_name,
                seed: m.profiles.avatar_seed || 'User',
              });
            }
          });
          
          setRecommendedMentors(uniqueMentors);
        }
      }

    } catch (error) {
      console.error("Error fetching learning data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center text-brand-navy">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal mb-4"></i>
        <h2 className="font-bold tracking-widest uppercase text-sm text-gray-500">Loading Learning Hub...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar />

      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        
        {/* BANNER */}
        <div className="bg-gradient-to-br from-brand-blue to-[#667EEA] rounded-3xl p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-10 shadow-sm relative overflow-hidden">
          <div className="relative z-10 text-white mb-6 md:mb-0">
            <h2 className="font-extrabold text-3xl md:text-4xl mb-2">Learning Journey</h2>
            <p className="opacity-90 text-base m-0">You are currently tracking <strong>{demandCount}</strong> in-demand skills.</p>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-white/20 px-6 py-4 rounded-2xl border border-white/10">
              <h3 className="text-white m-0 text-3xl font-extrabold leading-tight">-{investedKC} KC</h3>
              <span className="text-white text-[11px] font-bold uppercase tracking-wide">Invested this month</span>
            </div>
            <Link to="/marketplace" className="bg-white text-brand-blue hover:bg-gray-50 font-extrabold py-3 px-6 rounded-xl transition-colors shadow-sm">
              Find Mentors
            </Link>
          </div>
          {/* Decorative Background Element */}
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full z-0 blur-2xl"></div>
        </div>

        {/* 3-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMN 1: ACTIVE GOALS */}
          <div className="flex flex-col">
            <h4 className="font-extrabold text-lg mb-5">Active Goals</h4>
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex-grow">
              
              {activeGoals.length === 0 ? (
                <div className="text-center py-6">
                  <i className="fa-solid fa-map-location-dot text-4xl text-gray-300 mb-3"></i>
                  <p className="text-gray-500 text-sm font-semibold mb-3">No learning goals mapped yet.</p>
                  <button onClick={() => navigate('/mydna')} className="text-xs font-bold text-brand-blue hover:underline">Add Demand Skills</button>
                </div>
              ) : (
                activeGoals.map((goal) => (
                  <div key={goal.id} className="mb-6 last:mb-0 animate-fade-in">
                    <div className="flex justify-between items-end mb-2">
                      <span className="font-bold text-sm text-brand-navy">{goal.name}</span>
                      <span className="text-xs font-bold text-gray-500">{goal.progress}/{goal.total} Sessions</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner">
                      <div className={`${goal.color} h-2.5 rounded-full transition-all duration-1000`} style={{ width: goal.percent }}></div>
                    </div>
                    <div className="text-right">
                      <span 
                        onClick={() => navigate('/marketplace')} 
                        className="text-[11px] font-bold text-gray-400 hover:text-brand-blue cursor-pointer transition-colors"
                      >
                        Book next session &rarr;
                      </span>
                    </div>
                  </div>
                ))
              )}

            </div>
          </div>

          {/* COLUMN 2: ATTENDING SCHEDULE */}
          <div className="flex flex-col">
            <h4 className="font-extrabold text-lg mb-5">Attending Schedule</h4>
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex-grow">
              
              {schedule.length === 0 ? (
                 <div className="text-center py-6 text-gray-400">
                    <i className="fa-regular fa-calendar-xmark text-3xl mb-3 opacity-50"></i>
                    <p className="text-sm font-medium">No upcoming sessions.</p>
                    <button onClick={() => navigate('/marketplace')} className="mt-2 text-xs font-bold text-brand-blue hover:underline">Find a class</button>
                 </div>
              ) : (
                schedule.map(session => {
                  const dateObj = new Date(session.scheduled_time || session.created_at);
                  const day = dateObj.getDate();
                  const month = dateObj.toLocaleString('default', { month: 'short' });
                  const isPending = session.status === 'Pending';
                  
                  return (
                    <div 
                      key={session.id}
                      onClick={() => navigate(isPending ? '#' : `/live-session?room=${session.id}`)}
                      className={`flex items-center mb-4 pl-4 border-l-4 border-[#667EEA] ${isPending ? 'opacity-70 cursor-default' : 'cursor-pointer hover:translate-x-1'} transition-transform group`}
                    >
                      <div className="bg-blue-50 rounded-xl p-2 text-center w-16 mr-4 flex-shrink-0">
                        <h4 className="font-extrabold text-lg m-0 leading-tight text-brand-blue">{day}</h4>
                        <span className="text-brand-blue text-[10px] font-bold uppercase">{month}</span>
                      </div>
                      <div className="flex-grow overflow-hidden">
                        <h5 className="font-bold text-sm m-0 truncate flex items-center gap-2">
                          {session.skill_topic}
                          {isPending && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 rounded uppercase tracking-wide">Pending</span>}
                        </h5>
                        <p className="text-xs text-gray-500 m-0 mt-1 truncate">
                          <i className="fa-solid fa-chalkboard-user mr-1"></i> Mentor: {session.mentor?.full_name?.split(' ')[0]}
                        </p>
                      </div>
                      {!isPending && <i className="fa-solid fa-chevron-right text-gray-300 group-hover:text-brand-blue transition-colors"></i>}
                    </div>
                  );
                })
              )}

            </div>
          </div>

          {/* COLUMN 3: RECOMMENDED MENTORS */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-5">
              <h4 className="font-extrabold text-lg m-0">Recommended Mentors</h4>
              <span className="bg-[#F6C90E] text-white text-[10px] font-extrabold px-2 py-1 rounded-md uppercase tracking-wide shadow-sm">AI Picks</span>
            </div>
            
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex-grow">
              
              {recommendedMentors.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <i className="fa-solid fa-robot text-3xl mb-3 opacity-50"></i>
                  <p className="text-sm font-medium px-4">Add skills to your "Demand" DNA to trigger AI matchmaking!</p>
                </div>
              ) : (
                recommendedMentors.map((mentor) => (
                  <div key={mentor.id} className="flex items-center justify-between mb-5 last:mb-0 group animate-fade-in">
                    <div className="flex items-center cursor-pointer" onClick={() => navigate(`/profile?peer=${encodeURIComponent(mentor.name)}`)}>
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.seed}`} 
                        className="w-12 h-12 border border-gray-200 bg-gray-50 rounded-full mr-3 group-hover:border-brand-blue transition-colors" 
                        alt={mentor.name} 
                      />
                      <div>
                        <h4 className="font-bold text-sm m-0 group-hover:text-brand-blue transition-colors truncate w-24">{mentor.name}</h4>
                        <p className="text-[11px] text-gray-500 font-semibold m-0 mt-0.5 truncate w-24">Match: {mentor.match}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/marketplace')}
                      className="bg-gray-100 hover:bg-brand-blue hover:text-white text-gray-600 font-bold py-1.5 px-4 rounded-lg text-xs transition-colors flex-shrink-0"
                    >
                      Book
                    </button>
                  </div>
                ))
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Learning;