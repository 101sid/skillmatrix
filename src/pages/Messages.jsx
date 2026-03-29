import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Navbar from '../components/Navbar';

const Messages = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // --- STATES ---
  const [myId, setMyId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    const initMessages = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setMyId(session.user.id);

      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .not('id', 'eq', session.user.id);
      
      setContacts(users || []);
      if (users?.length > 0) setActiveContact(users[0]);
    };

    initMessages();
    setupPresence();
  }, []);

  const setupPresence = async () => {
    const channel = supabase.channel('online-users');
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineMap = {};
        Object.keys(state).forEach(key => {
          const user = state[key][0];
          onlineMap[user.user_id] = true;
        });
        setOnlineUsers(onlineMap);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) await channel.track({ user_id: session.user.id });
        }
      });
  };

  useEffect(() => {
    if (!activeContact || !myId) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Fetch Error:", error.message);
        return;
      }

      const conversation = data.filter(msg => 
        (msg.sender_id === myId && msg.receiver_id === activeContact.id) || 
        (msg.sender_id === activeContact.id && msg.receiver_id === myId)
      );

      setMessages(conversation || []);
    };

    fetchHistory();

    const channel = supabase
      .channel(`chat-${activeContact.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, (payload) => {
        const newMsg = payload.new;
        const isFromMe = newMsg.sender_id === myId && newMsg.receiver_id === activeContact.id;
        const isToMe = newMsg.sender_id === activeContact.id && newMsg.receiver_id === myId;
        
        if (isFromMe || isToMe) {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeContact, myId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;
    setIsSending(true);

    try {
      const { error } = await supabase.from('messages').insert([{
        sender_id: myId,
        receiver_id: activeContact.id,
        content: messageInput.trim(),
        type: 'text'
      }]);
      if (error) throw error;
      setMessageInput("");
    } catch (err) {
      console.error("Send Error:", err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `chat/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);

        await supabase.from('messages').insert([{
        sender_id: myId,
        receiver_id: activeContact.id,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        file_url: publicUrl,
        file_name: file.name
        }]);
    } catch (error) {
        console.error("Upload Error:", error.message);
    }
  };

  const filteredContacts = contacts.filter(c => c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen flex flex-col text-brand-navy bg-[#F8F9FD]">
      <Navbar />
      <main className="flex-grow pt-10 pb-20 max-w-[1800px] mx-auto px-4 md:px-12 w-full h-[calc(100vh-100px)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* CONTACT LIST */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-extrabold text-2xl mb-4">Messages</h2>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search network..." 
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-brand-teal"
              />
            </div>
            <div className="flex-grow overflow-y-auto p-3">
              {filteredContacts.map(c => (
                <div key={c.id} onClick={() => setActiveContact(c)} className={`flex items-center p-3 rounded-2xl cursor-pointer mb-1 transition-all ${c.id === activeContact?.id ? 'bg-teal-50 border-teal-100' : 'hover:bg-gray-50'}`}>
                  <div className="relative group" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${c.id}`); }}>
                    <img src={c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.avatar_seed}`} className="w-12 h-12 rounded-full mr-3 bg-white border border-gray-100 group-hover:border-brand-teal transition-all" alt="" />
                    {onlineUsers[c.id] && <div className="absolute bottom-0 right-3 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h4 className="font-bold text-sm truncate m-0 text-brand-navy hover:text-brand-teal transition-colors" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${c.id}`); }}>
                        {c.full_name || "Unknown Peer"}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{c.role || "Peer"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CHAT WINDOW */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
            {activeContact ? (
              <>
                {/* INTERACTIVE HEADER */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                  <div 
                    className="flex items-center cursor-pointer group"
                    onClick={() => navigate(`/profile/${activeContact.id}`)}
                  >
                    <img 
                        src={activeContact.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeContact.avatar_seed}`} 
                        className="w-12 h-12 rounded-full mr-4 bg-gray-50 border-2 border-transparent group-hover:border-brand-teal transition-all shadow-sm object-cover" 
                        alt={activeContact.full_name} 
                    />
                    <div>
                      <h3 className="font-extrabold text-lg m-0 group-hover:text-brand-teal transition-colors">{activeContact.full_name}</h3>
                      <span className={`text-xs font-bold ${onlineUsers[activeContact.id] ? 'text-brand-teal' : 'text-gray-400'}`}>
                          {onlineUsers[activeContact.id] ? 'Online Now' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(`/profile/${activeContact.id}`)} 
                        className="hidden md:block text-xs font-bold text-gray-400 hover:text-brand-teal uppercase tracking-widest transition-colors border-r border-gray-100 pr-4"
                    >
                        View Profile
                    </button>
                    <button onClick={() => navigate('/marketplace')} className="text-brand-teal hover:text-brand-darkTeal font-bold text-sm">
                        <i className="fa-regular fa-calendar-plus mr-1"></i> Book Again
                    </button>
                  </div>
                </div>

                <div className="flex-grow overflow-y-auto p-6 bg-gray-50/30 flex flex-col gap-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.type === 'system' ? 'justify-center my-4' : msg.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
                      
                      {/* SYSTEM MESSAGE (Booking/Rating Notifications) */}
                      {msg.type === 'system' ? (
                        <div className="bg-white border border-teal-100 px-6 py-2.5 rounded-full shadow-sm flex items-center gap-3 animate-fade-in max-w-[90%]">
                          <div className="bg-teal-50 w-8 h-8 rounded-full flex items-center justify-center">
                            <i className="fa-solid fa-bell text-brand-teal text-xs"></i>
                          </div>
                          <span className="text-[11px] font-bold text-brand-navy uppercase tracking-tight">{msg.content}</span>
                        </div>
                      ) : (
                        <div className={`max-w-[70%] flex flex-col ${msg.sender_id === myId ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${msg.sender_id === myId ? 'bg-brand-blue text-white rounded-tr-none' : 'bg-white border rounded-tl-none'}`}>
                            {msg.type === 'text' && msg.content}
                            {msg.type === 'image' && <img src={msg.file_url} className="rounded-lg max-w-full h-auto cursor-pointer" alt="Sent" onClick={() => window.open(msg.file_url)} />}
                            {msg.type === 'file' && <div className="flex items-center gap-2 font-bold"><i className="fa-solid fa-file-lines text-xl text-brand-teal"></i><span className="underline cursor-pointer">{msg.file_name}</span></div>}
                          </div>
                          <span className="text-[9px] font-bold text-gray-400 mt-1">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      )}
                      
                    </div>
                  ))}
                  <div ref={scrollRef} />
                </div>

                <div className="p-4 bg-white border-t border-gray-100 flex items-center gap-3">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current.click()} className="text-xl text-gray-400 hover:text-brand-teal transition-colors"><i className="fa-solid fa-paperclip"></i></button>
                  <input 
                    type="text" 
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..." 
                    className="flex-grow bg-gray-50 border-2 border-gray-100 rounded-full px-5 py-2.5 text-sm outline-none focus:border-brand-blue transition-all"
                  />
                  <button onClick={handleSendMessage} disabled={isSending} className="bg-brand-blue text-white w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md active:scale-90 hover:bg-brand-darkTeal disabled:opacity-50">
                    <i className="fa-solid fa-paper-plane text-sm"></i>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <i className="fa-regular fa-comments text-6xl mb-4 opacity-20 animate-pulse"></i>
                <p className="font-bold">Select a peer to start the exchange</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;