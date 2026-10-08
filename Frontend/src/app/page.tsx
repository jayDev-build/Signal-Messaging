"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  MessageCircle,
  Phone,
  CircleDashed,
  Settings,
  Search,
  Edit,
  MoreHorizontal,
  User,
  Heart,
  Moon,
  Bell,
  Lock,
  Database,
  DownloadCloud,
  LogOut,
  Pencil,
  Filter,
  Send,
  Plus
} from "lucide-react";

export default function SignalDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"chats" | "settings">("chats");

  // Settings State
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Chat State
  const [messageText, setMessageText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Mock Active Chat for UI demonstration
  const [activeChat, setActiveChat] = useState<any>(null);
  const mockContacts: any[] = [];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

  const [isNavExpanded, setIsNavExpanded] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:8000/auth/me", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!res.ok) throw new Error("Not authenticated");

        const data = await res.json();
        setUser(data);
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");
      } catch (err) {
        localStorage.removeItem("token");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${user.id}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          setActiveChat(prev => {
            // Only append if we are currently chatting with the sender
            if (prev && prev.id === data.message.sender_id) {
              const newMsg = { text: data.message.text, out: false, time: "Just now" };
              return {
                ...prev,
                messages: prev.messages ? [...prev.messages, newMsg] : [newMsg]
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("WS Error:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [user]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://127.0.0.1:8000/auth/search?query=${encodeURIComponent(searchQuery)}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ display_name: displayName, avatar_url: avatarUrl || null, username: username || null })
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.detail || "Failed to update profile");
        return;
      }

      setUser({ ...user, display_name: displayName, avatar_url: avatarUrl, username });
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChat) return;

    setSendingMsg(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/auth/message/first", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          target_user_id: activeChat.id,
          text: messageText.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Failed to send message");
        return;
      }

      // Update UI optimistically
      const newMsg = { text: messageText.trim(), out: true, time: "Just now" };
      setActiveChat({
        ...activeChat,
        messages: activeChat.messages ? [...activeChat.messages, newMsg] : [newMsg]
      });
      setMessageText("");
    } catch (e) {
      console.error(e);
      alert("Error sending message");
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) return <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  if (!user) return null;

  const displayInitial = displayName ? displayName.charAt(0).toLowerCase() : user.phone?.charAt(0) || "?";

  return (
    <div className="app-container">
      {/* 1. Thin Nav (Leftmost) */}
      <div className={`thin-nav ${isNavExpanded ? 'expanded' : ''}`}>
        <div className="thin-nav-item" onClick={() => setIsNavExpanded(!isNavExpanded)}>
          <div className="thin-nav-item-icon"><Menu size={22} strokeWidth={1.5} /></div>
          {isNavExpanded && <span className="thin-nav-item-label">Menu</span>}
        </div>
        <div className={`thin-nav-item ${view === "chats" ? "active" : ""}`} onClick={() => setView("chats")}>
          <div className="thin-nav-item-icon"><MessageCircle size={22} strokeWidth={1.5} fill={view === "chats" ? "currentColor" : "none"} /></div>
          {isNavExpanded && <span className="thin-nav-item-label">Chats</span>}
        </div>
        <div className="thin-nav-item">
          <div className="thin-nav-item-icon"><Phone size={22} strokeWidth={1.5} /></div>
          {isNavExpanded && <span className="thin-nav-item-label">Calls</span>}
        </div>
        <div className="thin-nav-item">
          <div className="thin-nav-item-icon"><CircleDashed size={22} strokeWidth={1.5} /></div>
          {isNavExpanded && <span className="thin-nav-item-label">Stories</span>}
        </div>

        <div className="thin-nav-spacer"></div>

        <div className={`thin-nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>
          <div className="thin-nav-item-icon"><Settings size={22} strokeWidth={1.5} fill={view === "settings" ? "currentColor" : "none"} /></div>
          {isNavExpanded && <span className="thin-nav-item-label">Settings</span>}
        </div>
      </div>

      {/* 2. Sidebar (Middle) */}
      <div className="sidebar">
        {view === "chats" ? (
          <>
            <div className="sidebar-header">
              <span>Chats</span>
              <div className="sidebar-header-icons">
                <button><Edit size={18} strokeWidth={2} /></button>
                <button><MoreHorizontal size={18} strokeWidth={2} /></button>
              </div>
            </div>

            <div className="search-container">
              <div className="search-input-wrapper">
                <Search size={16} color="var(--text-secondary)" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Filter size={16} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {searchQuery.length >= 2 ? (
                searchResults.length > 0 ? (
                  searchResults.map(contact => (
                    <div
                      key={contact.id}
                      className={`chat-list-item ${activeChat?.id === contact.id ? 'active' : ''}`}
                      onClick={() => setActiveChat({
                        id: contact.id,
                        name: contact.display_name || contact.username,
                        initial: (contact.display_name || contact.username || "?").charAt(0).toLowerCase(),
                        avatar: contact.avatar_url
                      })}
                    >
                      <div className="avatar" style={{ background: '#60a5fa' }}>
                        {contact.avatar_url ? <img src={contact.avatar_url} alt="Avatar" /> : (contact.display_name || contact.username || "?").charAt(0).toLowerCase()}
                      </div>
                      <div className="chat-info">
                        <div className="chat-name-row">
                          <span className="chat-name">{contact.display_name || contact.username}</span>
                        </div>
                        <div className="chat-preview">@{contact.username}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {isSearching ? "Searching..." : "No users found"}
                  </div>
                )
              ) : (
                mockContacts.map(contact => (
                  <div
                    key={contact.id}
                    className={`chat-list-item ${activeChat?.id === contact.id ? 'active' : ''}`}
                    onClick={() => setActiveChat(contact)}
                  >
                    <div className="avatar">
                      {contact.avatar ? <img src={contact.avatar} alt="Avatar" /> : contact.initial}
                    </div>
                    <div className="chat-info">
                      <div className="chat-name-row">
                        <span className="chat-name">{contact.name}</span>
                        <span className="chat-time">Now</span>
                      </div>
                      <div className="chat-preview">Hi</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="sidebar-header">
              Settings
            </div>

            <div className="user-card" onClick={() => { }}>
              <div className="avatar" style={{ width: 48, height: 48, background: '#fca5a5' }}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="User Avatar" />
                ) : (
                  displayInitial
                )}
              </div>
              <div className="user-card-info">
                <span className="user-card-name">{user.display_name || "Unknown"}</span>
                <span className="user-card-phone">{user.phone || `@${user.username}`}</span>
              </div>
            </div>

            <div className="settings-menu">
              <div className="nav-item active">
                <User className="nav-icon" size={20} />
                <span>Account</span>
              </div>
              <div className="nav-item">
                <Heart className="nav-icon" size={20} />
                <span>Donate to Signal</span>
              </div>
              <div className="nav-item">
                <Settings className="nav-icon" size={20} />
                <span>General</span>
              </div>
              <div className="nav-item">
                <Moon className="nav-icon" size={20} />
                <span>Appearance</span>
              </div>
              <div className="nav-item">
                <MessageCircle className="nav-icon" size={20} />
                <span>Chats</span>
              </div>
              <div className="nav-item">
                <Phone className="nav-icon" size={20} />
                <span>Calls</span>
              </div>
              <div className="nav-item">
                <Bell className="nav-icon" size={20} />
                <span>Notifications</span>
              </div>
              <div className="nav-item">
                <Lock className="nav-icon" size={20} />
                <span>Privacy</span>
              </div>
              <div className="nav-item">
                <Database className="nav-icon" size={20} />
                <span>Data usage</span>
              </div>
              <div className="nav-item">
                <DownloadCloud className="nav-icon" size={20} />
                <span>Backups</span>
              </div>

              <div style={{ marginTop: '2rem' }}></div>

              <div className="nav-item" onClick={handleLogout} style={{ color: '#ff6b6b' }}>
                <LogOut className="nav-icon" size={20} style={{ color: '#ff6b6b' }} />
                <span>Logout</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Main Content (Right) */}
      <div className="main-content">
        {view === "chats" ? (
          activeChat ? (
            <>
              <div className="main-header">
                <div className="avatar" style={{ width: 32, height: 32, fontSize: '1rem', background: '#fca5a5' }}>
                  {activeChat.initial}
                </div>
                <span>{activeChat.name}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', color: 'var(--text-secondary)' }}>
                  <Phone size={20} />
                  <Settings size={20} />
                </div>
              </div>

              <div className="chat-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div className="chat-profile-banner">
                    <div className="avatar" style={{ background: '#60a5fa' }}>
                      {activeChat.initial}
                    </div>
                    <div className="chat-profile-name">{activeChat.name} &gt;</div>
                    <div className="chat-profile-badges">
                      <div className="chat-badge">
                        <User size={16} /> Name not verified
                      </div>
                      <div className="chat-badge-secondary">
                        <User size={14} /> No groups in common
                      </div>
                    </div>
                  </div>

                  <div className="message-list" style={{ display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                    {activeChat.messages && activeChat.messages.length > 0 ? (
                      <>
                        <div className="message-divider">
                          <span>1 Unread Message</span>
                        </div>
                        <div className="message-date">Today</div>
                        {activeChat.messages.map((msg: any, idx: number) => (
                          <div key={idx} className={`message-bubble ${msg.out ? 'out' : ''}`} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                            <span>{msg.text}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{msg.time || 'Now'}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: 'auto' }}>
                        <p>No messages yet.</p>
                        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Send a message to start the conversation.</p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="chat-input-area" style={{ padding: '1rem 2rem', borderTop: '1px solid var(--divider)', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-main)', marginTop: 'auto' }}>
                  <button style={{ color: 'var(--text-secondary)' }}><Plus size={22} /></button>
                  <input
                    type="text"
                    placeholder="Send a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                    disabled={sendingMsg}
                    style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '20px', border: 'none', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  {messageText.trim().length > 0 ? (
                    <button
                      onClick={handleSendMessage}
                      disabled={sendingMsg}
                      style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(96, 165, 250, 0.1)' }}
                    >
                      <Send size={18} />
                    </button>
                  ) : (
                    <button style={{ color: 'var(--text-secondary)' }}><Phone size={20} /></button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>No chats</h3>
              <p>Recent chats will appear here.</p>
            </div>
          )
        ) : (
          <div className="settings-main-view">
            <div className="settings-container">
              <h2 className="settings-page-title">Profile</h2>

              <div className="profile-avatar-section">
                <div className="profile-avatar-large">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="User Avatar" />
                  ) : (
                    displayInitial
                  )}
                </div>
                <button className="edit-photo-btn" onClick={() => {
                  const url = prompt("Enter new avatar URL:", avatarUrl);
                  if (url !== null) setAvatarUrl(url);
                }}>
                  Edit photo
                </button>
              </div>

              <div className="settings-block-wrapper">
                <div className="settings-block">
                  <div className="settings-field" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                    <User className="settings-field-icon" size={20} />
                    <div className="settings-field-content">
                      <input
                        type="text"
                        className="settings-input"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display Name"
                      />
                    </div>
                  </div>
                  <div className="settings-field">
                    <Pencil className="settings-field-icon" size={18} />
                    <div className="settings-field-content">
                      <input
                        type="text"
                        className="settings-input"
                        placeholder="About"
                      />
                    </div>
                  </div>
                </div>
                <div className="settings-desc">
                  Your profile and changes to it will be visible to people you message, contacts and groups.
                </div>
              </div>

              <div className="settings-block-wrapper">
                <div className="settings-block">
                  <div className="settings-field">
                    <span className="settings-field-icon" style={{ fontSize: '1.25rem', fontWeight: 500, fontFamily: 'monospace' }}>@</span>
                    <div className="settings-field-content">
                      <input
                        type="text"
                        className="settings-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                      />
                    </div>
                    <MoreHorizontal className="settings-field-icon" size={20} />
                  </div>
                </div>
                <div className="settings-desc">
                  People can now message you using your optional username so you don't have to give out your phone number.
                </div>
              </div>

              {(displayName !== user?.display_name || avatarUrl !== user?.avatar_url || username !== user?.username) && (
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
