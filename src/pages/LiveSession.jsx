import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// Bypass Vite's broken simple-peer import and use the global browser version
const Peer = window.SimplePeer;

// Google and Twilio STUN Servers to bypass Wi-Fi Firewalls
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

const LiveSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Robust ID extraction
  const roomId = searchParams.get('id') || searchParams.get('room');

  // --- REFS ---
  const myVideoRef = useRef(null);
  const peerVideoRef = useRef(null);
  const connectionRef = useRef(null);
  const channelRef = useRef(null);
  const chatEndRef = useRef(null);

  // --- STATES ---
  const [myId, setMyId] = useState(null);
  const [stream, setStream] = useState(null);
  const [peerStream, setPeerStream] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [peerName, setPeerName] = useState('Connecting...');
  const [peerAvatar, setPeerAvatar] = useState('User');
  
  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  
  // Chat
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // 1. INITIALIZATION & SUPABASE SIGNALING
  useEffect(() => {
    let localStream = null;

    const init = async () => {
      if (!roomId) {
        alert("Session ID missing.");
        navigate('/dashboard');
        return;
      }

      const { data: { session: auth } } = await supabase.auth.getSession();
      if (!auth) return;
      setMyId(auth.user.id);

      // Fetch Session Details
      const { data: sData } = await supabase
        .from('sessions')
        .select('*, mentor:profiles!sessions_mentor_id_fkey(full_name, avatar_seed), student:profiles!sessions_student_id_fkey(full_name, avatar_seed)')
        .eq('id', roomId)
        .single();
      
      if (sData) {
        setSessionData(sData);
        const isMentor = sData.mentor_id === auth.user.id;
        setPeerName(isMentor ? sData.student.full_name : sData.mentor.full_name);
        setPeerAvatar(isMentor ? sData.student.avatar_seed : sData.mentor.avatar_seed);
      }

      // Start Local Camera
      try {
        console.log("📷 Requesting Camera/Mic access...");
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(localStream);
        console.log("📷 Camera access granted!");
      } catch (err) {
        console.error("❌ Camera Error:", err);
        alert("Please allow camera access to join the session.");
        return;
      }

      // Initialize Supabase Channel for WebRTC Signaling & Chat
      console.log("📡 Connecting to Supabase Channel...");
      const channel = supabase.channel(`room-${roomId}`, {
        config: { broadcast: { self: false } }
      });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'signal' }, (payload) => {
          if (payload.payload.userId !== auth.user.id) {
             console.log("📥 Received WebRTC Signal from peer!");
             handleIncomingSignal(payload.payload.signal, localStream, auth.user.id);
          }
        })
        .on('broadcast', { event: 'chat' }, (payload) => {
          setMessages(prev => [...prev, payload.payload]);
        })
        // Bulletproof Ping/Pong Radar
        .on('broadcast', { event: 'ping' }, () => {
          console.log("👋 Received PING from newcomer. Sending PONG...");
          channel.send({ type: 'broadcast', event: 'pong', payload: {} });
        })
        .on('broadcast', { event: 'pong' }, () => {
          console.log("🎯 Received PONG! The other person is ready.");
          if (!connectionRef.current) {
            console.log("🚀 Initiating the WebRTC Call!");
            startCall(localStream, auth.user.id);
          }
        })
        .subscribe(async (status) => {
           if (status === 'SUBSCRIBED') {
             console.log("✅ Joined Room! Broadcasting PING...");
             channel.send({ type: 'broadcast', event: 'ping', payload: {} });
           }
        });
    };

    init();

    return () => {
      // Cleanup on unmount
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (connectionRef.current) connectionRef.current.destroy();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId]);

  // 2. TIMERS
  useEffect(() => {
    const timer = setInterval(() => setDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- ANTI-BLINK VIDEO ATTACHMENT ---
  // This prevents the 1-second timer from making the video flash
  useEffect(() => {
    if (peerVideoRef.current && peerStream) {
      if (peerVideoRef.current.srcObject !== peerStream) {
         peerVideoRef.current.srcObject = peerStream;
      }
    }
  }, [peerStream]);

  useEffect(() => {
    if (myVideoRef.current && stream && !isSharing) {
      if (myVideoRef.current.srcObject !== stream) {
         myVideoRef.current.srcObject = stream;
      }
    }
  }, [stream, isSharing]);

  // 3. WEBRTC FUNCTIONS
  const startCall = (myStream, userId) => {
    const peer = new Peer({ initiator: true, stream: myStream, config: ICE_SERVERS });

    peer.on('signal', data => {
      console.log('📤 Sending WebRTC Offer...');
      channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { signal: data, userId } });
    });

    peer.on('stream', remoteStream => {
      console.log('🎥 PEER STREAM RECEIVED!');
      setPeerStream(remoteStream);
    });

    peer.on('connect', () => console.log('🎉 WEBRTC SECURE CONNECTION ESTABLISHED!'));
    peer.on('error', err => console.error('❌ WEBRTC ERROR:', err));

    connectionRef.current = peer;
  };

  const handleIncomingSignal = (incomingSignal, myStream, userId) => {
    if (connectionRef.current) {
        connectionRef.current.signal(incomingSignal);
    } else {
        console.log("📞 Receiving incoming call. Generating Answer...");
        const peer = new Peer({ initiator: false, stream: myStream, config: ICE_SERVERS });
        
        peer.on('signal', data => {
          console.log('📤 Sending WebRTC Answer...');
          channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { signal: data, userId } });
        });

        peer.on('stream', remoteStream => {
          console.log('🎥 PEER STREAM RECEIVED!');
          setPeerStream(remoteStream);
        });

        peer.on('connect', () => console.log('🎉 WEBRTC SECURE CONNECTION ESTABLISHED!'));
        peer.on('error', err => console.error('❌ WEBRTC ERROR:', err));

        peer.signal(incomingSignal);
        connectionRef.current = peer;
    }
  };

  // 4. SCREEN SHARE (Upgraded)
  const toggleScreenShare = async () => {
    if (!isSharing && connectionRef.current) {
      try {
        const screenStr = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStr.getVideoTracks()[0];
        const webCamTrack = stream.getVideoTracks()[0];
        
        // 1. Send screen to peer
        connectionRef.current.replaceTrack(webCamTrack, screenTrack, stream);
        // 2. Show screen on our own local preview
        myVideoRef.current.srcObject = screenStr;

        // If user clicks the native browser "Stop Sharing" button floating at the bottom
        screenTrack.onended = () => {
          connectionRef.current.replaceTrack(screenTrack, webCamTrack, stream);
          myVideoRef.current.srcObject = stream;
          setIsSharing(false);
        };

        setIsSharing(true);
      } catch (err) {
        console.error("Screen share failed", err);
      }
    } else if (isSharing) {
      // If user clicks our red app button to stop sharing
      const currentScreenTrack = myVideoRef.current.srcObject.getVideoTracks()[0];
      const webCamTrack = stream.getVideoTracks()[0];
      
      connectionRef.current.replaceTrack(currentScreenTrack, webCamTrack, stream);
      myVideoRef.current.srcObject = stream;
      currentScreenTrack.stop(); // Turn off the screen recording light
      setIsSharing(false);
    }
  };

  // 5. CONTROLS
  const toggleMute = () => {
    if (stream?.getAudioTracks()[0]) {
      stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream?.getVideoTracks()[0]) {
      stream.getVideoTracks()[0].enabled = !stream.getVideoTracks()[0].enabled;
      setIsVideoOff(!isVideoOff);
    }
  };

  // 6. CHAT
  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    const msg = {
        id: Date.now(),
        sender: 'You',
        realSenderId: myId,
        text: messageInput.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (channelRef.current) {
        channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    }

    setMessages(prev => [...prev, msg]);
    setMessageInput("");
    setShowEmojiPicker(false);
  };

  const handleEndSession = async () => {
     if (roomId) {
         await supabase.from('sessions').update({ status: 'Completed' }).eq('id', roomId);
     }
     navigate('/sessions-log');
  };

  const formatDuration = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-full bg-[#121212] flex flex-col text-white overflow-hidden font-sans">
      
      {/* HEADER */}
      <div className="p-4 bg-black/60 flex justify-between items-center border-b border-white/5 backdrop-blur-xl z-10 relative">
        <div className="flex items-center gap-4">
          <button onClick={handleEndSession} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="text-sm font-black m-0 tracking-tight">{sessionData?.skill_topic || 'Connecting...'}</h2>
            <p className="text-[9px] text-brand-teal font-black uppercase tracking-[0.2em] m-0">Live Exchange Room</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-extrabold tabular-nums tracking-wide text-brand-teal">{formatDuration(duration)}</div>
            <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Duration</div>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div className="bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black uppercase text-red-500">Encrypted P2P</span>
          </div>
        </div>
      </div>

      <div className="flex-grow flex overflow-hidden">
        
        {/* VIDEO GRID */}
        <div className="flex-grow relative p-8 flex flex-col md:flex-row gap-6 justify-center">
          
          {/* PEER VIDEO */}
          <div className="flex-1 relative bg-gray-900/50 rounded-[40px] overflow-hidden border border-white/5 shadow-2xl flex items-center justify-center min-h-[300px]">
             {peerStream ? (
                // Cleaned up Ref to prevent blinking
                <video 
                  autoPlay 
                  playsInline 
                  ref={peerVideoRef} 
                  className="w-full h-full object-cover" 
                />
             ) : (
                <div className="text-center">
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${peerAvatar}`} className="w-24 h-24 rounded-full opacity-20 grayscale mx-auto mb-4" alt="" />
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-widest animate-pulse">Waiting for {peerName}...</p>
                </div>
             )}
             <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span> {peerName}
             </div>
          </div>

          {/* LOCAL VIDEO */}
          <div className="w-full md:w-1/3 relative bg-black rounded-[40px] overflow-hidden border border-brand-teal/30 shadow-2xl flex items-center justify-center min-h-[300px] max-w-sm">
             {isVideoOff ? (
                <div className="text-gray-500 flex flex-col items-center">
                  <i className="fa-solid fa-video-slash text-3xl mb-2"></i>
                  <span className="text-[10px] font-black uppercase tracking-widest mt-1">Camera Off</span>
                </div>
             ) : (
                // Cleaned up Ref to prevent blinking
                <video 
                  autoPlay 
                  playsInline 
                  muted 
                  ref={myVideoRef} 
                  className={`w-full h-full object-cover ${isSharing ? '' : 'scale-x-[-1]'}`} 
                />
             )}
             <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider">
                You {isSharing && "- Sharing Screen"} {isMuted && <i className="fa-solid fa-microphone-slash text-red-500 ml-2"></i>}
             </div>
          </div>
          
        </div>

        {/* CHAT SIDEBAR */}
        <div className="w-[360px] bg-black/40 border-l border-white/5 flex flex-col hidden xl:flex backdrop-blur-md">
          <div className="p-6 border-b border-white/5"><h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Session Context</h4></div>
          
          <div className="flex-grow p-6 overflow-y-auto space-y-6">
             {messages.map((msg) => (
               <div key={msg.id} className="flex gap-4 animate-fade-in">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-white">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.realSenderId === myId ? 'User' : peerAvatar}`} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className={`text-[10px] font-black uppercase tracking-wider ${msg.realSenderId === myId ? 'text-blue-400' : 'text-brand-teal'}`}>
                         {msg.realSenderId === myId ? 'You' : peerName}
                      </p>
                      <span className="text-[8px] font-bold text-gray-600">{msg.time}</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed break-words">{msg.text}</p>
                  </div>
               </div>
             ))}
             <div ref={chatEndRef} />
          </div>

          <div className="p-6 border-t border-white/5 bg-black/20 relative">
             {showEmojiPicker && (
               <div className="absolute bottom-24 left-6 bg-gray-900 border border-white/10 shadow-2xl rounded-2xl p-4 grid grid-cols-5 gap-3 z-50">
                 {['👍', '💡', '🔥', '✅', '🚀'].map(e => <button key={e} onClick={() => {setMessageInput(prev => prev + e); setShowEmojiPicker(false)}} className="text-xl hover:scale-125">{e}</button>)}
               </div>
             )}
             <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-brand-teal transition-colors">
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-gray-400 hover:text-white"><i className="fa-regular fa-face-smile text-sm"></i></button>
                <input 
                  type="text" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Send to chat..." 
                  className="w-full bg-transparent text-xs text-white outline-none placeholder-gray-600 py-1.5" 
                />
                <button onClick={handleSendMessage} disabled={!messageInput.trim()} className="w-8 h-8 rounded-full bg-brand-teal disabled:bg-white/10 flex items-center justify-center transition-colors">
                  <i className="fa-solid fa-paper-plane text-[10px] text-white ml-[-2px]"></i>
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="p-6 bg-black/80 flex justify-center items-center gap-6 relative border-t border-white/5 backdrop-blur-2xl z-10">
        <button onClick={toggleMute} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 shadow-red-500/20' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}>
          <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
        </button>
        <button onClick={toggleVideo} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500 shadow-red-500/20' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}>
          <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-lg`}></i>
        </button>
        <button onClick={toggleScreenShare} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isSharing ? 'bg-brand-teal shadow-brand-teal/20' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}>
          <i className="fa-solid fa-desktop text-base"></i>
        </button>
        <div className="h-10 w-px bg-white/10 mx-2"></div>
        <button onClick={handleEndSession} className="bg-red-500 hover:bg-red-600 font-black px-10 py-4 rounded-2xl transition-all shadow-red-500/30 uppercase text-xs">
          Leave Room
        </button>
      </div>

    </div>
  );
};

export default LiveSession;