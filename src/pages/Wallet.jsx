import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient';

const PACKAGES = [
  { kc: 100, price: 1.00, discount: null },
  { kc: 500, price: 4.50, discount: '-10%' },
  { kc: 1000, price: 8.00, discount: '-20%' },
];

const Wallet = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [earnedThisMonth, setEarnedThisMonth] = useState(0);
  const [spentThisMonth, setSpentThisMonth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(PACKAGES[0]);
  const [paymentStatus, setPaymentStatus] = useState('idle');

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const userId = session.user.id;

      // 1. Fetch current balance from Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (profileData) {
        setCurrentUser(profileData);
        setBalance(profileData.knowledge_credits || 0);
      }

      // 2. Fetch the REAL transaction ledger
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (txData) {
        let earned = 0;
        let spent = 0;
        const currentMonth = new Date().getMonth();

        const mappedTx = txData.map(tx => {
          const txDate = new Date(tx.created_at);
          
          // Calculate monthly stats
          if (txDate.getMonth() === currentMonth) {
            if (tx.amount > 0) earned += tx.amount;
            else spent += Math.abs(tx.amount);
          }

          // Map for UI
          return {
            id: tx.id,
            type: tx.amount > 0 ? (tx.category === 'Top-up' ? 'bought' : 'earned') : 'spent',
            icon: tx.category === 'Top-up' ? 'fa-bolt' : (tx.amount > 0 ? 'fa-chalkboard-user' : 'fa-book-open'),
            title: tx.description,
            desc: tx.category + ' • ' + txDate.toLocaleDateString(),
            amount: tx.amount
          };
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

  const handlePurchase = async () => {
    setPaymentStatus('loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newBalance = balance + selectedPackage.kc;

      // 1. Update Profile Balance
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ knowledge_credits: newBalance })
        .eq('id', session.user.id);
      if (balanceError) throw balanceError;

      // 2. Create Transaction Record (This makes the history permanent)
      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          user_id: session.user.id,
          amount: selectedPackage.kc,
          description: `Top-up: ${selectedPackage.kc} Credits`,
          category: 'Top-up'
        }]);
      if (txError) throw txError;

      // Success UI Flow
      setTimeout(() => {
        setBalance(newBalance);
        setPaymentStatus('success');
        fetchWalletData(); // Refresh history list
        
        setTimeout(() => {
          setIsModalOpen(false);
          setPaymentStatus('idle');
        }, 1500);
      }, 1000);

    } catch (error) {
      console.error("Purchase error:", error);
      setPaymentStatus('idle');
      alert("Payment failed.");
    }
  };

  const getTxStyles = (type) => {
    switch(type) {
      case 'earned': return { iconBg: 'bg-teal-50 text-brand-teal', amountColor: 'text-green-500', prefix: '+' };
      case 'spent': return { iconBg: 'bg-red-50 text-brand-red', amountColor: 'text-brand-red', prefix: '' };
      case 'bought': return { iconBg: 'bg-blue-50 text-brand-blue', amountColor: 'text-green-500', prefix: '+' };
      default: return { iconBg: 'bg-gray-100 text-gray-500', amountColor: 'text-gray-800', prefix: '' };
    }
  };

  if (isLoading) return <div className="p-20 text-center font-bold">Decrypting Ledger...</div>;

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar currentBalance={balance} />

      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full">
        <Link to="/dashboard" className="text-sm font-bold text-gray-400 hover:text-brand-teal mb-6 flex items-center inline-flex">
          <i className="fa-solid fa-arrow-left mr-2"></i> Back to Dashboard
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Balance Card */}
          <div className="lg:col-span-4 bg-brand-navy rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl flex flex-col justify-center min-h-[280px]">
            <div className="relative z-10">
              <span className="text-gray-400 text-xs font-black uppercase tracking-[0.2em] mb-2 block">Available Credits</span>
              <h2 className="text-[#F6C90E] font-black text-6xl m-0 leading-none mb-4">{balance.toLocaleString()}</h2>
              <p className="text-gray-400 text-sm mb-8 font-bold uppercase tracking-widest">Knowledge Credits (KC)</p>
              
              <div className="flex gap-4">
                <button onClick={() => setIsModalOpen(true)} className="flex-1 bg-brand-teal text-white font-black py-4 rounded-2xl hover:scale-105 transition-transform shadow-lg shadow-brand-teal/20">
                  <i className="fa-solid fa-bolt mr-2"></i> Buy KC
                </button>
                <button className="flex-1 bg-white/10 text-white font-bold py-4 rounded-2xl hover:bg-white/20 transition-all">
                  Withdraw
                </button>
              </div>
            </div>
            <i className="fa-solid fa-dna absolute -right-10 -bottom-10 text-[200px] opacity-5 -rotate-12"></i>
          </div>

          {/* Monthly Stats */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm flex items-center h-full">
              <div className="w-20 h-20 rounded-3xl bg-teal-50 text-brand-teal flex items-center justify-center text-3xl mr-8 flex-shrink-0">
                <i className="fa-solid fa-arrow-trend-up"></i>
              </div>
              <div>
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] m-0 mb-1">Earned (March)</h5>
                <h3 className="font-black text-4xl text-brand-navy m-0">+{earnedThisMonth}</h3>
              </div>
            </div>

            <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm flex items-center h-full">
              <div className="w-20 h-20 rounded-3xl bg-red-50 text-brand-red flex items-center justify-center text-3xl mr-8 flex-shrink-0">
                <i className="fa-solid fa-arrow-trend-down"></i>
              </div>
              <div>
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] m-0 mb-1">Spent (March)</h5>
                <h3 className="font-black text-4xl text-brand-navy m-0">-{spentThisMonth}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History Ledger */}
        <div className="bg-white rounded-[40px] p-10 border border-gray-100 shadow-sm">
          <h3 className="font-black text-2xl text-brand-navy mb-8 flex items-center gap-3">
             <i className="fa-solid fa-clock-rotate-left text-brand-teal"></i> Ledger History
          </h3>

          <div className="flex flex-col gap-3">
            {transactions.map((tx) => {
              const styles = getTxStyles(tx.type);
              return (
                <div key={tx.id} className="flex items-center p-6 rounded-3xl transition-all hover:bg-gray-50 border border-transparent hover:border-gray-100">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl mr-6 flex-shrink-0 ${styles.iconBg}`}>
                    <i className={`fa-solid ${tx.icon}`}></i>
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-extrabold text-base text-brand-navy m-0 mb-1">{tx.title}</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest m-0">{tx.desc}</p>
                  </div>
                  <div className={`font-black text-xl ${styles.amountColor}`}>
                    {styles.prefix}{Math.abs(tx.amount).toLocaleString()} KC
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* PURCHASE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[40px] overflow-hidden w-full max-w-md shadow-2xl relative p-10">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-gray-400 hover:text-brand-red"><i className="fa-solid fa-xmark text-xl"></i></button>
            
            <h5 className="font-black text-2xl mb-2">Fuel Your DNA</h5>
            <p className="text-gray-500 text-sm mb-8 font-medium">Select a credit bundle to top up your wallet.</p>
            
            <div className="space-y-4 mb-10">
              {PACKAGES.map((pkg) => (
                <div 
                  key={pkg.kc}
                  onClick={() => paymentStatus !== 'loading' && setSelectedPackage(pkg)}
                  className={`border-2 rounded-3xl p-6 flex justify-between items-center cursor-pointer transition-all ${selectedPackage.kc === pkg.kc ? 'border-brand-teal bg-teal-50' : 'border-gray-100 hover:border-gray-300'}`}
                >
                  <div>
                    <h4 className="font-black text-xl text-brand-navy m-0">{pkg.kc} KC</h4>
                    <span className="text-[10px] font-black text-brand-teal uppercase tracking-widest">{pkg.discount ? `Save ${pkg.discount}` : 'Basic Pack'}</span>
                  </div>
                  <div className="text-xl font-black text-brand-navy">${pkg.price.toFixed(2)}</div>
                </div>
              ))}
            </div>

            {paymentStatus === 'success' ? (
              <div className="bg-green-500 text-white p-5 rounded-2xl font-black text-center animate-bounce">
                <i className="fa-solid fa-check mr-2"></i> CREDITS ADDED!
              </div>
            ) : (
              <button 
                onClick={handlePurchase}
                disabled={paymentStatus === 'loading'}
                className="w-full bg-brand-navy hover:bg-brand-teal text-white font-black py-5 rounded-3xl text-sm transition-all shadow-xl disabled:opacity-50"
              >
                {paymentStatus === 'loading' ? 'Encrypting Payment...' : `Confirm Purchase ($${selectedPackage.price.toFixed(2)})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;