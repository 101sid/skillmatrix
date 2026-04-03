import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Peer = window.SimplePeer;
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

const LiveSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('id') || searchParams.get('room');

  // --- REFS ---
  const myVideoRef = useRef(null);
  const peerVideoRef = useRef(null);
  const connectionRef = useRef(null);
  const channelRef = useRef(null);
  const chatEndRef = useRef(null);
  const animationRef = useRef(null); // For the Canvas Compositor

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
  const [audioBlocked, setAudioBlocked] = useState(false); // 👈 For Autoplay Policy
  
  // Chat
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  // 1. INITIALIZATION & SIGNALING
  useEffect(() => {
    let localStream = null;

    const init = async () => {
      if (!roomId) return navigate('/dashboard');

      const { data: { session: auth } } = await supabase.auth.getSession();
      if (!auth) return;
      setMyId(auth.user.id);

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

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(localStream);
      } catch (err) {
        console.error("Camera Error:", err);
        alert("Please allow camera access.");
        return;
      }

      const channel = supabase.channel(`room-${roomId}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'signal' }, (payload) => {
          if (payload.payload.userId !== auth.user.id) {
             handleIncomingSignal(payload.payload.signal, localStream, auth.user.id);
          }
        })
        .on('broadcast', { event: 'chat' }, (payload) => setMessages(prev => [...prev, payload.payload]))
        .on('broadcast', { event: 'ping' }, () => channel.send({ type: 'broadcast', event: 'pong', payload: {} }))
        .on('broadcast', { event: 'pong' }, () => {
          if (!connectionRef.current) startCall(localStream, auth.user.id);
        })
        .subscribe(async (status) => {
           if (status === 'SUBSCRIBED') channel.send({ type: 'broadcast', event: 'ping', payload: {} });
        });
    };

    init();

    return () => {
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (connectionRef.current) connectionRef.current.destroy();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [roomId, navigate]);

  // 2. TIMERS & CHAT
  useEffect(() => {
    const timer = setInterval(() => setDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  // --- AUDIO POLICY & VIDEO ATTACHMENT ---
  useEffect(() => {
    if (peerVideoRef.current && peerStream) {
      if (peerVideoRef.current.srcObject !== peerStream) {
         peerVideoRef.current.srcObject = peerStream;
         // 👈 FIX: Catch the Autoplay block and alert the user!
         peerVideoRef.current.play().catch(e => {
            if (e.name === 'NotAllowedError') setAudioBlocked(true);
         });
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
    peer.on('signal', data => channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { signal: data, userId } }));
    peer.on('stream', remoteStream => setPeerStream(remoteStream));
    connectionRef.current = peer;
  };

  const handleIncomingSignal = (incomingSignal, myStream, userId) => {
    if (connectionRef.current) {
        connectionRef.current.signal(incomingSignal);
    } else {
        const peer = new Peer({ initiator: false, stream: myStream, config: ICE_SERVERS });
        peer.on('signal', data => channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { signal: data, userId } }));
        peer.on('stream', remoteStream => setPeerStream(remoteStream));
        peer.signal(incomingSignal);
        connectionRef.current = peer;
    }
  };

  // 4. THE CANVAS COMPOSITOR (Screen + Face)
  const toggleScreenShare = async () => {
    if (!isSharing && connectionRef.current) {
      try {
        const screenStr = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStr.getVideoTracks()[0];
        const webCamTrack = stream.getVideoTracks()[0];
        
        // --- CREATE CANVAS TO MERGE BOTH VIDEOS ---
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        const screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStr;
        screenVideo.muted = true;
        screenVideo.play();

        const camVideo = document.createElement('video');
        camVideo.srcObject = stream;
        camVideo.muted = true;
        camVideo.play();

        const drawFrames = () => {
          if (screenVideo.readyState >= 2) {
            ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
          }
          if (camVideo.readyState >= 2) {
            // Draw webcam in bottom right corner with a cool border
            const camW = 320, camH = 180;
            const camX = canvas.width - camW - 20;
            const camY = canvas.height - camH - 20;
            
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(camX, camY, camW, camH, 16);
            ctx.clip();
            ctx.drawImage(camVideo, camX, camY, camW, camH);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#2DD4BF'; // Brand Teal
            ctx.stroke();
            ctx.restore();
          }
          animationRef.current = requestAnimationFrame(drawFrames);
        };
        drawFrames();

        // Capture the canvas at 30 FPS
        const combinedStream = canvas.captureStream(30);
        const combinedVideoTrack = combinedStream.getVideoTracks()[0];

        // Send the combined video to the peer!
        connectionRef.current.replaceTrack(webCamTrack, combinedVideoTrack, stream);
        
        // Show the combined video on our local screen so we see what they see
        myVideoRef.current.srcObject = combinedStream;

        // Cleanup when they click "Stop Sharing" on the browser banner
        screenTrack.onended = () => {
          cancelAnimationFrame(animationRef.current);
          connectionRef.current.replaceTrack(combinedVideoTrack, webCamTrack, stream);
          myVideoRef.current.srcObject = stream;
          setIsSharing(false);
        };

        setIsSharing(true);
      } catch (err) {
        console.error("Screen share failed", err);
      }
    } else if (isSharing) {
      // Manual stop
      cancelAnimationFrame(animationRef.current);
      const currentTrack = myVideoRef.current.srcObject.getVideoTracks()[0];
      const webCamTrack = stream.getVideoTracks()[0];
      
      connectionRef.current.replaceTrack(currentTrack, webCamTrack, stream);
      myVideoRef.current.srcObject = stream;
      
      // Stop the screen sharing track to remove browser banner
      navigator.mediaDevices.getSupportedConstraints();
      setIsSharing(false);
    }
  };

  // 5. CONTROLS & CHAT
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

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    const msg = { id: Date.now(), sender: 'You', realSenderId: myId, text: messageInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    setMessages(prev => [...prev, msg]);
    setMessageInput("");
  };

  const unlockAudio = () => {
    if (peerVideoRef.current) peerVideoRef.current.play();
    setAudioBlocked(false);
  };

  return (
    <div className="h-screen w-full bg-[#121212] flex flex-col text-white overflow-hidden font-sans">
      <div className="p-4 bg-black/60 flex justify-between items-center border-b border-white/5 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="text-sm font-black m-0 tracking-tight">{sessionData?.skill_topic || 'Connecting...'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-extrabold tabular-nums tracking-wide text-brand-teal">
              {Math.floor(duration / 60).toString().padStart(2, '0')}:{(duration % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-grow flex overflow-hidden">
        {/* VIDEOS */}
        <div className="flex-grow relative p-8 flex flex-col md:flex-row gap-6 justify-center">
          
          <div className="flex-1 relative bg-gray-900/50 rounded-[40px] overflow-hidden border border-white/5 flex items-center justify-center min-h-[300px]">
             {/* AUDIO BLOCKER OVERLAY */}
             {audioBlocked && (
               <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center backdrop-blur-md">
                 <i className="fa-solid fa-volume-xmark text-4xl text-brand-teal mb-4 animate-bounce"></i>
                 <p className="font-bold mb-4">Browser blocked audio!</p>
                 <button onClick={unlockAudio} className="bg-brand-teal text-brand-navy px-6 py-2 rounded-full font-black uppercase text-xs hover:scale-105 transition-transform">Click to Unmute</button>
               </div>
             )}

             {peerStream ? (
                <video autoPlay playsInline ref={peerVideoRef} className="w-full h-full object-cover" />
             ) : (
                <div className="text-center">
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${peerAvatar}`} className="w-24 h-24 rounded-full opacity-20 mx-auto mb-4" alt="" />
                   <p className="text-xs font-bold text-gray-500 uppercase">Waiting...</p>
                </div>
             )}
          </div>

          <div className="w-full md:w-1/3 relative bg-black rounded-[40px] overflow-hidden border border-brand-teal/30 flex items-center justify-center min-h-[300px] max-w-sm">
             {isVideoOff ? (
                <div className="text-gray-500 flex flex-col items-center"><i className="fa-solid fa-video-slash text-3xl mb-2"></i></div>
             ) : (
                <video autoPlay playsInline muted ref={myVideoRef} className={`w-full h-full object-cover ${isSharing ? '' : 'scale-x-[-1]'}`} />
             )}
             <div className="absolute bottom-6 left-6 bg-black/60 px-4 py-2 rounded-xl text-[10px] font-black uppercase">
                You {isSharing && "- LIVE"}
             </div>
          </div>
        </div>

        {/* CHAT SIDEBAR */}
        <div className="w-[360px] bg-black/40 border-l border-white/5 flex flex-col hidden xl:flex">
          <div className="flex-grow p-6 overflow-y-auto space-y-6">
             {messages.map((msg) => (
               <div key={msg.id} className="flex gap-4">
                  <div className="flex-grow min-w-0">
                    <p className={`text-[10px] font-black uppercase ${msg.realSenderId === myId ? 'text-blue-400' : 'text-brand-teal'}`}>
                       {msg.realSenderId === myId ? 'You' : peerName}
                    </p>
                    <p className="text-xs text-gray-300">{msg.text}</p>
                  </div>
               </div>
             ))}
             <div ref={chatEndRef} />
          </div>
          <div className="p-6 border-t border-white/5">
             <div className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-2">
                <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Message..." className="w-full bg-transparent text-xs text-white outline-none py-1.5" />
                <button onClick={handleSendMessage} className="text-brand-teal hover:text-teal-400"><i className="fa-solid fa-paper-plane"></i></button>
             </div>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="p-6 bg-black flex justify-center items-center gap-6 border-t border-white/5 z-10">
        <button onClick={toggleMute} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
          <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
        </button>
        <button onClick={toggleVideo} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
          <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-lg`}></i>
        </button>
        <button onClick={toggleScreenShare} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isSharing ? 'bg-brand-teal text-brand-navy' : 'bg-white/10 hover:bg-white/20'}`}>
          <i className="fa-solid fa-desktop text-base"></i>
        </button>
        <div className="h-10 w-px bg-white/10 mx-2"></div>
        <button onClick={() => navigate('/sessions-log')} className="bg-red-500 hover:bg-red-600 font-black px-10 py-4 rounded-2xl transition-all uppercase text-xs">Leave Room</button>
      </div>
    </div>
  );
};

export default LiveSession;