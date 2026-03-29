import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; // 👈 IMPORT SUPABASE

// FAQ Data array makes it easy to add/remove questions in the future!
const FAQS = [
  { 
    id: 1, 
    question: "How do Knowledge Credits (KC) work?", 
    answer: "Knowledge Credits are the internal currency of SkillMatrix. You earn KC by hosting sessions and teaching your verified skills to others. You can then spend that KC to book sessions with other mentors. If you need KC immediately, you can purchase it securely via your Wallet." 
  },
  { 
    id: 2, 
    question: "What happens if my mentor doesn't show up?", 
    answer: "When you book a session, your KC is held in escrow. If the mentor fails to join the live session room within 15 minutes of the scheduled start time, the session is automatically cancelled and 100% of your KC is refunded to your wallet." 
  },
  { 
    id: 3, 
    question: "How do I get a skill 'Peer Verified'?", 
    answer: "To get the green 'Peer Verified' badge, you must successfully complete at least 3 mentoring sessions for that specific skill while maintaining an average rating of 4.5 stars or higher from your students." 
  },
  { 
    id: 4, 
    question: "Can I cash out my KC for real money?", 
    answer: "Yes! Once you accumulate a minimum of 1,000 KC (equivalent to $10 USD), you can use the 'Cash Out' feature in your Wallet to withdraw the funds to your connected Stripe or PayPal account." 
  }
];

const Support = () => {
  // --- STATES ---
  const [openFaqId, setOpenFaqId] = useState(null);
  const [ticketStatus, setTicketStatus] = useState('idle'); // 'idle', 'sending', 'success'
  
  // 👈 NEW: Form States
  const [userEmail, setUserEmail] = useState('Loading...');
  const [userId, setUserId] = useState(null);
  const [topic, setTopic] = useState('Issue with a Live Session');
  const [message, setMessage] = useState('');

  // 👈 NEW: Fetch the user's email on load
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserEmail(session.user.email);
        setUserId(session.user.id);
      }
    };
    fetchUser();
  }, []);

  // --- HANDLERS ---
  const toggleFaq = (id) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  // 👈 NEW: Send ticket to Supabase
  const handleSubmitTicket = async () => {
    if (!message.trim()) return; // Don't send empty messages
    setTicketStatus('sending');
    
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert([
          { 
            user_id: userId,
            email: userEmail,
            topic: topic, 
            message: message 
          }
        ]);

      if (error) throw error;
      
      setTicketStatus('success');
      setMessage(''); // Clear the textarea
      setTopic('Issue with a Live Session'); // Reset topic

    } catch (error) {
      console.error("Error submitting ticket:", error.message);
      setTicketStatus('idle');
      alert("Failed to send message. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar />

      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        
        {/* HEADER BANNER */}
        <div className="bg-gradient-to-br from-brand-blue to-brand-teal rounded-3xl p-12 text-center text-white relative overflow-hidden shadow-lg mb-10">
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4">How can we help you?</h1>
            <p className="text-lg opacity-90 max-w-2xl mx-auto m-0">Search our FAQs below or send a message directly to our support team.</p>
          </div>
          <i className="fa-solid fa-circle-question absolute -right-10 -bottom-10 text-[200px] opacity-10 -rotate-12"></i>
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: CONTACT FORM */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-8 md:p-10 border border-gray-100 shadow-sm h-full">
              
              <h3 className="font-extrabold text-2xl text-brand-navy mb-2">Contact Support</h3>
              <p className="text-sm text-gray-500 font-semibold mb-8">We usually respond within 2-4 hours.</p>

              {ticketStatus === 'success' ? (
                <div className="text-center py-10 animate-fade-in">
                  <div className="w-20 h-20 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center text-3xl mx-auto mb-5">
                    <i className="fa-regular fa-paper-plane"></i>
                  </div>
                  <h4 className="font-extrabold text-xl text-brand-navy mb-2">Ticket Received!</h4>
                  <p className="text-sm text-gray-500 m-0">Our team is reviewing your message. We will email you shortly.</p>
                  
                  <button 
                    onClick={() => setTicketStatus('idle')}
                    className="mt-8 text-sm font-bold text-brand-blue hover:underline"
                  >
                    Submit another request
                  </button>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <div className="mb-5">
                    <label className="block text-sm font-bold text-gray-600 mb-2">Email Address</label>
                    <input 
                      type="email" 
                      value={userEmail} 
                      readOnly 
                      className="w-full bg-gray-100 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 font-semibold cursor-not-allowed" 
                    />
                  </div>
                  
                  <div className="mb-5">
                    <label className="block text-sm font-bold text-gray-600 mb-2">Topic</label>
                    <select 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue focus:bg-white transition-colors text-brand-navy font-semibold appearance-none cursor-pointer"
                    >
                      <option value="Issue with a Live Session">Issue with a Live Session</option>
                      <option value="Knowledge Credits (Billing)">Knowledge Credits (Billing)</option>
                      <option value="Report a User">Report a User</option>
                      <option value="General Feedback / Bug Report">General Feedback / Bug Report</option>
                    </select>
                  </div>
                  
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-gray-600 mb-2">Message</label>
                    <textarea 
                      rows="5" 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please describe your issue in detail..." 
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue focus:bg-white transition-colors text-brand-navy font-semibold resize-none"
                    ></textarea>
                  </div>
                  
                  <button 
                    onClick={handleSubmitTicket}
                    disabled={ticketStatus === 'sending' || !message.trim()}
                    className="w-full bg-brand-blue hover:bg-[#2B6CB0] text-white font-extrabold py-4 px-6 rounded-xl text-base transition-all hover:-translate-y-1 hover:shadow-lg flex items-center justify-center disabled:opacity-75 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {ticketStatus === 'sending' ? (
                      <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Sending...</>
                    ) : (
                      'Submit Ticket'
                    )}
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT COLUMN: FAQ ACCORDION */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-8 md:p-10 border border-gray-100 shadow-sm h-full">
              <h3 className="font-extrabold text-2xl text-brand-navy mb-6">Frequently Asked Questions</h3>
              
              <div className="flex flex-col">
                {FAQS.map((faq) => {
                  const isOpen = openFaqId === faq.id;
                  
                  return (
                    <div key={faq.id} className="border-b border-gray-100 last:border-0 py-5">
                      <div 
                        onClick={() => toggleFaq(faq.id)}
                        className="flex justify-between items-center cursor-pointer group"
                      >
                        <h5 className={`font-bold text-base m-0 transition-colors ${isOpen ? 'text-brand-blue' : 'text-brand-navy group-hover:text-brand-blue'}`}>
                          {faq.question}
                        </h5>
                        <i className={`fa-solid fa-plus text-lg transition-transform duration-300 ${isOpen ? 'rotate-45 text-brand-blue' : 'text-gray-400'}`}></i>
                      </div>
                      
                      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                        <p className="text-gray-600 text-sm leading-relaxed m-0">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Support;