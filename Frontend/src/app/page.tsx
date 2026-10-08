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
  Plus,
  Check,
  CheckCheck,
  ArrowLeft,
  Users,
  AtSign,
  Hash,
  Camera,
  ChevronDown,
  Video
} from "lucide-react";

export default function SignalDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"chats" | "settings">("chats");
  const [sidebarView, setSidebarView] = useState<"chats" | "new_chat" | "choose_members" | "name_group">("chats");

  // Group State
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [groupName, setGroupName] = useState("");

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

  // Group Details Sidebar State
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [memberMenuOpen, setMemberMenuOpen] = useState<number | null>(null);

  // Mock Active Chat for UI demonstration
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);

  const activeChatIdRef = useRef<number | null>(null);
  useEffect(() => {
    activeChatIdRef.current = activeChat?.id || null;
  }, [activeChat?.id]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const [typingUsers, setTypingUsers] = useState<{[key: number]: number}>({});

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    if (!typingTimeoutRef.current && wsRef.current?.readyState === WebSocket.OPEN && activeChat?.id) {
      wsRef.current.send(JSON.stringify({ type: "typing", target_user_id: activeChat.id }));
      typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000);
    }
  };

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
        
        // Fetch chats
        const chatsRes = await fetch("http://127.0.0.1:8000/auth/chats", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          setChats(chatsData);
        }
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

    let ws: WebSocket;
    let reconnectTimer: any;

    const connect = () => {
      ws = new WebSocket(`ws://127.0.0.1:8000/ws/${user.id}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message") {
            const chatId = data.message.chat_id || data.message.sender_id;
            const isChatActive = activeChatIdRef.current === chatId;
            
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: isChatActive ? "message_read" : "message_delivered",
                message_id: data.message.id,
                sender_id: data.message.sender_id
              }));
            }

            setActiveChat((prev: any) => {
              if (prev && prev.id === chatId) {
                const newMsg = { 
                  id: data.message.id, 
                  text: data.message.text, 
                  out: false, 
                  time: "Just now", 
                  status: "read",
                  sender_name: data.message.sender_name 
                };
                return {
                  ...prev,
                  messages: prev.messages ? [...prev.messages, newMsg] : [newMsg]
                };
              }
              return prev;
            });

            setChats((prevChats: any[]) => {
              const chatIndex = prevChats.findIndex(c => c.id === chatId);
              if (chatIndex !== -1) {
                const updatedChat = {
                  ...prevChats[chatIndex],
                  last_message: data.message.text,
                  last_message_time: "Just now"
                };
                const newChats = [...prevChats];
                newChats.splice(chatIndex, 1);
                return [updatedChat, ...newChats];
              }
              return prevChats;
            });
          } else if (data.type === "receipt_update") {
            setActiveChat((prev: any) => {
              if (!prev || !prev.messages) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m: any) => 
                  m.id === data.message_id ? { ...m, status: data.status } : m
                )
              };
            });
          } else if (data.type === "typing") {
            const typingChatId = data.chat_id || data.sender_id;
            setTypingUsers((prev: any) => ({ ...prev, [typingChatId]: Date.now() }));
            setTimeout(() => {
              setTypingUsers((prev: any) => {
                if (Date.now() - (prev[typingChatId] || 0) >= 2500) {
                  const newObj = { ...prev };
                  delete newObj[typingChatId];
                  return newObj;
                }
                return prev;
              });
            }, 3000);
          }
        } catch (err) {
          console.error("WS Error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [user]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChat || !activeChat.id) return;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://127.0.0.1:8000/auth/messages/${activeChat.id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const msgs = await res.json();
          setActiveChat((prev: any) => {
            if (prev && prev.id === activeChat.id) {
              return { ...prev, messages: msgs };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    };
    fetchMessages();
  }, [activeChat?.id]);

  const fetchGroupMembers = async (chatId: string) => {
    try {
      const token = localStorage.getItem("token");
      const gId = chatId.replace("group_", "");
      const res = await fetch(`http://127.0.0.1:8000/auth/group/${gId}/members`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setGroupMembers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    try {
      const token = localStorage.getItem("token");
      const gId = activeChat.id.replace("group_", "");
      const res = await fetch(`http://127.0.0.1:8000/auth/group/${gId}/member/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setGroupMembers(groupMembers.filter(m => m.id !== userId));
        setMemberMenuOpen(null);
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to remove member");
      }
    } catch (e) {
      console.error(e);
    }
  };

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

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    setSendingMsg(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://127.0.0.1:8000/auth/group", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: groupName.trim(), member_ids: selectedMembers.map(m => m.id) })
      });
      if (!res.ok) throw new Error("Failed to create group");
      
      setGroupName("");
      setSelectedMembers([]);
      setSidebarView("chats");
      
      const chatsRes = await fetch("http://127.0.0.1:8000/auth/chats", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (chatsRes.ok) {
        setChats(await chatsRes.json());
      }
    } catch (e) {
      console.error(e);
      alert("Error creating group");
    } finally {
      setSendingMsg(false);
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

      const resData = await res.json();

      // Update UI optimistically
      const newMsg = { id: resData.message_id, text: messageText.trim(), out: true, time: "Just now", status: "sent" };
      setActiveChat({
        ...activeChat,
        messages: activeChat.messages ? [...activeChat.messages, newMsg] : [newMsg]
      });
      
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => c.id === activeChat.id);
        if (chatIndex !== -1) {
          const updatedChat = {
            ...prevChats[chatIndex],
            last_message: messageText.trim(),
            last_message_time: "Just now"
          };
          const newChats = [...prevChats];
          newChats.splice(chatIndex, 1);
          return [updatedChat, ...newChats];
        }
        return prevChats;
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
      <style>{`
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
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
        {view === "chats" && sidebarView === "chats" ? (
          <>
            <div className="sidebar-header">
              <span>Chats</span>
              <div className="sidebar-header-icons">
                <button onClick={() => setSidebarView("new_chat")}><Edit size={18} strokeWidth={2} /></button>
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
                chats.length > 0 ? (
                  chats.map(contact => (
                    <div
                      key={contact.id}
                      className={`chat-list-item ${activeChat?.id === contact.id ? 'active' : ''}`}
                      onClick={() => setActiveChat(contact)}
                    >
                      <div className="avatar" style={{ background: '#fca5a5' }}>
                        {contact.avatar_url ? <img src={contact.avatar_url} alt="Avatar" /> : contact.initial}
                      </div>
                      <div className="chat-info">
                        <div className="chat-name-row">
                          <span className="chat-name">{contact.name}</span>
                          <span className="chat-time">{contact.last_message_time || ""}</span>
                        </div>
                        <div className="chat-preview">{contact.last_message || "No messages yet"}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    No recent chats. Search for a user to start messaging!
                  </div>
                )
              )}
            </div>
          </>
        ) : view === "chats" && sidebarView === "new_chat" ? (
          <>
            <div className="sidebar-header" style={{ justifyContent: 'flex-start', gap: '1.5rem', padding: '1.25rem 1rem' }}>
              <button onClick={() => { setSidebarView("chats"); setSearchQuery(""); }} style={{ color: 'var(--text-secondary)' }}>
                <ArrowLeft size={20} strokeWidth={2} />
              </button>
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>New chat</span>
            </div>

            <div className="search-container" style={{ padding: '0 1rem 1rem' }}>
              <div className="search-input-wrapper">
                <Search size={16} color="var(--text-secondary)" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Name, username, or number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {!searchQuery || searchQuery.length < 2 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div className="chat-list-item" style={{ padding: '0.75rem 1rem' }} onClick={() => { setSelectedMembers([]); setSearchQuery(""); setSidebarView("choose_members"); }}>
                      <div className="avatar" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', width: 40, height: 40 }}>
                        <Users size={18} />
                      </div>
                      <div className="chat-info">
                        <span className="chat-name" style={{ fontWeight: 500 }}>New group</span>
                      </div>
                    </div>
                    <div className="chat-list-item" style={{ padding: '0.75rem 1rem' }}>
                      <div className="avatar" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', width: 40, height: 40 }}>
                        <AtSign size={18} />
                      </div>
                      <div className="chat-info">
                        <span className="chat-name" style={{ fontWeight: 500 }}>Find by username</span>
                      </div>
                    </div>
                    <div className="chat-list-item" style={{ padding: '0.75rem 1rem' }}>
                      <div className="avatar" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', width: 40, height: 40 }}>
                        <Hash size={18} />
                      </div>
                      <div className="chat-info">
                        <span className="chat-name" style={{ fontWeight: 500 }}>Find by phone number</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ padding: '1rem', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, marginTop: '0.5rem' }}>
                    Contacts
                  </div>
                  {chats.map(contact => (
                    <div
                      key={contact.id}
                      className="chat-list-item"
                      onClick={() => {
                        setSidebarView("chats");
                        setActiveChat(contact);
                        setSearchQuery("");
                      }}
                    >
                      <div className="avatar" style={{ background: '#60a5fa', width: 40, height: 40 }}>
                        {contact.avatar_url ? <img src={contact.avatar_url} alt="Avatar" /> : contact.initial}
                      </div>
                      <div className="chat-info">
                        <span className="chat-name" style={{ fontWeight: 500 }}>{contact.name}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                searchResults.length > 0 ? (
                  searchResults.map(contact => (
                    <div
                      key={contact.id}
                      className="chat-list-item"
                      onClick={() => {
                        setSidebarView("chats");
                        setActiveChat({
                          id: contact.id,
                          name: contact.display_name || contact.username,
                          initial: (contact.display_name || contact.username || "?").charAt(0).toLowerCase(),
                          avatar: contact.avatar_url
                        });
                        setSearchQuery("");
                      }}
                    >
                      <div className="avatar" style={{ background: '#60a5fa', width: 40, height: 40 }}>
                        {contact.avatar_url ? <img src={contact.avatar_url} alt="Avatar" /> : (contact.display_name || contact.username || "?").charAt(0).toLowerCase()}
                      </div>
                      <div className="chat-info">
                        <span className="chat-name">{contact.display_name || contact.username}</span>
                        <div className="chat-preview">@{contact.username}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No results found
                  </div>
                )
              )}
            </div>
          </>
        ) : view === "chats" && sidebarView === "choose_members" ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="sidebar-header" style={{ justifyContent: 'flex-start', gap: '1.5rem', padding: '1.25rem 1rem' }}>
              <button onClick={() => { setSidebarView("new_chat"); setSearchQuery(""); }} style={{ color: 'var(--text-secondary)' }}>
                <ArrowLeft size={20} strokeWidth={2} />
              </button>
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Choose members</span>
              <button 
                onClick={() => setSidebarView("name_group")}
                disabled={selectedMembers.length === 0}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: selectedMembers.length > 0 ? '#60a5fa' : 'var(--text-secondary)', fontWeight: 600, cursor: selectedMembers.length > 0 ? 'pointer' : 'not-allowed' }}
              >
                Next
              </button>
            </div>

            <div className="search-container" style={{ padding: '0 1rem 1rem' }}>
              <div className="search-input-wrapper">
                <Search size={16} color="var(--text-secondary)" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Name, username, or number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '1rem', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
                Contacts
              </div>
              {chats.filter(c => !c.is_group).map(contact => (
                <div
                  key={contact.id}
                  className="chat-list-item"
                  onClick={() => {
                    setSelectedMembers(prev => 
                      prev.some(m => m.id === contact.id) 
                        ? prev.filter(m => m.id !== contact.id)
                        : [...prev, contact]
                    );
                  }}
                  style={{ paddingRight: '1.5rem' }}
                >
                  <div className="avatar" style={{ background: '#60a5fa', width: 40, height: 40 }}>
                    {contact.avatar_url ? <img src={contact.avatar_url} alt="Avatar" /> : contact.initial}
                  </div>
                  <div className="chat-info">
                    <span className="chat-name" style={{ fontWeight: 500 }}>{contact.name}</span>
                  </div>
                  <div style={{ 
                    width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--text-secondary)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: selectedMembers.some(m => m.id === contact.id) ? '#60a5fa' : 'transparent',
                    borderColor: selectedMembers.some(m => m.id === contact.id) ? '#60a5fa' : 'var(--text-secondary)'
                  }}>
                    {selectedMembers.some(m => m.id === contact.id) && <Check size={14} color="#fff" strokeWidth={3} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : view === "chats" && sidebarView === "name_group" ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="sidebar-header" style={{ justifyContent: 'flex-start', gap: '1.5rem', padding: '1.25rem 1rem' }}>
              <button onClick={() => setSidebarView("choose_members")} style={{ color: 'var(--text-secondary)' }}>
                <ArrowLeft size={20} strokeWidth={2} />
              </button>
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Name this group</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: '1.5rem' }}>
                <Users size={40} color="#8b5cf6" />
                <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--bg-main)', borderRadius: '50%', padding: 4 }}>
                  <Camera size={16} color="var(--text-secondary)" />
                </div>
              </div>

              <input
                type="text"
                placeholder="Group name (required)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'transparent', border: '1px solid #60a5fa', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem', marginBottom: '2rem' }}
                autoFocus
              />

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Disappearing messages</span>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  Off <ChevronDown size={14} />
                </div>
              </div>

              <div style={{ width: '100%', overflowY: 'auto', maxHeight: '200px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>Members</span>
                {selectedMembers.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="avatar" style={{ background: '#60a5fa', width: 32, height: 32 }}>
                      {m.avatar_url ? <img src={m.avatar_url} alt="Avatar" /> : m.initial}
                    </div>
                    <span style={{ fontSize: '0.9rem' }}>{m.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '1rem', marginTop: 'auto' }}>
              <button 
                disabled={!groupName.trim() || sendingMsg}
                onClick={handleCreateGroup}
                style={{ width: '100%', padding: '1rem', background: groupName.trim() ? '#8b5cf6' : 'var(--bg-secondary)', color: groupName.trim() ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: groupName.trim() ? 'pointer' : 'not-allowed' }}
              >
                Create
              </button>
            </div>
          </div>
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
            (showGroupDetails && activeChat.is_group) ? (
              <div className="group-profile-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', overflowY: 'auto' }}>
                 <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--divider)' }}>
                   <button onClick={() => setShowGroupDetails(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <ArrowLeft size={20} />
                     <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>Group Details</span>
                   </button>
                 </div>
                 
                 <div style={{ padding: '2rem 1rem', textAlign: 'center', borderBottom: '1px solid var(--divider)' }}>
                   <div className="avatar" style={{ width: 80, height: 80, fontSize: '2.5rem', background: '#60a5fa', margin: '0 auto 1rem' }}>
                     {activeChat.initial}
                   </div>
                   <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>{activeChat.name}</h2>
                   <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Add group description...</p>
                   
                   <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Video size={20} />
                        </div>
                        <span style={{ fontSize: '0.8rem' }}>Video</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Bell size={20} />
                        </div>
                        <span style={{ fontSize: '0.8rem' }}>Mute</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Search size={20} />
                        </div>
                        <span style={{ fontSize: '0.8rem' }}>Search</span>
                      </div>
                   </div>
                 </div>
                 
                 <div style={{ padding: '1rem', borderBottom: '1px solid var(--divider)' }}>
                   <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderRadius: '8px' }} className="hover-bg">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                         <span>Disappearing messages</span>
                         <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Off</span>
                      </div>
                   </div>
                   <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderRadius: '8px' }} className="hover-bg">
                      <span>Chat color</span>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#60a5fa' }}></div>
                   </div>
                   <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderRadius: '8px' }} className="hover-bg">
                      <span>Notifications</span>
                   </div>
                 </div>

                 <div style={{ padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {groupMembers.length} members
                      <Search size={16} style={{ cursor: 'pointer' }} />
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div className="hover-bg" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}>
                         <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Plus size={20} />
                         </div>
                         <span>Add members</span>
                      </div>
                      {groupMembers.map(m => (
                        <div key={m.id} className="hover-bg" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', position: 'relative' }} onClick={() => setMemberMenuOpen(memberMenuOpen === m.id ? null : m.id)}>
                          <div className="avatar" style={{ width: 36, height: 36, fontSize: '1rem', background: '#fca5a5' }}>
                            {(m.display_name || m.username).charAt(0).toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {m.id === user?.id ? 'You' : (m.display_name || m.username)}
                            </span>
                            {m.id === user?.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add member label &gt;</span>}
                          </div>
                          {m.role === 'admin' && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Admin</span>}
                          
                          {memberMenuOpen === m.id && m.id !== user?.id && (
                            <div style={{ position: 'absolute', right: 10, top: 40, background: 'var(--bg-main)', border: '1px solid var(--divider)', borderRadius: '8px', padding: '0.5rem', zIndex: 10, minWidth: 150, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                              <div className="hover-bg" style={{ padding: '0.5rem', borderRadius: '4px' }}>Nickname</div>
                              <div className="hover-bg" style={{ padding: '0.5rem', borderRadius: '4px' }}>Block</div>
                              {groupMembers.find(gm => gm.id === user?.id)?.role === 'admin' && (
                                <div className="hover-bg" style={{ padding: '0.5rem', borderRadius: '4px', color: '#ff6b6b' }} onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.id); }}>
                                  Remove from group
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
            ) : (
              <>
                <div 
                  className="main-header" 
                  style={{ cursor: activeChat.is_group ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (activeChat.is_group) {
                      setShowGroupDetails(true);
                      if (!showGroupDetails) fetchGroupMembers(activeChat.id);
                    }
                  }}
                >
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
                        {activeChat.messages.map((msg: any, idx: number) => {
                          if (msg.sender_id === null) {
                            return (
                              <div key={idx} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '1rem 0', fontWeight: 500 }}>
                                {msg.text}
                              </div>
                            );
                          }
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.out ? 'flex-end' : 'flex-start', marginBottom: '0.5rem' }}>
                              {!msg.out && activeChat.is_group && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', marginLeft: '0.5rem' }}>
                                  {msg.sender_name || 'Unknown'}
                                </span>
                              )}
                              <div className={`message-bubble ${msg.out ? 'out' : ''}`} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                <span>{msg.text}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {msg.time || 'Now'}
                                  {msg.out && (
                                    msg.status === 'read' ? <CheckCheck size={14} color="#60a5fa" /> :
                                    msg.status === 'delivered' ? <CheckCheck size={14} color="var(--text-secondary)" /> :
                                    <Check size={14} color="var(--text-secondary)" />
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: 'auto' }}>
                        <p>No messages yet.</p>
                        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Send a message to start the conversation.</p>
                      </div>
                    )}
                    {typingUsers[activeChat.id] ? (
                      <div className="message-bubble" style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '0.5rem', width: 'fit-content', padding: '0.85rem 1.15rem' }}>
                        <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-primary)', borderRadius: '50%', animation: 'typing-bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }}></span>
                        <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-primary)', borderRadius: '50%', animation: 'typing-bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }}></span>
                        <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-primary)', borderRadius: '50%', animation: 'typing-bounce 1.4s infinite ease-in-out both' }}></span>
                      </div>
                    ) : null}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="chat-input-area" style={{ padding: '1rem 2rem', borderTop: '1px solid var(--divider)', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-main)', marginTop: 'auto' }}>
                  <button style={{ color: 'var(--text-secondary)' }}><Plus size={22} /></button>
                  <input
                    type="text"
                    placeholder="Send a message..."
                    value={messageText}
                    onChange={handleTyping}
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
            )
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
