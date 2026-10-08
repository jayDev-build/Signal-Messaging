"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName) {
      setError("Display name is required");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/auth/profile", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ display_name: displayName, avatar_url: avatarUrl || null })
      });
      
      if (!res.ok) throw new Error("Failed to update profile");
      
      router.push("/");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="auth-container glass-panel">
        <h1 className="title">Setup Profile</h1>
        <p className="subtitle">Let your friends know who you are</p>
        
        <form onSubmit={handleSaveProfile}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <img 
              src={avatarUrl || "https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff"} 
              alt="Avatar Preview" 
              className="avatar-preview"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff";
              }}
            />
          </div>

          <div className="input-group">
            <label>Avatar URL (Optional)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="https://example.com/avatar.jpg" 
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label>Display Name</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. John Doe" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          
          {error && <p className="error-text" style={{marginBottom: '1rem'}}>{error}</p>}
          
          <button type="submit" className="btn-primary" disabled={loading || !displayName}>
            {loading ? "Saving..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
