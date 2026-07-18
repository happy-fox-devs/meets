"use client";

import { Video, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1115] overflow-hidden relative">
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-md p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/20">
          <Video className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-2 tracking-tight">NestWorks Meets</h1>
        <p className="text-gray-400 mb-8">Secure video conferencing for NestWorks sessions</p>

        <div className="bg-[#181a1d] border border-[#2d2f34] p-8 rounded-3xl shadow-2xl backdrop-blur-sm">
          <ShieldCheck className="w-8 h-8 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-300 text-sm leading-relaxed">
            There&apos;s no manual join here anymore. Open your booking or session from the
            NestWorks app and use its &quot;Join Call&quot; link — it carries a signed, verified
            token that authorizes you directly.
          </p>
        </div>
      </div>
    </div>
  );
}
