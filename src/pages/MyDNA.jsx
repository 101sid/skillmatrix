import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; // 👈 IMPORT SUPABASE

const MyDNA = () => {
  const navigate = useNavigate();

  // --- REACT STATES ---
  const [learningStyle, setLearningStyle] = useState('visual');
  const [isLoading, setIsLoading] = useState(true);
  
  // Input fields state
  const [supplyInput, setSupplyInput] = useState('');
  const [demandInput, setDemandInput] = useState('');

  // 👈 NEW: Start with empty arrays, we will fill these from the database
  const [supplySkills, setSupplySkills] = useState([]);
  const [demandSkills, setDemandSkills] = useState([]);

  // 👈 NEW: Fetch real skills on page load
  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // If not logged in, do nothing

      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Split the database results into Supply and Demand arrays
      if (data) {
        setSupplySkills(data.filter(skill => skill.proficiency_level === 'Supply'));
        setDemandSkills(data.filter(skill => skill.proficiency_level === 'Demand'));
      }
    } catch (error) {
      console.error("Error fetching skills:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- HANDLER FUNCTIONS ---

  // 👈 NEW: Save Supply Skill to Database
  const handleAddSupply = async () => {
    if (supplyInput.trim() !== '') {
      const { data: { session } } = await supabase.auth.getSession();
      
      await supabase.from('skills').insert([
        { 
          user_id: session.user.id, 
          skill_name: supplyInput.trim(), 
          proficiency_level: 'Supply' 
        }
      ]);
      
      setSupplyInput('');
      fetchSkills(); // Refresh the lists from the DB
    }
  };

  // 👈 NEW: Save Demand Skill to Database
  const handleAddDemand = async () => {
    if (demandInput.trim() !== '') {
      const { data: { session } } = await supabase.auth.getSession();
      
      await supabase.from('skills').insert([
        { 
          user_id: session.user.id, 
          skill_name: demandInput.trim(), 
          proficiency_level: 'Demand' 
        }
      ]);
      
      setDemandInput('');
      fetchSkills(); // Refresh the lists from the DB
    }
  };

  // 👈 NEW: Delete a skill from the database (Works for both Supply and Demand)
  const handleRemoveSkill = async (idToRemove) => {
    await supabase.from('skills').delete().eq('id', idToRemove);
    fetchSkills(); // Refresh the lists from the DB
  };

  // Allow pressing "Enter" to submit
  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') action();
  };

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar />

      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        
        {/* HEADER BANNER */}
        <div className="bg-gradient-to-br from-brand-navy to-gray-700 rounded-3xl p-10 text-white mb-10 relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-extrabold uppercase tracking-widest text-gray-300">Profile Architecture</span>
            <h2 className="text-3xl md:text-4xl font-extrabold mt-2 mb-4">Your Skills DNA</h2>
            <p className="text-gray-300 text-sm md:text-base m-0 leading-relaxed">
              This data feeds our intelligent matchmaking engine. The more accurate your Supply and Demand, the better your peer connections will be.
            </p>
          </div>
          <i className="fa-solid fa-dna absolute -right-10 -bottom-10 text-[180px] opacity-5 -rotate-12"></i>
        </div>

        {/* LEARNING STYLE SELECTION */}
        <div className="mb-10">
          <h4 className="font-extrabold text-xl mb-6">Preferred Learning Style</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Style Card 1 */}
            <div 
              onClick={() => setLearningStyle('visual')}
              className={`p-6 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                learningStyle === 'visual' 
                  ? 'border-brand-teal bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <i className={`fa-solid fa-desktop text-3xl mb-4 ${learningStyle === 'visual' ? 'text-brand-teal' : 'text-gray-400'}`}></i>
              <h5 className={`font-bold text-sm m-0 ${learningStyle === 'visual' ? 'text-brand-darkTeal' : 'text-brand-navy'}`}>Visual / Shared Screen</h5>
            </div>

            {/* Style Card 2 */}
            <div 
              onClick={() => setLearningStyle('conversational')}
              className={`p-6 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                learningStyle === 'conversational' 
                  ? 'border-brand-teal bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <i className={`fa-solid fa-comments text-3xl mb-4 ${learningStyle === 'conversational' ? 'text-brand-teal' : 'text-gray-400'}`}></i>
              <h5 className={`font-bold text-sm m-0 ${learningStyle === 'conversational' ? 'text-brand-darkTeal' : 'text-brand-navy'}`}>Conversational / Theory</h5>
            </div>

            {/* Style Card 3 */}
            <div 
              onClick={() => setLearningStyle('hands-on')}
              className={`p-6 rounded-2xl border-2 text-center cursor-pointer transition-all ${
                learningStyle === 'hands-on' 
                  ? 'border-brand-teal bg-teal-50' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <i className={`fa-solid fa-code text-3xl mb-4 ${learningStyle === 'hands-on' ? 'text-brand-teal' : 'text-gray-400'}`}></i>
              <h5 className={`font-bold text-sm m-0 ${learningStyle === 'hands-on' ? 'text-brand-darkTeal' : 'text-brand-navy'}`}>Hands-on / Code Review</h5>
            </div>

          </div>
        </div>

        {/* SUPPLY & DEMAND PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SUPPLY (I Can Teach) */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full">
            <h3 className="text-brand-darkTeal font-extrabold text-xl mb-2 flex items-center">
              <i className="fa-solid fa-arrow-up-right-dots mr-3 text-2xl"></i> Supply (I Can Teach)
            </h3>
            <p className="text-sm text-gray-500 mb-6">Skills you are confident in and willing to mentor others on for Knowledge Credits.</p>
            
            {/* Supply Tags Container */}
            <div className="flex flex-wrap gap-3 mb-8 min-h-[50px]">
              {isLoading ? (
                <i className="fa-solid fa-spinner fa-spin text-gray-400"></i>
              ) : supplySkills.map(skill => (
                <div 
                  key={skill.id} 
                  className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-teal-50 text-brand-darkTeal border border-teal-200 animate-fade-in group"
                >
                  {skill.skill_name}
                  <i className="fa-solid fa-circle-check text-green-500 ml-2 text-base" title="Peer Verified"></i>
                  {/* 👈 Added an invisible delete button that appears on hover so you can remove mistakes! */}
                  <button 
                    onClick={() => handleRemoveSkill(skill.id)}
                    className="ml-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                  >
                    <i className="fa-solid fa-xmark text-[10px]"></i>
                  </button>
                </div>
              ))}
              {!isLoading && supplySkills.length === 0 && (
                <span className="text-sm text-gray-400 italic flex items-center">No supply added yet.</span>
              )}
            </div>

            {/* Supply Input */}
            <div className="mt-auto">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={supplyInput}
                  onChange={(e) => setSupplyInput(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleAddSupply)}
                  placeholder="e.g., Python, Figma, Marketing..." 
                  className="flex-grow border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-teal bg-gray-50 focus:bg-white transition-colors"
                />
                <button 
                  onClick={handleAddSupply}
                  className="bg-brand-teal hover:bg-brand-darkTeal text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
                >
                  Add Skill
                </button>
              </div>
              <div className="text-right mt-4">
                <a href="#" className="text-xs font-bold text-gray-400 hover:text-brand-teal transition-colors underline decoration-2 underline-offset-4">
                  <i className="fa-solid fa-shield-halved mr-1"></i> Request Peer Verification
                </a>
              </div>
            </div>
          </div>

          {/* DEMAND (I Want to Learn) */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full">
            <h3 className="text-brand-blue font-extrabold text-xl mb-2 flex items-center">
              <i className="fa-solid fa-magnifying-glass-chart mr-3 text-2xl"></i> Demand (I Want to Learn)
            </h3>
            <p className="text-sm text-gray-500 mb-6">Competencies you want to acquire. We will find highly-rated mentors for these.</p>
            
            {/* Demand Tags Container */}
            <div className="flex flex-wrap gap-3 mb-8 min-h-[50px]">
              {isLoading ? (
                <i className="fa-solid fa-spinner fa-spin text-gray-400"></i>
              ) : demandSkills.map(skill => (
                <div 
                  key={skill.id} 
                  className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-blue-50 text-brand-blue border border-blue-200 animate-fade-in"
                >
                  {skill.skill_name}
                  <button 
                    onClick={() => handleRemoveSkill(skill.id)}
                    className="ml-2 text-red-400 hover:text-red-600 focus:outline-none transition-colors"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              ))}
              {!isLoading && demandSkills.length === 0 && (
                <span className="text-sm text-gray-400 italic flex items-center">No skills requested yet.</span>
              )}
            </div>

            {/* Demand Input & Save */}
            <div className="mt-auto">
              <div className="flex gap-3 mb-6">
                <input 
                  type="text" 
                  value={demandInput}
                  onChange={(e) => setDemandInput(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleAddDemand)}
                  placeholder="What do you want to learn next?" 
                  className="flex-grow border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue bg-gray-50 focus:bg-white transition-colors"
                />
                <button 
                  onClick={handleAddDemand}
                  className="bg-brand-blue hover:bg-[#2B6CB0] text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
                >
                  Add Goal
                </button>
              </div>
              
              <div className="bg-gray-50 p-5 rounded-2xl flex items-center justify-between border border-gray-100">
                <div>
                  <h5 className="text-sm font-extrabold text-brand-navy m-0">Ready to map?</h5>
                  <span className="text-xs text-gray-500">Auto-saving to cloud network.</span>
                </div>
                {/* 👈 Since we auto-save, the Save button is just a nice way to navigate back to the Dashboard */}
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="bg-brand-navy hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-xl text-xs transition-colors shadow-md"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

    </div>
  );
};

export default MyDNA;