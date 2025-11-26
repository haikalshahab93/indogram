import './Groups.css'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function Groups(){
  const { groups, fetchGroups, createGroup, fetchGroup, inviteToGroup, sendGroupMessage, lockGroup, currentUser, fetchUsersByName } = useApp()
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)

  // Create group form state
  const [gName, setGName] = useState('')
  const [gLocked, setGLocked] = useState(false)
  const [creating, setCreating] = useState(false)

  // Invite state
  const [inviteUser, setInviteUser] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteOptions, setInviteOptions] = useState([])

  // Message state
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)

  // Ref & scroll state for chat messages
  const messagesRef = useRef(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Display controls
  const [filterQ, setFilterQ] = useState('')
  const [density, setDensity] = useState('comfortable')
  const [highContrast, setHighContrast] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(340)

  useEffect(()=>{ fetchGroups() }, [])
  useEffect(()=>{
    if(!selectedId && Array.isArray(groups) && groups.length){
      setSelectedId(groups[0].id)
    }
  }, [groups, selectedId])
  useEffect(()=>{
    (async()=>{
      if(selectedId){
        const g = await fetchGroup(selectedId)
        setSelected(g)
      } else {
        setSelected(null)
      }
    })()
  }, [selectedId])
  // Simpan waktu terakhir melihat grup untuk badge unread
  useEffect(()=>{
    if(selectedId){
      try{ localStorage.setItem(`group_last_read_${selectedId}`, String(Date.now())) }catch{}
    }
  }, [selectedId])

  // Debounced autosearch invite by nameid
  const isAdmin = useMemo(()=>{
    const me = currentUser?.username
    return !!(selected?.admins||[]).includes(me)
  }, [selected, currentUser])

  // Daftar grup terurut berdasarkan aktivitas terbaru + filter
  const sortedGroups = useMemo(()=>{
    const arr = Array.isArray(groups) ? [...groups] : []
    const latestTs = (g)=>{
      const lm = Number((g.messages||[]).slice(-1)[0]?.createdAt)||0
      const li = Number((g.invites||[]).slice(-1)[0]?.createdAt)||0
      return Math.max(lm, li)
    }
    arr.sort((a,b)=> latestTs(b) - latestTs(a) || a.name.localeCompare(b.name))
    const q = filterQ.trim().toLowerCase()
    return q ? arr.filter(g=> String(g.name||'').toLowerCase().includes(q)) : arr
  }, [groups, filterQ])
  const getUnreadCount = (g)=>{
    try{
      const lastRead = Number(localStorage.getItem(`group_last_read_${g.id}`)||0)
      return (g.messages||[]).filter(m=> Number(m.createdAt||0) > lastRead).length
    }catch{ return 0 }
  }

  useEffect(()=>{
    const q = inviteUser.trim()
    if(!isAdmin || !q){ setInviteOptions([]); return }
    const handle = setTimeout(async ()=>{
      const { users, error } = await fetchUsersByName(q)
      if(error){ setInviteOptions([]) }
      else { setInviteOptions(Array.isArray(users) ? users : []) }
    }, 300)
    return ()=> clearTimeout(handle)
  }, [inviteUser, isAdmin])

  const handleCreateGroup = async (e)=>{
    e.preventDefault()
    const name = gName.trim()
    if(!name) return
    setCreating(true)
    const res = await createGroup({ name, locked: gLocked })
    setCreating(false)
    if(res?.error){ alert(res.error) }
    setGName('')
    setGLocked(false)
  }

  const handleInvite = async (e)=>{
    e.preventDefault()
    if(!selected?.id) return
    const q = inviteUser.trim()
    if(!q) return
    // Map Name ID to username if found
    const matched = inviteOptions.find(u => {
      const vals = [u.nameid, u.username].filter(Boolean).map(v=> String(v).toLowerCase())
      return vals.includes(q.toLowerCase())
    })
    const uname = matched?.username || q
    setInviteLoading(true)
    const res = await inviteToGroup(selected.id, uname)
    setInviteLoading(false)
    if(res?.error){ setInviteMsg(res.error) } else { setInviteMsg(`Diundang: @${matched?.nameid || uname}`) }
    setInviteUser('')
    const g = await fetchGroup(selected.id)
    setSelected(g)
    setTimeout(()=> setInviteMsg(''), 2000)
  }

  const handleSend = async (e)=>{
    e.preventDefault()
    if(!selected?.id) return
    const t = msgText.trim()
    if(!t) return
    setSending(true)
    const res = await sendGroupMessage(selected.id, t)
    setSending(false)
    if(res?.error){ alert(res.error) } else { setMsgText('') }
    // Refresh grup agar pesan terbaru muncul
    const g = await fetchGroup(selected.id)
    setSelected(g)
    // Ensure the view goes to the latest message
    setTimeout(()=> scrollToBottom(true), 0)
  }
  
  // Toggle lock harus berada dalam scope komponen
  const toggleLock = async ()=>{
    if(!selected?.id) return
    const updated = await lockGroup(selected.id, !selected.locked)
    if(updated?.error){ alert(updated.error) } else { setSelected(updated) }
  }

  // Helpers untuk pemisah tanggal
  const now = new Date()
  const isToday = (ts)=>{
    const d = new Date(ts)
    return d.toDateString() === now.toDateString()
  }
  const isYesterday = (ts)=>{
    const d = new Date(ts)
    const y = new Date(now)
    y.setDate(now.getDate()-1)
    return d.toDateString() === y.toDateString()
  }

  // Scroll helpers
  const scrollToBottom = (smooth=false)=>{
    const el = messagesRef.current; if(!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }
  const handleMessagesScroll = ()=>{
    const el = messagesRef.current; if(!el) return
    const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 80
    setIsAtBottom(nearBottom)
  }
  useEffect(()=>{ // when selecting a group, jump to bottom
    if(selected) setTimeout(()=> scrollToBottom(false), 0)
  }, [selected])
  useEffect(()=>{ // when new messages arrive, auto-scroll if user is near bottom
    const count = (selected?.messages||[]).length
    if(count && isAtBottom) setTimeout(()=> scrollToBottom(true), 0)
  }, [selected?.messages?.length])

  return (
    <section className={`groups ${density==='compact'? 'density-compact' : ''} ${highContrast? 'high-contrast' : ''}`} style={{ gridTemplateColumns: `${Math.max(320, Math.min(380, sidebarWidth))}px minmax(0, 1fr)` }}>
      {/* kiri: daftar grup + form create */}
      <div className="groups-left">
        <h2>Grup</h2>
        <div className="groups-controls">
          <input className="group-filter" type="text" value={filterQ} onChange={e=> setFilterQ(e.target.value)} placeholder="Filter grup..." />
          <div className="display-toggles">
            <label>
              <span>Density</span>
              <select value={density} onChange={e=> setDensity(e.target.value)}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="contrast-toggle">
              <input type="checkbox" checked={highContrast} onChange={e=> setHighContrast(e.target.checked)} />
              <span>High contrast</span>
            </label>
            <label className="sidebar-width">
              <span>Sidebar</span>
              <input type="range" min={320} max={380} value={sidebarWidth} onChange={e=> setSidebarWidth(Number(e.target.value))} />
            </label>
          </div>
        </div>
        <ul className="group-list">
          {Array.isArray(sortedGroups) && sortedGroups.map(g => (
            <li key={g.id} className={selectedId===g.id? 'selected' : ''} onClick={()=> setSelectedId(g.id)} tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' '){ setSelectedId(g.id) } }}>
              <div className="group-item-left">
                <span className="group-avatar" aria-hidden="true">{String(g.name||'?').slice(0,1).toUpperCase()}</span>
                <span className="group-name">{g.name}</span>
              </div>
              <div className="group-meta">
                {g.locked && <span className="badge badge-lock">🔒</span>}
                {(g.admins||[]).includes(currentUser?.username) && <span className="badge">Admin</span>}
                {getUnreadCount(g) > 0 && <span className="unread-badge" aria-label={`${getUnreadCount(g)} pesan belum dibaca`}>{getUnreadCount(g)}</span>}
              </div>
            </li>
          ))}
        </ul>
        <form className="group-create" onSubmit={handleCreateGroup}>
          <input type="text" value={gName} onChange={e=> setGName(e.target.value)} placeholder="Nama grup" />
          <label className="lock-checkbox">
            <input type="checkbox" checked={gLocked} onChange={e=> setGLocked(e.target.checked)} />
            <span>Terkunci (hanya admin bisa kirim)</span>
          </label>
          <button type="submit" disabled={creating || !gName.trim()}>{creating? 'Membuat...' : 'Buat'}</button>
        </form>
      </div>

      {/* kanan: konten grup */}
      {selected ? (
        <div className="groups-right">
          <div className="chat-header">
            <h3>{selected.name}</h3>
            <div className="chat-controls">
              {isAdmin ? (
                <label className="lock-toggle">
                  <input type="checkbox" checked={!!selected.locked} onChange={toggleLock} />
                  <span>{selected.locked ? 'Terkunci' : 'Terbuka'}</span>
                </label>
              ) : (
                <span className={`lock-status ${selected.locked ? 'locked' : 'open'}`}>{selected.locked ? 'Terkunci' : 'Terbuka'}</span>
              )}
            </div>
          </div>

          <div className="chat-members">
            <span>Admin: {(selected.admins||[]).join(', ') || '-'}</span>
            <span>Anggota: {(selected.members||[]).join(', ') || '-'}</span>
          </div>

          {isAdmin && (
            <form className="invite-form" onSubmit={handleInvite}>
              <input type="text" value={inviteUser} onChange={e=> setInviteUser(e.target.value)} placeholder="Undang berdasarkan Name ID atau username" list="invite-suggestions" />
              <datalist id="invite-suggestions">
                {inviteOptions.map(u => (
                  <option key={u.username} value={u.nameid || u.username} />
                ))}
              </datalist>
              {(inviteUser.trim() && inviteOptions.length>0) && (
                <div className="invite-suggest-panel">
                  {inviteOptions.map(u => (
                    <div key={u.username} className="invite-suggest-item" onMouseDown={()=> setInviteUser(u.nameid || u.username)}>
                      {u.avatar ? (
                        <img className="invite-avatar" src={u.avatar} alt={u.username} />
                      ) : (
                        <div className="invite-avatar placeholder" />
                      )}
                      <div className="invite-texts">
                        <div className="invite-line1">{u.name || u.username}</div>
                        <div className="invite-line2">@{u.nameid || u.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="submit" disabled={inviteLoading || !inviteUser.trim()}>{inviteLoading ? 'Mengundang...' : 'Undang'}</button>
              {inviteMsg && <span className="invite-msg">{inviteMsg}</span>}
            </form>
          )}

          <div className="chat-messages" ref={messagesRef} onScroll={handleMessagesScroll}>
            {(!selected.messages || selected.messages.length===0) ? (
              <p className="empty">Belum ada pesan.</p>
            ) : (
              (()=>{
                const arr = (selected.messages||[]).slice().sort((a,b)=> a.createdAt - b.createdAt)
                const items = []
                let prevLabel = ''
                arr.forEach(m => {
                  const label = isToday(m.createdAt) ? 'Today' : (isYesterday(m.createdAt) ? 'Yesterday' : new Date(m.createdAt).toLocaleDateString())
                  if(label !== prevLabel){ items.push({ type: 'sep', label }); prevLabel = label }
                  items.push({ type: 'msg', m })
                })
                return items.map((it, idx) => (
                  it.type === 'sep' ? (
                    <div key={`sep-${idx}`} className="msg-separator"><span>{it.label}</span></div>
                  ) : (
                    (()=>{
                      const m = it.m
                      const isMe = m.author?.username===currentUser?.username
                      const isAdminAuthor = (selected.admins||[]).includes(m.author?.username)
                      const av = isMe ? currentUser?.avatar : (m.author?.avatar || '')
                      return (
                        <div key={m.id} className={`msg-row ${isMe? 'me' : 'they'} ${isAdminAuthor? 'admin' : 'member'}`}>
                          <div className="msg-avatar">
                            {av ? <img src={av} alt={m.author?.username||''} /> : <div className="msg-avatar placeholder" />}
                          </div>
                          <div className="msg-bubble">
                            <div className="msg-meta">
                              <span className="author">{m.author?.username||'anon'}</span>
                              <time className="msg-time">{new Date(m.createdAt).toLocaleTimeString()}</time>
                            </div>
                            <div className="msg-text">{m.text}</div>
                          </div>
                        </div>
                      )
                    })()
                  )
                ))
              })()
            )}
          </div>

          {!isAtBottom && (
            <button type="button" className="scroll-bottom" onClick={()=> scrollToBottom(true)}>Lihat pesan terbaru</button>
          )}

          <form className="chat-input" onSubmit={handleSend}>
            <input type="text" value={msgText} onChange={e=> setMsgText(e.target.value)} placeholder={selected.locked && !isAdmin ? 'Grup terkunci, hanya admin yang dapat mengirim' : 'Tulis pesan...'} disabled={sending || (selected.locked && !isAdmin)} />
            <button type="submit" disabled={sending || !msgText.trim() || (selected.locked && !isAdmin)}>{sending ? 'Mengirim...' : 'Kirim'}</button>
          </form>
        </div>
      ) : (
        <div className="groups-right">
          <div className="group-empty">
            <p>Pilih grup di sebelah kiri untuk melihat percakapan.</p>
          </div>
        </div>
      )}
    </section>
  )
}