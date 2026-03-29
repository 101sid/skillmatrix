import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient'; // 👈 IMPORT SUPABASE

const PACKAGES = [
  { kc: 100, price: 1.00, discount: null },
  { kc: 500, price: 4.50, discount: '-10%' },
  { kc: 1000, price: 8.00, discount: '-20%' },
];

const Wallet = () => {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [earnedThisMonth, setEarnedThisMonth] = useState(0);
  const [spentThisMonth, setSpentThisMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(PACKAGES[0]);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle', 'loading', 'success'

  // 👈 NEW: Fetch real wallet and transaction data on load
  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const userId = session.user.id;

      // 1. Fetch current balance
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (profileData) {
        setCurrentUser(profileData);
        setBalance(profileData.knowledge_credits || 0);
      }

      // 2. Fetch completed sessions to build the ledger
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*, mentor:profiles!sessions_mentor_id_fkey(full_name), student:profiles!sessions_student_id_fkey(full_name)')
        .eq('status', 'Completed')
        .or(`mentor_id.eq.${userId},student_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (sessionsData) {
        let earned = 0;
        let spent = 0;
        const currentMonth = new Date().getMonth();

        // Map database rows to your UI's transaction format
        const mappedTx = sessionsData.map(s => {
          const isMentor = s.mentor_id === userId;
          const peerName = isMentor ? s.student?.full_name : s.mentor?.full_name;
          const sessionDate = new Date(s.scheduled_time || s.created_at);
          
          // Calculate monthly stats
          if (sessionDate.getMonth() === currentMonth) {
            if (isMentor) earned += s.kc_cost;
            else spent += s.kc_cost;
          }

          return {
            id: s.id,
            type: isMentor ? 'earned' : 'spent',
            icon: isMentor ? 'fa-chalkboard-user' : 'fa-book-open',
            title: isMentor ? `Taught Session: ${s.skill_topic}` : `Learned Session: ${s.skill_topic}`,
            desc: isMentor ? `Mentored ${peerName?.split(' ')[0] || 'Peer'} • ${sessionDate.toLocaleDateString()}` : `Mentored by ${peerName?.split(' ')[0] || 'Peer'} • ${sessionDate.toLocaleDateString()}`,
            amount: isMentor ? s.kc_cost : -s.kc_cost
          };
        });

        // Add a "Welcome Bonus" to the bottom of the ledger to simulate initial sign-up
        mappedTx.push({
          id: 'welcome-bonus',
          type: 'earned',
          icon: 'fa-star',
          title: 'Platform Onboarding Bonus',
          desc: 'Initial Network Grant',
          amount: 500
        });

        setTransactions(mappedTx);
        setEarnedThisMonth(earned);
        setSpentThisMonth(spent);
      }
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 👈 NEW: Real Purchase Handler (Updates Database)
  const handlePurchase = async () => {
    setPaymentStatus('loading');
    
    try {
      const newBalance = balance + selectedPackage.kc;

      // 1. Update Database Balance
      const { error } = await supabase
        .from('profiles')
        .update({ knowledge_credits: newBalance })
        .eq('id', currentUser.id);

      if (error) throw error;

      // Simulate API/Bank processing time for UI effect
      setTimeout(() => {
        // 2. Update Local Balance
        setBalance(newBalance);
        
        // 3. Add New Transaction to the top of the UI list
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const newTx = {
          id: Date.now(),
          type: 'bought',
          icon: 'fa-bolt',
          title: 'Topped Up Balance',
          desc: `Secure Payment • Today, ${timeString}`,
          amount: selectedPackage.kc
        };
        
        setTransactions([newTx, ...transactions]);
        setPaymentStatus('success');
        
        // 4. Close Modal after success
        setTimeout(() => {
          setIsModalOpen(false);
          setPaymentStatus('idle');
          setSelectedPackage(PACKAGES[0]); // reset for next time
        }, 1500);
      }, 1000);

    } catch (error) {
      console.error("Purchase error:", error);
      setPaymentStatus('idle');
      alert("Error processing payment. Please try again.");
    }
  };

  // --- HELPER RENDERS ---
  const getTxStyles = (type) => {
    switch(type) {
      case 'earned': return { iconBg: 'bg-teal-50 text-brand-teal', amountColor: 'text-green-500', prefix: '+' };
      case 'spent': return { iconBg: 'bg-red-50 text-brand-red', amountColor: 'text-brand-red', prefix: '' };
      case 'bought': return { iconBg: 'bg-blue-50 text-brand-blue', amountColor: 'text-green-500', prefix: '+' };
      default: return { iconBg: 'bg-gray-100 text-gray-500', amountColor: 'text-gray-800', prefix: '' };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center text-brand-navy">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-teal mb-4"></i>
        <h2 className="font-bold tracking-widest uppercase text-sm text-gray-500">Decrypting Ledger...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-brand-navy">
      {/* We pass the dynamic balance down to the Navbar! */}
      <Navbar currentBalance={balance} />

      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        
        <Link to="/dashboard" className="text-sm font-bold text-gray-400 hover:text-brand-teal transition-all hover:-translate-x-1 mb-6 flex items-center inline-flex">
          <i className="fa-solid fa-arrow-left mr-2"></i> Back to Dashboard
        </Link>

        {/* TOP ROW: Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          
          {/* Main Balance Card */}
          <div className="lg:col-span-4 bg-gradient-to-br from-brand-navy to-gray-800 rounded-3xl p-10 text-white relative overflow-hidden shadow-xl flex flex-col justify-center min-h-[250px]">
            <div className="relative z-10">
              <span className="text-gray-400 text-xs font-extrabold uppercase tracking-widest mb-2 block">Total Balance</span>
              <h2 className="text-[#F6C90E] font-extrabold text-5xl md:text-6xl m-0 leading-none mb-2">
                {balance.toLocaleString()} <span className="text-2xl">KC</span>
              </h2>
              <p className="text-gray-400 text-sm mb-8">≈ ${(balance / 100).toFixed(2)} USD Value</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex-1 bg-brand-teal hover:bg-brand-darkTeal text-white font-extrabold py-3 px-4 rounded-xl transition-all hover:-translate-y-1 hover:shadow-lg shadow-brand-teal/30"
                >
                  <i className="fa-solid fa-plus mr-2"></i> Buy KC
                </button>
                <button className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 px-4 rounded-xl transition-colors">
                  <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i> Cash Out
                </button>
              </div>
            </div>
            <i className="fa-solid fa-bolt absolute -right-10 -bottom-10 text-[180px] opacity-5 -rotate-12"></i>
          </div>

          {/* Mini Stat Cards */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex items-center h-full">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center text-2xl mr-6 flex-shrink-0">
                <i className="fa-solid fa-arrow-trend-up"></i>
              </div>
              <div>
                <h5 className="text-xs font-extrabold text-gray-400 uppercase tracking-wide m-0 mb-1">Earned This Month</h5>
                <h3 className="font-extrabold text-3xl text-brand-navy m-0">{earnedThisMonth} KC</h3>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex items-center h-full">
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-brand-red flex items-center justify-center text-2xl mr-6 flex-shrink-0">
                <i className="fa-solid fa-arrow-trend-down"></i>
              </div>
              <div>
                <h5 className="text-xs font-extrabold text-gray-400 uppercase tracking-wide m-0 mb-1">Spent This Month</h5>
                <h3 className="font-extrabold text-3xl text-brand-navy m-0">{spentThisMonth} KC</h3>
              </div>
            </div>
          </div>

        </div>

        {/* TRANSACTION LEDGER */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <h3 className="font-extrabold text-xl text-brand-navy m-0">Transaction History</h3>
            <button className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold py-2 px-4 rounded-lg text-xs transition-colors">
              <i className="fa-solid fa-download mr-2"></i> Export CSV
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {transactions.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="font-bold">No transactions yet.</p>
              </div>
            ) : (
              transactions.map((tx, index) => {
                const styles = getTxStyles(tx.type);
                return (
                  <div 
                    key={tx.id} 
                    className={`flex items-center p-4 rounded-2xl transition-colors hover:bg-gray-50 ${index === 0 && paymentStatus === 'success' ? 'animate-pulse bg-green-50' : ''}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg mr-5 flex-shrink-0 ${styles.iconBg}`}>
                      <i className={`fa-solid ${tx.icon}`}></i>
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-bold text-sm text-brand-navy m-0 mb-1">{tx.title}</h4>
                      <p className="text-xs text-gray-500 m-0">{tx.desc}</p>
                    </div>
                    <div className={`font-extrabold text-base whitespace-nowrap ${styles.amountColor}`}>
                      {styles.prefix} {Math.abs(tx.amount).toLocaleString()} KC
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>

      {/* BUY KC MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md shadow-2xl relative">
            
            <div className="border-b border-gray-100 p-5 flex justify-between items-center bg-gray-50">
              <h5 className="font-extrabold text-lg m-0"><i className="fa-solid fa-wallet text-brand-teal mr-2"></i> Buy Knowledge Credits</h5>
              <button 
                onClick={() => { if(paymentStatus !== 'loading') setIsModalOpen(false) }} 
                className="text-gray-400 hover:text-brand-red transition-colors"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-5 font-semibold">Select a package to add KC to your wallet instantly.</p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                {PACKAGES.slice(0, 2).map((pkg) => (
                  <div 
                    key={pkg.kc}
                    onClick={() => paymentStatus !== 'loading' && setSelectedPackage(pkg)}
                    className={`border-2 rounded-2xl p-4 text-center cursor-pointer transition-all ${selectedPackage.kc === pkg.kc ? 'border-brand-teal bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <h4 className="font-extrabold text-xl text-brand-navy m-0 mb-1">{pkg.kc.toLocaleString()} KC</h4>
                    <span className="text-xs font-bold text-gray-500">
                      ${pkg.price.toFixed(2)} USD {pkg.discount && <span className="text-green-500 ml-1">({pkg.discount})</span>}
                    </span>
                  </div>
                ))}
              </div>
              <div 
                onClick={() => paymentStatus !== 'loading' && setSelectedPackage(PACKAGES[2])}
                className={`border-2 rounded-2xl p-4 text-center cursor-pointer transition-all mb-6 ${selectedPackage.kc === PACKAGES[2].kc ? 'border-brand-teal bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <h4 className="font-extrabold text-xl text-brand-navy m-0 mb-1">{PACKAGES[2].kc.toLocaleString()} KC</h4>
                <span className="text-xs font-bold text-gray-500">
                  ${PACKAGES[2].price.toFixed(2)} USD <span className="text-green-500 ml-1">({PACKAGES[2].discount})</span>
                </span>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-2">Payment Method</label>
                <div className="border border-gray-200 rounded-xl p-3 flex items-center bg-gray-50">
                  <i className="fa-brands fa-cc-visa text-2xl text-[#1A1F71] mr-4"></i>
                  <div>
                    <h6 className="m-0 font-bold text-sm text-brand-navy">Visa ending in 4242</h6>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Expires 12/25</span>
                  </div>
                </div>
              </div>

              {paymentStatus === 'success' ? (
                <div className="bg-green-50 text-green-600 p-4 rounded-xl font-bold text-center animate-fade-in border border-green-200">
                  <i className="fa-solid fa-circle-check mr-2"></i> Payment Successful!
                </div>
              ) : (
                <button 
                  onClick={handlePurchase}
                  disabled={paymentStatus === 'loading'}
                  className="w-full bg-brand-teal hover:bg-brand-darkTeal text-white font-extrabold py-4 px-6 rounded-xl text-base transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {paymentStatus === 'loading' ? (
                    <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Processing Secure Payment...</>
                  ) : (
                    `Pay $${selectedPackage.price.toFixed(2)}`
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

export default Wallet;