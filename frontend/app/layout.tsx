'use client';

import { useState, useEffect } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HelpCircle } from "lucide-react";
import HelpModal from "@/components/HelpModal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Note: metadata export is not allowed in client components
// This is now handled by the page.tsx or via next.config.js

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Keyboard shortcut to open help (? or F1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open help with ? key (Shift + /)
      if (e.key === '?' && !isHelpOpen) {
        e.preventDefault();
        setIsHelpOpen(true);
      }
      // Open help with F1 key
      if (e.key === 'F1' && !isHelpOpen) {
        e.preventDefault();
        setIsHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHelpOpen]);

  return (
    <html lang="en">
      <head>
        <title>Knowledge Robot</title>
        <meta name="description" content="An agentic AI that automates repetitive knowledge work — web research, browsing, data extraction, structured note-taking." />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Help Button - Fixed position */}
        <button
          onClick={() => setIsHelpOpen(true)}
          className="
            fixed top-4 right-4 z-40 p-3
            bg-gradient-to-r from-indigo-500 to-indigo-600 text-white
            rounded-xl shadow-lg shadow-indigo-500/25
            hover:from-indigo-600 hover:to-indigo-700 hover:shadow-xl hover:shadow-indigo-500/30
            hover:scale-105 active:scale-95
            transition-all duration-200
          "
          title="Help (Press ? or F1)"
          aria-label="Open help"
        >
          <HelpCircle size={22} />
        </button>

        {/* Main Content */}
        {children}

        {/* Help Modal */}
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </body>
    </html>
  );
}
