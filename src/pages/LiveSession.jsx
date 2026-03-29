import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // 👈 IMPORT SUPABASE

const LiveSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room'); // 👈 Get the session ID from URL
  
  // 👈 NEW: Database States
  const [sessionData, setSessionData] = useState(null);
  const [peerName, setPeerName] = useState('Connecting...');
  const [peerAvatar, setPeerAvatar] = useState('User');

  // Video/Audio Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Session Duration State
  const [duration, setDuration] = useState(0);

  // 👈 NEW: Webcam Ref & State
  const myVideoRef = useRef(null);
  const [stream, setStream] = useState(null);

  // Chat States
  const [messages, setMessages] = useState([
    { id: 1, sender: 'System', type: 'text', text: "Welcome to the secure peer-to-peer room.", time: "Now" }
  ]);
  const [messageInput, setMessageInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  
  // Refs
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // 👈 NEW: Fetch Room Data & Start Webcam
  useEffect(() => {
    const fetchRoomData = async () => {
      if (!roomId) return;
      
      const { data: { session: currentAuth } } = await supabase.auth.getSession();
      if (!currentAuth) return;

      const { data, error } = await supabase
        .from('sessions')
        .select('*, mentor:profiles!sessions_mentor_id_fkey(full_name, avatar_seed), student:profiles!sessions_student_id_fkey(full_name, avatar_seed)')
        .eq('id', roomId)
        .single();

      if (!error && data) {
        setSessionData(data);
        // Determine who the *other* person is
        const isMentor = data.mentor_id === currentAuth.user.id;
        const peer = isMentor ? data.student : data.mentor;
        
        setPeerName(peer?.full_name || 'Peer User');
        setPeerAvatar(peer?.avatar_seed || 'User');
      }
    };

    fetchRoomData();

    // Start Local Webcam
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(mediaStream);
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    };

    startCamera();

    // Cleanup camera when leaving
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId]);

  // Session Duration Timer Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to format seconds into MM:SS
  const formatDuration = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Chat Handlers
  const handleEmojiClick = (emoji) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPendingFile({ name: file.name, url: URL.createObjectURL(file), isImage: file.type.startsWith('image/') });
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() && !pendingFile) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let newMessages = [...messages];

    if (pendingFile) {
      newMessages.push({ id: Date.now(), sender: 'You', type: pendingFile.isImage ? 'image' : 'file', fileUrl: pendingFile.url, fileName: pendingFile.name, time: time });
    }
    if (messageInput.trim()) {
      newMessages.push({ id: Date.now() + 1, sender: 'You', type: 'text', text: messageInput.trim(), time: time });
    }

    setMessages(newMessages);
    setMessageInput("");
    setPendingFile(null);
  };

  // 👈 NEW: Handle Ending the Call Securely
  const handleEndSession = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop()); // Turn off camera
    }

    if (roomId) {
      // Mark session as completed in database
      await supabase
        .from('sessions')
        .update({ status: 'Completed' })
        .eq('id', roomId);
    }
    
    navigate('/sessions-log');
  };

  return (
    <div className="h-screen w-full bg-[#121212] flex flex-col text-white overflow-hidden font-sans">
      
      {/* TOP HEADER */}
      <div className="p-4 bg-black/60 flex justify-between items-center border-b border-white/5 backdrop-blur-xl z-10 relative">
        <div className="flex items-center gap-4">
          <button onClick={handleEndSession} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="text-sm font-black m-0 tracking-tight">{sessionData?.skill_topic || 'Loading Room...'}</h2>
            <p className="text-[9px] text-brand-teal font-black uppercase tracking-[0.2em] m-0">Live Exchange Room</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-extrabold tabular-nums tracking-wide text-brand-teal">
              {formatDuration(duration)}
            </div>
            <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Duration</div>
          </div>
          
          <div className="h-8 w-px bg-white/10"></div>

          <div className="bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black uppercase text-red-500">Encrypted</span>
          </div>
        </div>
      </div>

      <div className="flex-grow flex overflow-hidden">
        
        {/* PRIMARY VIDEO FEED */}
        <div className="flex-grow relative p-8 flex items-center justify-center">
          <div className="w-full h-full max-w-6xl rounded-[40px] bg-gray-900/50 border border-white/5 relative overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 flex items-center justify-center">
               {/* 👈 UPDATED: Real Peer Avatar */}
               <img 
                 src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${peerAvatar}`} 
                 className="w-48 h-48 opacity-20 grayscale blur-sm" 
                 alt=""
               />
               <p className="absolute text-gray-500 text-xs font-bold uppercase tracking-widest mt-64">Waiting for {peerName} to present...</p>
            </div>

            <div className="absolute bottom-8 left-8 bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3">
              <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]"></span>
              {/* 👈 UPDATED: Real Peer Name */}
              <span className="text-xs font-black tracking-wide">{peerName}</span>
            </div>
          </div>

          {/* SELF PREVIEW (PIP) */}
          <div className="absolute top-12 right-12 w-56 h-36 rounded-3xl bg-black border-2 border-brand-teal shadow-2xl overflow-hidden group flex items-center justify-center z-20">
            {isVideoOff ? (
              <div className="text-gray-500 flex flex-col items-center z-10">
                <i className="fa-solid fa-video-slash text-2xl mb-2"></i>
                <span className="text-[10px] font-black uppercase tracking-widest mt-1">Camera Off</span>
              </div>
            ) : (
              <>
                {/* 👈 UPDATED: Real Local Webcam Feed */}
                <video 
                  ref={myVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
                />
                <div className="absolute bottom-3 left-3 text-[10px] font-black bg-black/60 px-2 py-1 rounded-lg uppercase tracking-widest z-10">
                  You {isMuted && <i className="fa-solid fa-microphone-slash text-red-500 ml-1"></i>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* INTERACTIVE CHAT SIDEBAR (UNCHANGED UI) */}
        <div className="w-[360px] bg-black/40 border-l border-white/5 flex flex-col hidden xl:flex backdrop-blur-md relative">
          <div className="p-6 border-b border-white/5">
             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Session Context</h4>
          </div>
          
          <div className="flex-grow p-6 overflow-y-auto space-y-6">
             {messages.map((msg) => {
               const isMe = msg.sender === 'You';
               return (
                 <div key={msg.id} className="flex gap-4 animate-fade-in">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-white/10">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${isMe ? 'User' : peerAvatar}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <p className={`text-[10px] font-black uppercase tracking-wider ${isMe ? 'text-blue-400' : 'text-brand-teal'}`}>{msg.sender === 'System' ? 'System' : isMe ? 'You' : peerName}</p>
                        <span className="text-[8px] font-bold text-gray-600">{msg.time}</span>
                      </div>
                      
                      {msg.type === 'text' && <p className="text-xs text-gray-300 leading-relaxed break-words">{msg.text}</p>}
                      {msg.type === 'image' && <img src={msg.fileUrl} className="mt-2 rounded-xl border border-white/10 w-full max-w-[220px] object-cover" alt="Sent" />}
                      {msg.type === 'file' && (
                        <div className="mt-2 bg-white/5 border border-white/10 p-3 rounded-xl flex items-center gap-3">
                           <i className="fa-solid fa-file-lines text-xl text-brand-teal"></i>
                           <span className="text-xs text-gray-300 truncate font-medium">{msg.fileName}</span>
                        </div>
                      )}
                    </div>
                 </div>
               );
             })}
             <div ref={chatEndRef} />
          </div>
          
          {pendingFile && (
             <div className="px-6 py-3 bg-white/5 border-t border-white/10 flex justify-between items-center animate-fade-in">
                <div className="flex items-center gap-3 overflow-hidden">
                   {pendingFile.isImage ? <img src={pendingFile.url} className="w-8 h-8 rounded object-cover" alt="" /> : <i className="fa-solid fa-paperclip text-brand-teal"></i>}
                   <span className="text-xs text-gray-300 truncate w-40">{pendingFile.name}</span>
                </div>
                <button onClick={() => setPendingFile(null)} className="text-gray-500 hover:text-red-400 transition-colors"><i className="fa-solid fa-xmark"></i></button>
             </div>
          )}

          <div className="p-6 border-t border-white/5 bg-black/20 relative">
             
             {showEmojiPicker && (
               <div className="absolute bottom-24 left-6 bg-gray-900 border border-white/10 shadow-2xl rounded-2xl p-4 grid grid-cols-5 gap-3 z-50 animate-fade-in">
                 {['👍', '💡', '🔥', '✅', '🚀', '🙌', '💻', '🤔', '💯', '✨'].map(emoji => (
                   <button key={emoji} onClick={() => handleEmojiClick(emoji)} className="text-xl hover:scale-125 transition-transform">{emoji}</button>
                 ))}
               </div>
             )}

             <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-brand-teal transition-colors">
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`transition-colors ${showEmojiPicker ? 'text-brand-teal' : 'text-gray-400 hover:text-white'}`}>
                   <i className="fa-regular fa-face-smile text-sm"></i>
                </button>
                
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                <button onClick={() => fileInputRef.current.click()} className="text-gray-400 hover:text-white transition-colors">
                   <i className="fa-solid fa-paperclip text-sm"></i>
                </button>

                <input 
                  type="text" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Send to chat..." 
                  className="w-full bg-transparent text-xs text-white outline-none placeholder-gray-600 py-1.5" 
                />
                
                <button 
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() && !pendingFile}
                  className="w-8 h-8 rounded-full bg-brand-teal disabled:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <i className="fa-solid fa-paper-plane text-[10px] text-white ml-[-2px]"></i>
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* CONTROL HUD */}
      <div className="p-8 bg-black/80 flex justify-center items-center gap-8 relative border-t border-white/5 backdrop-blur-2xl z-10">
        <div className="flex items-center gap-6">
          <button onClick={() => setIsMuted(!isMuted)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl ${isMuted ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
            <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
          </button>
          <button onClick={() => setIsVideoOff(!isVideoOff)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl ${isVideoOff ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
            <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-lg`}></i>
          </button>
          <button onClick={() => setIsSharing(!isSharing)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl ${isSharing ? 'bg-brand-teal text-white shadow-brand-teal/20' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
            <i className="fa-solid fa-desktop text-base"></i>
          </button>
        </div>

        <div className="h-10 w-px bg-white/10 mx-2"></div>

        {/* 👈 UPDATED: Leave Session Button now runs the database update function */}
        <button onClick={handleEndSession} className="bg-red-500 hover:bg-red-600 text-white font-black px-10 py-4 rounded-2xl transition-all shadow-2xl shadow-red-500/30 active:scale-95 uppercase tracking-[0.1em] text-xs">
          Leave Session
        </button>

        <div className="absolute left-12 hidden md:block">
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">Secure Peer Connection</span>
        </div>
      </div>

    </div>
  );
};

export default LiveSession;