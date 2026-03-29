import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Peer from 'simple-peer';
import Navbar from '../components/Navbar';

const LiveSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('id'); // Using 'id' from your previous SessionDetail logic

  // --- REFS ---
  const myVideoRef = useRef();
  const peerVideoRef = useRef();
  const connectionRef = useRef();
  const channelRef = useRef();

  // --- STATES ---
  const [myId, setMyId] = useState(null);
  const [stream, setStream] = useState();
  const [peerStream, setPeerStream] = useState();
  const [sessionData, setSessionData] = useState(null);
  const [peerName, setPeerName] = useState('Connecting...');
  
  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  // 1. INITIAL SETUP
  useEffect(() => {
    const init = async () => {
      const { data: { session: auth } } = await supabase.auth.getSession();
      setMyId(auth.user.id);

      // Get Session/Peer Data
      const { data } = await supabase
        .from('sessions')
        .select('*, mentor:profiles!sessions_mentor_id_fkey(full_name, avatar_seed), student:profiles!sessions_student_id_fkey(full_name, avatar_seed)')
        .eq('id', roomId)
        .single();
      
      setSessionData(data);
      const isMentor = data.mentor_id === auth.user.id;
      setPeerName(isMentor ? data.student.full_name : data.mentor.full_name);

      // 2. Start Camera
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;

      // 3. Signaling via Supabase
      const channel = supabase.channel(`room-${roomId}`);
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'signal' }, (payload) => {
          // Received a handshake from the other person
          if (payload.payload.userId !== auth.user.id) {
            handleReceivedSignal(payload.payload.signal);
          }
        })
        .on('broadcast', { event: 'chat' }, (payload) => {
          setMessages(prev => [...prev, payload.payload]);
        })
        .subscribe();

      // If you are the student, initiate the call
      if (!isMentor) {
        callPeer(currentStream, auth.user.id);
      }
    };

    init();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [roomId]);

  // 4. WEBRTC LOGIC
  const callPeer = (myStream, userId) => {
    const peer = new Peer({ initiator: true, trickle: false, stream: myStream });

    peer.on('signal', (data) => {
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { signal: data, userId }
      });
    });

    peer.on('stream', (remoteStream) => {
      if (peerVideoRef.current) peerVideoRef.current.srcObject = remoteStream;
      setPeerStream(remoteStream);
    });

    connectionRef.current = peer;
  };

  const handleReceivedSignal = (incomingSignal) => {
    if (connectionRef.current) {
        // If we already have a connection (e.g. Mentor receiving Student's call)
        connectionRef.current.signal(incomingSignal);
    } else {
        // Mentor side: Initialize peer as receiver
        const peer = new Peer({ initiator: false, trickle: false, stream: stream });
        peer.on('signal', (data) => {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { signal: data, userId: myId }
          });
        });
        peer.on('stream', (remoteStream) => {
          if (peerVideoRef.current) peerVideoRef.current.srcObject = remoteStream;
          setPeerStream(remoteStream);
        });
        peer.signal(incomingSignal);
        connectionRef.current = peer;
    }
  };

  // 5. SCREEN SHARE LOGIC
  const handleScreenShare = async () => {
    if (!connectionRef.current) {
    alert("Waiting for peer connection...");
    return;
    }
    if (!isSharing) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      
      connectionRef.current.replaceTrack(
        stream.getVideoTracks()[0],
        videoTrack,
        stream
      );

      videoTrack.onended = () => {
        stopScreenShare();
      };
      setIsSharing(true);
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    const videoTrack = stream.getVideoTracks()[0];
    connectionRef.current.replaceTrack(
      connectionRef.current.streams[0].getVideoTracks()[0],
      videoTrack,
      stream
    );
    setIsSharing(false);
  };

  // 6. CHAT LOGIC
  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    const msg = { 
        id: Date.now(), 
        sender: 'You', 
        text: messageInput, 
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        userId: myId
    };
    
    channelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload: msg
    });

    setMessages(prev => [...prev, msg]);
    setMessageInput("");
  };

  // 7. TOGGLE CONTROLS
  const toggleMute = () => {
    if (stream?.getAudioTracks()[0]) {
    stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
    setIsMuted(!isMuted);
  } else {
    alert("Microphone not found or access denied.");
  }
  };

  const toggleVideo = () => {
    if (stream?.getVideoTracks()[0]) {
    stream.getVideoTracks()[0].enabled = !stream.getVideoTracks()[0].enabled;
    setIsVideoOff(!isVideoOff);
  } else {
    alert("Camera not found or access denied.");
  }
  };

  return (
    <div className="h-screen w-full bg-[#0F0F0F] flex flex-col text-white overflow-hidden">
      {/* HEADER */}
      <div className="p-4 bg-black/40 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-chevron-left"></i></button>
          <h2 className="text-sm font-black uppercase tracking-widest">{sessionData?.skill_topic}</h2>
        </div>
        <div className="bg-brand-teal/10 border border-brand-teal/20 px-3 py-1 rounded-full text-[10px] font-bold text-brand-teal">
           P2P SECURE CONNECTION
        </div>
      </div>

      <div className="flex-grow flex overflow-hidden">
        {/* VIDEO GRID */}
        <div className="flex-grow relative p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PEER VIDEO (The other person) */}
          <div className="relative bg-gray-900 rounded-[32px] overflow-hidden border border-white/5 flex items-center justify-center">
            {peerStream ? (
                <video ref={peerVideoRef} autoPlay className="w-full h-full object-cover" />
            ) : (
                <div className="text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full mx-auto mb-4 animate-pulse flex items-center justify-center">
                        <i className="fa-solid fa-user text-2xl opacity-20"></i>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Waiting for {peerName}...</p>
                </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider">{peerName}</div>
          </div>

          {/* MY VIDEO (Small preview) */}
          <div className="relative bg-gray-900 rounded-[32px] overflow-hidden border border-white/5">
            <video ref={myVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider">You {isMuted && ' (Muted)'}</div>
          </div>
        </div>

        {/* CHAT SIDEBAR */}
        <div className="w-[350px] bg-black/20 border-l border-white/5 flex flex-col backdrop-blur-md">
          <div className="p-6 border-b border-white/5"><h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live Session Chat</h4></div>
          <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4">
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.userId === myId ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2 rounded-2xl text-xs ${m.userId === myId ? 'bg-brand-teal text-white' : 'bg-white/10 text-gray-300'}`}>
                   {m.text}
                </div>
                <span className="text-[8px] font-bold text-gray-600 mt-1 uppercase tracking-tighter">{m.time}</span>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-white/5">
            <input 
              type="text" 
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Message your peer..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-brand-teal"
            />
          </div>
        </div>
      </div>

      {/* CONTROLS HUD */}
      <div className="p-6 bg-black border-t border-white/5 flex justify-center items-center gap-6">
        <button onClick={toggleMute} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500' : 'bg-white/5 hover:bg-white/10'}`}>
          <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
        </button>
        <button onClick={toggleVideo} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500' : 'bg-white/5 hover:bg-white/10'}`}>
          <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
        </button>
        <button onClick={handleScreenShare} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isSharing ? 'bg-brand-teal' : 'bg-white/5 hover:bg-white/10'}`}>
          <i className="fa-solid fa-desktop"></i>
        </button>
        <button onClick={() => navigate(-1)} className="bg-red-500 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
          Leave Room
        </button>
      </div>
    </div>
  );
};

export default LiveSession;