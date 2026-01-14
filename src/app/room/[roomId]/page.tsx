"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import SimplePeer, { Instance as PeerInstance, SignalData } from "simple-peer";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, MessageSquare, Send, Users } from "lucide-react";

// Types
interface PeerRef {
  peerId: string;
  peer: PeerInstance;
  userName?: string;
  stream?: MediaStream;
}

interface Message {
  userName: string;
  message: string;
  time: string;
}

const Video = ({ stream, userName }: { stream?: MediaStream; userName?: string }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      // Explicitly play to enable video on mobile browsers
      ref.current.play().catch((err) => {
          console.error("Error playing video:", err);
      });
    }
  }, [stream]);

  return (
    <div onClick={() => ref.current?.play()} className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-lg border border-[#3c4043]">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm font-medium backdrop-blur-md">
        {userName || "Participant"}
      </div>
    </div>
  );
};

export default function Room() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const roomId = params.roomId as string;
  const userName = searchParams.get("name");

  const [peers, setPeers] = useState<PeerRef[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [restartingMode, setRestartingMode] = useState<'audio' | 'video' | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<PeerRef[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userName) {
      router.push("/");
      return;
    }

    // Check for Secure Context
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera/Microphone access is blocked. This browser requires a secure connection (HTTPS) or localhost to access media devices. If you are on a local network (http://192.168...), you must configure your browser to treat this origin as secure.");
      return;
    }

    // Initialize Socket
    const socketRx = io(); 
    
    socketRef.current = socketRx;
    setSocket(socketRx);

    // Get User Media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      streamRef.current = currentStream;
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }

      socketRx.emit("join-room", roomId, socketRx.id, userName);

      socketRx.on("error", (msg) => {
        alert(msg);
        router.push("/");
      });

      socketRx.on("user-connected", (userId: string, remoteUserName: string) => {
        // Check for duplicate
        if (peersRef.current.some(p => p.peerId === userId)) return;

        const peer = createPeer(userId, socketRx.id!, currentStream);
        peersRef.current.push({
          peerId: userId,
          peer,
          userName: remoteUserName
        });
        setPeers((prev) => {
            // Check in state as well just in case
            if (prev.some(p => p.peerId === userId)) return prev;
            return [...prev, { peerId: userId, peer, userName: remoteUserName }];
        });
      });

      socketRx.on("user-disconnected", (userId: string) => {
          const peerObj = peersRef.current.find(p => p.peerId === userId);
          if(peerObj) peerObj.peer.destroy();
          const peers = peersRef.current.filter(p => p.peerId !== userId);
          peersRef.current = peers;
          setPeers((prev) => prev.filter(p => p.peerId !== userId));
      });

      socketRx.on("offer", (payload: { offer: SignalData, from: string }) => {
        // Check for duplicate
        if (peersRef.current.some(p => p.peerId === payload.from)) return;

        const peer = addPeer(payload.offer, payload.from, currentStream);
        peersRef.current.push({
            peerId: payload.from,
            peer,
            userName: "Participant" 
        });
        setPeers((prev) => {
            if (prev.some(p => p.peerId === payload.from)) return prev;
            return [...prev, { peerId: payload.from, peer, userName: "Participant" }];
        });
      });

      socketRx.on("answer", (payload: { answer: SignalData, from: string }) => {
        const item = peersRef.current.find((p) => p.peerId === payload.from);
        if (item) {
          item.peer.signal(payload.answer);
        }
      });

      socketRx.on("ice-candidate", (payload: { candidate: SignalData, from: string }) => {
        const item = peersRef.current.find((p) => p.peerId === payload.from);
        if (item) {
          item.peer.signal(payload.candidate);
        }
      });

      socketRx.on("receive-message", (msg: Message) => {
        setMessages((prev) => [...prev, msg]);
      });
    })
    .catch(err => {
        console.error("Error accessing media devices:", err);
        setError("Could not access camera/microphone. Please check permissions.");
    });

    return () => {
        socketRx.disconnect();
        peersRef.current.forEach(p => p.peer.destroy());
    };
  }, [roomId, userName, router]);

  // Audio & Video Activity Monitor & Auto-Restart
  useEffect(() => {
    if (!stream || restartingMode) return;
    
    // Audio Context Setup
    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let dataArray: Uint8Array;
    let bufferLength: number;
    
    // Only set up audio monitoring if not muted
    if (!muted) {
        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            analyser.fftSize = 256;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        } catch (e) {
            console.error("Failed to initialize audio context", e);
        }
    }

    let silenceStart = Date.now();
    const SILENCE_THRESHOLD = 10; 
    const SILENCE_DURATION = 10000; 

    // Video State Monitoring
    let videoCheckInterval: NodeJS.Timeout;

    const checkMediaHealth = () => {
       if (restartingMode) return;
       
       // 1. Check Audio
       if (!muted && analyser && dataArray) {
           analyser.getByteFrequencyData(dataArray as any);
           let sum = 0;
           for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
           const average = sum / bufferLength;

           if (average < SILENCE_THRESHOLD) {
             if (Date.now() - silenceStart > SILENCE_DURATION) {
                 console.warn("Audio silence detected for 10s. Restarting audio...");
                 restartMedia('audio');
                 silenceStart = Date.now();
                 return;
             }
           } else {
             silenceStart = Date.now();
           }
       }

       // 2. Check Video
       if (!videoOff && stream) {
           const videoTrack = stream.getVideoTracks()[0];
           if (videoTrack) {
               // Check if track is unexpectedly ended or muted
               if (videoTrack.readyState === 'ended' || videoTrack.muted) {
                   console.warn("Video track ended or muted unexpectedly. Restarting video...", videoTrack.readyState, videoTrack.muted);
                   restartMedia('video');
                   return;
               }
           }
       }

       requestAnimationFrame(checkMediaHealth);
    };

    const animationId = requestAnimationFrame(checkMediaHealth);

    return () => {
      cancelAnimationFrame(animationId);
      if(audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, [stream, muted, videoOff, restartingMode]);

  const restartMedia = async (type: 'audio' | 'video') => {
      if (restartingMode || !streamRef.current) return;
      setRestartingMode(type);

      try {
          const oldTracks = type === 'audio' 
            ? streamRef.current.getAudioTracks() 
            : streamRef.current.getVideoTracks();
          
          oldTracks.forEach(t => t.stop());

          // Get new stream logic
          // Note: We request BOTH if possible to ensure we get a fresh coherent stream, 
          // but typically we just need the specific track. 
          // Requesting just one might be faster/simpler.
          const constraints = type === 'audio' ? { audio: true } : { video: true };
          const newStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          const newTrack = type === 'audio' 
            ? newStream.getAudioTracks()[0] 
            : newStream.getVideoTracks()[0];

          // Replace in local stream
          const currentStream = streamRef.current;
          if (type === 'audio') {
              const old = currentStream.getAudioTracks()[0];
              if (old) currentStream.removeTrack(old);
              currentStream.addTrack(newTrack);
          } else {
              const old = currentStream.getVideoTracks()[0];
              if (old) currentStream.removeTrack(old);
              currentStream.addTrack(newTrack);
              
              // Force local video element update if video changed
              if (userVideo.current) {
                  userVideo.current.srcObject = currentStream;
                  // Important: Trigger play again
                  userVideo.current.play().catch(e => console.error("Error playing resized video", e));
              }
          }
          
          // Replace in all peer connections
          await Promise.all(peersRef.current.map(async (peerObj) => {
              if (peerObj.peer && !peerObj.peer.destroyed) {
                  try {
                      const oldTrack = oldTracks[0]; // The one we stopped
                      // We need to pass the stream as the 3rd arg to replaceTrack in some versions of simple-peer/webrtc,
                      // but simplest is replaceTrack(old, new, stream)
                      await peerObj.peer.replaceTrack(oldTrack, newTrack, currentStream);
                  } catch (e) {
                      console.error(`Error replacing ${type} track for peer ${peerObj.peerId}`, e);
                  }
              }
          }));

      } catch (err) {
          console.error(`Failed to restart ${type}:`, err);
          // Only show fatal error if it's audio, video we might just let slide or show toast
          if (type === 'audio') {
             setError("Microphone stopped working and could not be restarted.");
          }
      } finally {
          setRestartingMode(null);
      }
  };

  function createPeer(userToSignal: string, callerID: string, stream: MediaStream) {
    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
        ],
      },
    });

    peer.on("signal", (signal) => {
      if ('candidate' in signal) {
        socketRef.current?.emit("ice-candidate", { candidate: signal, to: userToSignal });
      } else {
        socketRef.current?.emit("offer", { offer: signal, to: userToSignal });
      }
    });
    
    peer.on("error", (err) => {
        console.error("Peer connection error (initiator):", err);
    });

    peer.on("stream", (remoteStream) => {
        setPeers((prev) => prev.map(p => {
            if (p.peerId === userToSignal) {
                return { ...p, stream: remoteStream };
            }
            return p;
        }));
        // Update ref as well to keep in sync
        const peerObj = peersRef.current.find(p => p.peerId === userToSignal);
        if (peerObj) peerObj.stream = remoteStream;
    });

    return peer;
  }

  function addPeer(incomingSignal: SignalData, callerID: string, stream: MediaStream) {
    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
        ],
      },
    });

    peer.on("signal", (signal) => {
      if ('candidate' in signal) {
        socketRef.current?.emit("ice-candidate", { candidate: signal, to: callerID });
      } else {
        socketRef.current?.emit("answer", { answer: signal, to: callerID });
      }
    });
    
    peer.on("error", (err) => {
        console.error("Peer connection error (receiver):", err);
    });

    peer.on("stream", (remoteStream) => {
         setPeers((prev) => prev.map(p => {
            if (p.peerId === callerID) {
                return { ...p, stream: remoteStream };
            }
            return p;
        }));
        const peerObj = peersRef.current.find(p => p.peerId === callerID);
        if (peerObj) peerObj.stream = remoteStream;
    });

    peer.signal(incomingSignal);

    return peer;
  }

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg) return;

    socketRef.current?.emit("send-message", roomId, inputMsg, userName);
    setMessages((prev) => [...prev, { userName: "You", message: inputMsg, time: new Date().toLocaleTimeString() }]);
    setInputMsg("");
  };

  const toggleMute = () => {
    if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => track.enabled = !track.enabled);
        setMuted(!muted);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach(track => track.enabled = !track.enabled);
        setVideoOff(!videoOff);
    }
  };

  const leaveRoom = () => {
      router.push('/');
  };

  if (error) {
    return (
        <div className="flex items-center justify-center h-screen bg-[#202124] text-white p-8 text-center">
            <div className="bg-red-900/50 p-8 rounded-2xl border border-red-500/50 max-w-2xl">
                <h1 className="text-2xl font-bold mb-4 text-red-400">Connection Error</h1>
                <p className="mb-6 text-lg">{error}</p>
                <div className="bg-black/40 p-4 rounded text-left text-sm font-mono text-gray-300">
                    <p className="mb-2 font-bold text-gray-400">To fix this in Opera/Chrome:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Go to <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> (or opera://...)</li>
                        <li>Enable the &quot;Insecure origins treated as secure&quot; flag.</li>
                        <li>Add your IP address to the text box (e.g., <code>http://192.168.1.5:3000</code>).</li>
                        <li>Relaunch the browser.</li>
                    </ol>
                </div>
                <button onClick={() => router.push('/')} className="mt-8 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
                    Back to Home
                </button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#202124] overflow-hidden text-white font-sans">
      {restartingMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-500/90 text-black px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 animate-pulse">
              {restartingMode === 'audio' ? <MicOff size={18} /> : <VideoOff size={18} />}
              <span>Restarting {restartingMode === 'audio' ? 'Audio' : 'Video'} Service...</span>
          </div>
      )}
      {/* Main Video Area */}
      <div className={`flex-1 flex flex-col p-4 transition-all duration-300 ${showChat ? 'mr-0' : 'mr-0'}`}>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
           {/* My Video */}
           <div className="relative bg-black rounded-xl overflow-hidden shadow-lg border border-[#3c4043]">
              <video muted ref={userVideo} autoPlay playsInline className={`w-full h-full object-cover ${videoOff ? 'hidden' : ''}`} />
              {videoOff && <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043] text-2xl font-bold">{userName?.charAt(0).toUpperCase()}</div>}
              <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm font-medium backdrop-blur-md">
                You {muted && "(Muted)"}
              </div>
           </div>
           
           {peers.map((peerRef) => (
             <Video key={peerRef.peerId} stream={peerRef.stream} userName={peerRef.userName} />
           ))}
        </div>

        {/* Controls Bar */}
        <div className="h-20 mt-4 flex items-center justify-center gap-4">
             <button onClick={toggleMute} className={`p-4 rounded-full ${muted ? 'bg-red-600 text-white' : 'bg-[#3c4043] text-gray-200'} hover:opacity-80 transition-all`}>
                {muted ? <MicOff size={24} /> : <Mic size={24} />}
             </button>
             <button onClick={toggleVideo} className={`p-4 rounded-full ${videoOff ? 'bg-red-600 text-white' : 'bg-[#3c4043] text-gray-200'} hover:opacity-80 transition-all`}>
                {videoOff ? <VideoOff size={24} /> : <VideoIcon size={24} />}
             </button>
             <button onClick={leaveRoom} className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all px-8 flex items-center gap-2">
                <PhoneOff size={24} />
             </button>
             <button onClick={() => setShowChat(!showChat)} className={`p-4 rounded-full ${showChat ? 'bg-blue-600 text-white' : 'bg-[#3c4043] text-gray-200'} hover:opacity-80 transition-all`}>
                <MessageSquare size={24} />
             </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div className="w-80 bg-[#202124] border-l border-[#3c4043] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-[#3c4043] flex items-center justify-between">
                <h2 className="font-medium text-lg">In-call messages</h2>
                <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">x</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.userName === 'You' ? 'items-end' : 'items-start'}`}>
                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                            <span className="font-bold text-gray-300">{msg.userName}</span>
                            <span>{msg.time}</span>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] ${msg.userName === 'You' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[#3c4043] text-gray-200 rounded-tl-sm'}`}>
                            {msg.message}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-[#3c4043]">
                <form onSubmit={sendMessage} className="relative">
                    <input 
                        type="text" 
                        value={inputMsg}
                        onChange={(e) => setInputMsg(e.target.value)}
                        placeholder="Send a message..." 
                        className="w-full bg-[#303339] text-white rounded-full pl-5 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
                    />
                    <button type="submit" disabled={!inputMsg} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-transparent text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors">
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
