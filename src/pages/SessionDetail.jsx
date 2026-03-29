import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';

const SessionDetail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Dynamic Peer Data passed from the Dashboard/Marketplace
  const peer = searchParams.get('peer') || 'Sarah Jenkins';
  const skill = searchParams.get('skill') || 'Python Data Science';
  const seed = searchParams.get('seed') || 'Sarah';

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col text-[#1E293B] font-sans">
      <Navbar />
      
      {/* UPDATED: Exact same padding, max-width, and margin as Dashboard and Profile */}
      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full animate-fade-in">
        
        {/* Go Back Button */}
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-gray-400 hover:text-gray-600 mb-8 flex items-center transition-colors">
          <i className="fa-solid fa-arrow-left mr-2"></i> Go Back
        </button>

        {/* Main Grid: Updated to 12-column system to match the rest of the app */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN (Wider - 8/12) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Top Card: Course Info */}
            <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-6">
                <span className="bg-[#F0F5FF] text-[#2563EB] text-xs font-bold px-3 py-1.5 rounded-lg">Learning Path</span>
                <span className="text-gray-400 text-sm font-bold flex items-center gap-2">
                  <i className="fa-regular fa-calendar"></i> Today, 2:00 PM
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-extrabold text-[#1E293B] mb-12 tracking-tight">{skill}</h1>
              
              <div className="flex justify-between text-sm font-bold mb-3">
                <span className="text-[#1E293B]">Course Progress</span>
                <span className="text-[#2563EB]">Session 2 of 5</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div className="bg-[#2563EB] h-full rounded-full transition-all duration-1000" style={{ width: '40%' }}></div>
              </div>
            </div>

            {/* Bottom Card: Agenda */}
            <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-sm border border-gray-100">
              <h2 className="text-xl font-extrabold mb-8 text-[#1E293B]">Today's Agenda</h2>
              <div className="space-y-4">
                
                {/* Agenda Item 1 */}
                <div className="flex items-start gap-5 p-6 rounded-2xl border border-gray-50 bg-[#F8FAFC] transition-colors hover:bg-white hover:shadow-sm">
                  <i className="fa-regular fa-file-lines text-[#48CFCB] text-2xl mt-0.5"></i>
                  <div>
                    <h3 className="font-bold text-[#1E293B] text-base mb-1">Review Assignment</h3>
                    <p className="text-sm text-gray-500 font-medium m-0">Go over the code from last session.</p>
                  </div>
                </div>
                
                {/* Agenda Item 2 */}
                <div className="flex items-start gap-5 p-6 rounded-2xl border border-gray-50 bg-[#F8FAFC] transition-colors hover:bg-white hover:shadow-sm">
                  <i className="fa-solid fa-person-chalkboard text-[#48CFCB] text-2xl mt-0.5"></i>
                  <div>
                    <h3 className="font-bold text-[#1E293B] text-base mb-1">Core Concept Deep Dive</h3>
                    <p className="text-sm text-gray-500 font-medium m-0">Live pair-programming demonstration.</p>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (Narrower - 4/12) */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            
            {/* Top Card: Mentor Profile */}
            <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="w-32 h-32 bg-[#E6F8F7] rounded-full flex items-center justify-center mb-6 overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt={peer} className="w-28 h-28 mt-4" />
              </div>
              
              <h2 className="text-2xl font-extrabold text-[#1E293B] m-0">{peer}</h2>
              <p className="text-sm text-gray-400 font-bold mt-1 mb-8">Verified Mentor</p>

              <div className="flex justify-center gap-12 w-full border-t border-gray-100 pt-8 mb-8">
                <div>
                  <div className="font-extrabold text-2xl text-[#1E293B] flex items-center justify-center gap-1.5">
                    4.9 <i className="fa-solid fa-star text-[#FBBF24] text-base mb-0.5"></i>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Rating</div>
                </div>
                <div>
                  <div className="font-extrabold text-2xl text-[#EF4444]">- 40 KC</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Cost</div>
                </div>
              </div>

              <button className="w-full py-4 rounded-2xl border-2 border-gray-100 text-gray-500 font-bold hover:bg-gray-50 hover:text-[#1E293B] transition-colors flex items-center justify-center gap-2">
                <i className="fa-regular fa-message text-lg"></i> Message
              </button>
            </div>

            {/* Bottom Card: Status & Join Button */}
            <div className="bg-[#1E293B] rounded-[24px] p-8 md:p-10 shadow-md flex flex-col items-center justify-center text-center relative overflow-hidden flex-grow min-h-[220px]">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-4 relative z-10">Session Status</p>
              
              <div className="flex items-center gap-2 mb-8 relative z-10">
                <span className="w-3 h-3 rounded-full bg-[#48CFCB] shadow-[0_0_12px_#48CFCB] animate-pulse"></span>
                <span className="text-white font-bold tracking-wide">Room is open</span>
              </div>
              
              {/* CONNECTED BUTTON: Routes to Live Session with peer data */}
              <button
                onClick={() => navigate(`/live-session?peer=${encodeURIComponent(peer)}&skill=${encodeURIComponent(skill)}&seed=${seed}`)}
                className="w-full bg-[#48CFCB] hover:bg-[#3bb5b1] text-white font-extrabold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 relative z-10 text-base shadow-lg shadow-[#48CFCB]/20"
              >
                <i className="fa-solid fa-video text-lg"></i> Join Live Session
              </button>
            </div>

          </div>
          
        </div>
      </main>
    </div>
  );
};

export default SessionDetail;