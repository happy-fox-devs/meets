"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Users, Lock, ArrowRight } from "lucide-react";

export default function Home() {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !roomId) return;
    // Pass name and roomId via query params or state (for MVP, straightforward query params or localStorage)
    // We'll use query params to the room page for simplicity
    router.push(`/room/${roomId}?name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115] overflow-hidden relative">
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-md p-8">
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/20">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2 tracking-tight">Meet Clone</h1>
          <p className="text-gray-400">Secure video conferencing for your team</p>
        </div>

        <div className="bg-[#181a1d] border border-[#2d2f34] p-8 rounded-3xl shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">Display Name (Whitelist)</label>
              <div className="relative">
                <Users className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Enter your name (e.g. user1)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field pl-12"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">Room ID</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Enter room ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="input-field pl-12"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!name || !roomId}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Join Meeting
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Only whitelisted users can join.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
