import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Peer = window.SimplePeer;
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const InstantMeet = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room');
  
  const [peers, setPeers] = useState([]);
  const userStream = useRef(null);
  const peersRef = useRef({});
  const channelRef = useRef(null);
  const myVideoRef = useRef(null);

  // If no room is provided, generate one and redirect
  useEffect(() => {
    if (!roomId) {
      const newRoom = Math.random().toString(36).substring(2, 12);
      navigate(`/instant-meet?room=${newRoom}`, { replace: true });
    }
  }, [roomId, navigate]);

  useEffect(() => {
    if (!roomId) return;

    const initRoom = async () => {
      const { data: { session: auth } } = await supabase.auth.getSession();
      const myId = auth?.user?.id || `guest-${Math.random()}`;

      try {
        userStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (myVideoRef.current) myVideoRef.current.srcObject = userStream.current;
      } catch (err) {
        alert("Camera/Mic required for Instant Meet.");
        return;
      }

      const channel = supabase.channel(`instant-${roomId}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'new-user' }, (payload) => {
          const newUserId = payload.payload.callerId;
          // Create an offer for the new user
          const peer = new Peer({ initiator: true, stream: userStream.current, config: ICE_SERVERS });
          
          peer.on('signal', signal => {
            channel.send({ type: 'broadcast', event: 'signal', payload: { signal, target: newUserId, callerId: myId } });
          });

          peer.on('stream', stream => {
            addPeerStream(newUserId, stream);
          });

          peersRef.current[newUserId] = peer;
        })
        .on('broadcast', { event: 'signal' }, (payload) => {
          const { signal, target, callerId } = payload.payload;
          
          // Only process signals meant for me
          if (target === myId) {
            if (peersRef.current[callerId]) {
              peersRef.current[callerId].signal(signal);
            } else {
              // I am receiving an offer, generate answer
              const peer = new Peer({ initiator: false, stream: userStream.current, config: ICE_SERVERS });
              
              peer.on('signal', answerSignal => {
                channel.send({ type: 'broadcast', event: 'signal', payload: { signal: answerSignal, target: callerId, callerId: myId } });
              });

              peer.on('stream', stream => {
                addPeerStream(callerId, stream);
              });

              peer.signal(signal);
              peersRef.current[callerId] = peer;
            }
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Announce myself to the room so others can call me
            channel.send({ type: 'broadcast', event: 'new-user', payload: { callerId: myId } });
          }
        });
    };

    initRoom();

    return () => {
      if (userStream.current) userStream.current.getTracks().forEach(t => t.stop());
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      Object.values(peersRef.current).forEach(peer => peer.destroy());
    };
  }, [roomId]);

  const addPeerStream = (id, stream) => {
    setPeers(prev => {
      if (prev.find(p => p.id === id)) return prev;
      return [...prev, { id, stream }];
    });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Invite link copied to clipboard!");
  };

  return (
    <div className="h-screen bg-[#121212] flex flex-col text-white">
      <div className="p-4 bg-black/50 flex justify-between items-center border-b border-white/10">
        <h2 className="font-black text-brand-teal uppercase tracking-widest">Instant Room</h2>
        <div className="flex gap-4">
            <button onClick={copyInviteLink} className="bg-brand-navy hover:bg-brand-teal px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                <i className="fa-solid fa-link mr-2"></i> Copy Invite
            </button>
            <button onClick={() => navigate('/dashboard')} className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                Leave
            </button>
        </div>
      </div>

      {/* MULTI-PEER GRID */}
      <div className="flex-grow p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
        
        {/* MY VIDEO */}
        <div className="bg-black rounded-3xl overflow-hidden relative border-2 border-brand-teal aspect-video">
          <video autoPlay playsInline muted ref={myVideoRef} className="w-full h-full object-cover scale-x-[-1]" />
          <span className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-[10px] font-black uppercase">You</span>
        </div>

        {/* EVERYONE ELSE'S VIDEO */}
        {peers.map(peer => (
          <div key={peer.id} className="bg-gray-900 rounded-3xl overflow-hidden relative aspect-video">
            <video 
              autoPlay 
              playsInline 
              ref={v => { if (v && peer.stream) v.srcObject = peer.stream }} 
              className="w-full h-full object-cover" 
            />
            <span className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-[10px] font-black uppercase">Guest</span>
          </div>
        ))}
        
      </div>
    </div>
  );
};

export default InstantMeet;