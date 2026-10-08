"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier })
      });
      
      if (!res.ok) throw new Error("Failed to send OTP");
      
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, otp })
      });
      
      if (!res.ok) throw new Error("Invalid OTP");
      
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      
      // Go directly to dashboard (settings) which handles profile completion
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <h1 className="auth-title">Signal Desktop</h1>
        <p className="auth-subtitle">Welcome Back. Sign in or create an account.</p>
        
        {step === "identifier" ? (
          <form onSubmit={handleSendOtp}>
            <div className="input-group">
              <label>Phone Number or Username</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. +1234567890 or @username" 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            
            {error && <p className="error-text" style={{marginBottom: '1rem'}}>{error}</p>}
            
            <button type="submit" className="btn-primary" disabled={loading || !identifier}>
              {loading ? "Sending..." : "Continue"}
            </button>
            <p style={{marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center'}}>
              * Verification will be mocked (OTP: 123456).
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <div className="input-group">
              <label>Enter OTP</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Use 123456 to verify" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            
            {error && <p className="error-text" style={{marginBottom: '1rem'}}>{error}</p>}
            
            <button type="submit" className="btn-primary" disabled={loading || !otp}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            
            <button 
              type="button" 
              className="btn-primary" 
              style={{marginTop: '1rem', backgroundColor: 'transparent', border: '1px solid var(--divider)'}}
              onClick={() => setStep("identifier")}
              disabled={loading}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
