import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react'

const AppContext = createContext(null)
export function useApp(){ return useContext(AppContext) }

function extractTags(caption){
  if(!caption) return []
  const matches = caption.match(/#([\w\-]+)/g) || []
  return matches.map(t=> t.replace(/^#/, ''))
}

export default function AppProvider({ children }){
  const [posts, setPosts] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('indogram_posts')||'[]') }catch{ return [] }
  })
  const [currentUser, setCurrentUser] = useState(()=>{
    try{
      const d = JSON.parse(localStorage.getItem('indogram_user')||'{"username":"Indogrammer","following":[]}')
      return { username: d.username || 'Indogrammer', name: d.name || d.username || 'Indogrammer', following: Array.isArray(d.following) ? d.following : [], avatar: d.avatar || '' }
    }catch{ return { username: 'Indogrammer', name: 'Indogrammer', following: [], avatar: '' } }
  })
  const [followersMap, setFollowersMap] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('indogram_followers')||'{}') }catch{ return {} }
  })
  const [token, setToken] = useState(()=>{
    try{ return localStorage.getItem('indogram_token') || '' }catch{ return '' }
  })
  // Groups state
  const [groups, setGroups] = useState([])
  const inFlightRef = useRef(new Set())
  const startFlight = (key)=>{
    const set = inFlightRef.current
    if(set.has(key)) return false
    set.add(key)
    return true
  }
  const endFlight = (key)=>{ inFlightRef.current.delete(key) }

  // Persist with quota-safe lightweight snapshot (avoid storing large images/base64)
  useEffect(()=>{
    try{
      const lightweight = (posts||[]).slice(0, 50).map(p => ({
        id: p.id,
        caption: p.caption,
        author: p.author,
        // store counts only to keep data small
        likesCount: Array.isArray(p.likes) ? p.likes.length : 0,
        comments: Array.isArray(p.comments) ? p.comments.slice(0,3).map(c=>({ text: c.text, author: c.author })) : []
      }))
      localStorage.setItem('indogram_posts', JSON.stringify(lightweight))
    }catch{/* ignore quota errors */}
  }, [posts])
  useEffect(()=>{ localStorage.setItem('indogram_user', JSON.stringify(currentUser)) }, [currentUser])
  useEffect(()=>{ localStorage.setItem('indogram_followers', JSON.stringify(followersMap)) }, [followersMap])
  useEffect(()=>{ try{ localStorage.setItem('indogram_token', token || '') }catch{} }, [token])

  const DEV = import.meta?.env?.DEV
  const API_BASE = DEV ? '' : (import.meta?.env?.VITE_API_BASE || 'http://localhost:8080')
  const authHeaders = ()=> (token ? { 'Authorization': `Bearer ${token}` } : {})
  useEffect(()=>{
    if(!token) return
    (async()=>{
      try{
        const me = await fetch(`${API_BASE}/api/auth/me`, { headers: { ...authHeaders() } }).then(r=> r.ok ? r.json() : null)
        if(me){
          setCurrentUser(u=> ({
            ...u,
            username: me.username || (u.username || 'Indogrammer'),
            name: me.name || u.name || me.username || 'Indogrammer',
            following: Array.isArray(me.following) ? me.following : (u.following || []),
            avatar: me.avatar || u.avatar || ''
          }))
        }
      }catch{}
    })()
  }, [token])
  useEffect(()=>{
    // initial load: fetch feed all
    fetch(`${API_BASE}/api/posts?filter=all&me=${encodeURIComponent(currentUser?.username||'Indogrammer')}`)
      .then(r=>r.json())
      .then(arr=>{ if(Array.isArray(arr)) setPosts(arr) })
      .catch(()=>{})
  }, [])
  const addPost = async ({ image, images, caption })=>{
    const imgs = Array.isArray(images) ? images : (image ? [image] : [])
    if(!imgs.length) return
    try{
      const res = await fetch(`${API_BASE}/api/posts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ images: imgs, caption, author: { username: currentUser?.username || 'Indogrammer', avatar: currentUser?.avatar || '' } })
      })
      if(!res.ok) return
      const created = await res.json()
      setPosts(prev=> [created, ...prev])
    }catch{}
  }

  const toggleLike = async (id)=>{
    try{
      const res = await fetch(`${API_BASE}/api/posts/${id}/like`, { method: 'POST', headers: { ...authHeaders() } })
      if(!res.ok) return
      const updated = await res.json()
      setPosts(prev=> prev.map(p=> p.id===id? updated : p))
    }catch{}
  }

  const addComment = async (id, text)=>{
    if(!text?.trim()) return
    try{
      const res = await fetch(`${API_BASE}/api/posts/${id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: text.trim(), author: { username: currentUser?.username || 'Indogrammer', avatar: currentUser?.avatar || '' } })
      })
      if(!res.ok) return
      const c = await res.json()
      setPosts(prev=> prev.map(p=> p.id===id? { ...p, comments: [ ...(p.comments||[]), c ] } : p))
    }catch{}
  }

  const removePost = async (id)=>{
    try{
      const res = await fetch(`${API_BASE}/api/posts/${id}`, { method: 'DELETE', headers: { ...authHeaders() } })
      if(!res.ok) return
      setPosts(prev=> prev.filter(p=> p.id !== id))
    }catch{}
  }

  const followUser = async (username)=>{
    if(!username || username === currentUser.username) return
    const me = currentUser.username
    try{
      const res = await fetch(`${API_BASE}/api/users/${username}/follow`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ me })
      })
      if(!res.ok) return
      const data = await res.json()
      setCurrentUser(u=> ({ ...u, following: Array.isArray(data.following) ? data.following : (u.following||[]) }))
    }catch{}
  }
  const unfollowUser = async (username)=>{
    if(!username) return
    const me = currentUser.username
    try{
      const res = await fetch(`${API_BASE}/api/users/${username}/unfollow`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ me })
      })
      if(!res.ok) return
      const data = await res.json()
      setCurrentUser(u=> ({ ...u, following: Array.isArray(data.following) ? data.following : (u.following||[]).filter(x=> x!==username) }))
    }catch{}
  }

  const checkUserAccess = async (username)=>{
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(username)}/posts?me=${encodeURIComponent(me)}`)
      return res.status !== 403
    }catch{ return false }
  }

  const register = async (username, password, nameid)=>{
    try{
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nameid })
      })
      const data = await res.json()
      if(!res.ok){
        let msg = 'Gagal mendaftar'
        if(data?.error === 'weak_password') msg = 'Kata sandi terlalu lemah (min 6 karakter)'
        else if(data?.error === 'user_exists') msg = 'Nama pengguna sudah terdaftar'
        return { ok: false, error: msg }
      }
      setToken(data.token)
      setCurrentUser({ username: data?.user?.username, name: data?.user?.name || data?.user?.username, following: [], avatar: data?.user?.avatar || '' })
      return { ok: true }
    }catch(err){ return { ok: false, error: 'Kesalahan jaringan' } }
  }

  const login = async (username, password)=>{
    try{
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if(!res.ok){
        let msg = 'Gagal masuk'
        if(data?.error === 'user_not_found') msg = 'Pengguna tidak ditemukan'
        else if(data?.error === 'invalid_credentials') msg = 'Nama pengguna atau kata sandi salah'
        return { ok: false, error: msg }
      }
      setToken(data.token)
      setCurrentUser({ username: data?.user?.username, name: data?.user?.name || data?.user?.username, following: [], avatar: data?.user?.avatar || '' })
      return { ok: true }
    }catch(err){ return { ok: false, error: 'Kesalahan jaringan' } }
  }

  const logout = ()=>{
    setToken('')
    setCurrentUser({ username: 'Indogrammer', name: 'Indogrammer', following: [], avatar: '' })
  }

  const fetchUsersByName = async (name)=>{
    try{
      const res = await fetch(`${API_BASE}/api/users/search?nameid=${encodeURIComponent(name)}`, { headers: { ...authHeaders() } })
      const data = await res.json()
      if(!res.ok){ return { users: [], error: 'Gagal mencari pengguna' } }
      return { users: (data||[]).map(u => ({
        username: u.username,
        name: u.name,
        nameid: u.nameid,
        avatar: u.avatar || '',
        isFollowing: !!u.isFollowing,
        isMutual: !!u.isMutual,
      })) }
    }catch(err){ return { users: [], error: 'Kesalahan jaringan' } }
  }

  const setUsername = async (to)=>{
    const old = currentUser?.username || 'Indogrammer'
    const name = String(to||'').trim()
    if(!name || name === old) return { ok: true }
    try{
      const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(old)}/rename`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ to: name })
      })
      const data = await res.json()
      if(!res.ok){
        let msg = 'Gagal mengubah nama pengguna'
        if(data?.error === 'username_taken') msg = 'Nama pengguna sudah dipakai'
        else if(data?.error === 'to_required') msg = 'Nama baru wajib diisi'
        else if(data?.error === 'user_not_found') msg = 'Pengguna tidak ditemukan'
        return { ok: false, error: msg }
      }
      setCurrentUser(u=> ({ ...u, username: data.username, name: data.username }))
      return { ok: true }
    }catch(err){ return { ok: false, error: 'Kesalahan jaringan' } }
  }

  const fetchFeed = async (filter='all')=>{
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/posts?filter=${encodeURIComponent(filter)}&me=${encodeURIComponent(me)}`, { headers: { ...authHeaders() } })
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }catch(err){ return [] }
  }

  const fetchTrendingTags = async ()=>{
    try{
      const res = await fetch(`${API_BASE}/api/tags/trending`, { headers: { ...authHeaders() } })
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }catch(err){ return [] }
  }

  const fetchPostsByTag = async (tag)=>{
    if(!tag) return []
    try{
      const res = await fetch(`${API_BASE}/api/tags/${encodeURIComponent(tag)}/posts`, { headers: { ...authHeaders() } })
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }catch(err){ return [] }
  }

  const fetchUserPosts = async (username)=>{
    if(!username) return []
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(username)}/posts?me=${encodeURIComponent(me)}`, { headers: { ...authHeaders() } })
      if(res.status === 403) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }catch(err){ return [] }
  }

  const fetchUserStats = async (username)=>{
    if(!username) return { followers: 0, following: 0 }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(username)}/stats?me=${encodeURIComponent(me)}`, { headers: { ...authHeaders() } })
      if(res.status === 403) return { followers: 0, following: 0 }
      const data = await res.json()
      return { followers: Number(data?.followers)||0, following: Number(data?.following)||0 }
    }catch(err){ return { followers: 0, following: 0 } }
  }

  // Groups: API helpers
  const fetchGroups = useCallback(async ()=>{
      const key = 'groups'
      if(!startFlight(key)) return groups
      try{
        const me = currentUser?.username || 'Indogrammer'
        const res = await fetch(`${API_BASE}/api/groups?me=${encodeURIComponent(me)}`, { headers: { ...authHeaders() } })
        const data = await res.json()
        if(Array.isArray(data)) setGroups(data)
        return Array.isArray(data) ? data : []
      }catch{ return [] }
      finally{ endFlight(key) }
    }, [API_BASE, token, currentUser, groups])
  const createGroup = async ({ name, locked })=>{
    const key = 'create_group'
    if(!startFlight(key)) return { ok: false, error: 'Sedang memproses, coba lagi sebentar.' }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/groups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name, locked: !!locked, me })
      })
      const data = await res.json()
      if(res.ok){ await fetchGroups() }
      return data
    }catch{ return { ok: false, error: 'Kesalahan jaringan' } }
    finally{ endFlight(key) }
  }
  const fetchGroup = async (id)=>{
    const key = `group:${id}`
    if(!startFlight(key)){
      const cached = (groups||[]).find(g=> g.id === id)
      return cached || null
    }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(id)}?me=${encodeURIComponent(me)}`, { headers: { ...authHeaders() } })
      if(!res.ok) return null
      return await res.json()
    }catch{ return null }
    finally{ endFlight(key) }
  }
  const inviteToGroup = async (id, username)=>{
    const key = `invite:${id}`
    if(!startFlight(key)) return { ok: false, error: 'Sedang mengundang, tunggu sebentar.' }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(id)}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ username, me })
      })
      const data = await res.json()
      if(res.ok){ await fetchGroups(); await fetchNotifications() }
      return data
    }catch{ return { ok: false, error: 'Kesalahan jaringan' } }
    finally{ endFlight(key) }
  }


  // Notifications state & helpers
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const fetchNotifications = useCallback(async ()=>{
    setNotificationsLoading(true)
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/notifications?me=${encodeURIComponent(me)}`, { headers: { ...authHeaders() } })
      const data = await res.json()
      if(Array.isArray(data)) setNotifications(data)
      return Array.isArray(data) ? data : []
    }catch{ return [] }
    finally{ setNotificationsLoading(false) }
  }, [API_BASE, token, currentUser])
  const markNotificationRead = async (id)=>{
    try{
      const res = await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: { ...authHeaders() } })
      const data = await res.json()
      if(res.ok){ setNotifications(prev => prev.map(n => n.id===id ? { ...n, unread: false } : n)) }
      return data
    }catch{ return { ok: false } }
  }
  const respondInvite = async (id, action)=>{
    const key = `respond:${id}:${action}`
    if(!startFlight(key)) return { ok: false, error: 'Sedang memproses undangan.' }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(id)}/invite/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action, me })
      })
      const data = await res.json()
      if(res.ok){
        // Update groups and notifications
        await fetchGroups(); await fetchNotifications()
        // If selected group matches, refresh it via fetchGroup
      }
      return data
    }catch{ return { ok: false, error: 'Kesalahan jaringan' } }
    finally{ endFlight(key) }
  }
  const fetchGroupMessages = async (id)=>{
    const g = await fetchGroup(id)
    return g?.messages || []
  }
  const sendGroupMessage = async (id, text)=>{
    const key = `send:${id}`
    if(!startFlight(key)) return { ok: false, error: 'Sedang mengirim, tunggu sebentar.' }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(id)}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text, me })
      })
      const m = await res.json()
      if(res.ok){
        setGroups(prev => prev.map(g => {
          if(g.id === id){
            return { ...g, messages: [ ...(g.messages||[]), m ] }
          }
          return g
        }))
      }
      return m
    }catch{ return { ok: false, error: 'Kesalahan jaringan' } }
    finally{ endFlight(key) }
  }
  const lockGroup = async (id, locked)=>{
    const key = `lock:${id}`
    if(!startFlight(key)) return { ok: false, error: 'Sedang memproses, tunggu sebentar.' }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(id)}/lock`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ locked: !!locked, me })
      })
      const data = await res.json()
      if(res.ok){
        setGroups(prev => prev.map(g => g.id === id ? data : g))
      }
      return data
    }catch{ return { ok: false, error: 'Kesalahan jaringan' } }
    finally{ endFlight(key) }
  }

  // Tambah: Friend invites API
  const inviteFriend = async (toUsername)=>{
    const key = `finvite:${toUsername}`
    if(!startFlight(key)) return { ok: false, error: 'Sedang mengundang, tunggu sebentar.' }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/friends/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ to: toUsername, me })
      })
      const data = await res.json()
      if(res.ok){ await fetchNotifications() }
      return data
    }catch{ return { ok: false, error: 'Kesalahan jaringan' } }
    finally{ endFlight(key) }
  }
  const respondFriendInvite = async (notifId, action)=>{
    const key = `frespond:${notifId}:${action}`
    if(!startFlight(key)) return { ok: false, error: 'Sedang memproses undangan.' }
    try{
      const me = currentUser?.username || 'Indogrammer'
      const res = await fetch(`${API_BASE}/api/friends/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ id: notifId, action, me })
      })
      const data = await res.json()
      if(res.ok){
        await fetchNotifications()
        if(action === 'accept'){
          const other = data?.otherUser || data?.username || null
          if(other){ setCurrentUser(u=> ({ ...u, following: Array.from(new Set([ ...(u.following||[]), other ])) })) }
        }
      }
      return data
    }catch{ return { ok: false, error: 'Kesalahan jaringan' } }
    finally{ endFlight(key) }
  }

  useEffect(()=>{ if(token) fetchGroups() }, [token])
  useEffect(()=>{ if(token) fetchNotifications() }, [token])
  const value = useMemo(() => ({
    posts,
    addPost,
    toggleLike,
    addComment,
    removePost,
    currentUser,
    setCurrentUser,
    setUsername,
    followUser,
    unfollowUser,
    fetchFeed,
    fetchTrendingTags,
    fetchPostsByTag,
    fetchUserPosts,
    fetchUserStats,
    checkUserAccess,
    register,
    login,
    logout,
    fetchUsersByName,
    token,
    // Groups context
    groups,
    fetchGroups,
    createGroup,
    fetchGroup,
    inviteToGroup,
    fetchGroupMessages,
    sendGroupMessage,
    lockGroup,
    respondInvite,
    // Notifications
    notifications,
    notificationsLoading,
    fetchNotifications,
    markNotificationRead,
    // new: setAvatar helper
    setAvatar: (dataUrl)=>{
      if(!dataUrl) return
      const me = currentUser?.username || 'Indogrammer'
      // update current user avatar
      setCurrentUser(u=> ({ ...u, avatar: dataUrl }))
      // propagate avatar change to authored posts and comments in client state
      setPosts(prev => prev.map(p => {
        if(p?.author?.username === me){
          const updatedComments = (p.comments||[]).map(c => (
            c?.author?.username === me ? { ...c, author: { ...c.author, avatar: dataUrl } } : c
          ))
          return { ...p, author: { ...p.author, avatar: dataUrl }, comments: updatedComments }
        }
        // also update comments authored by me under other posts
        const updatedComments = (p.comments||[]).map(c => (
          c?.author?.username === me ? { ...c, author: { ...c.author, avatar: dataUrl } } : c
        ))
        return { ...p, comments: updatedComments }
      }))
    },
    // expose friend invite APIs
    inviteFriend,
    respondFriendInvite,
  }), [posts, currentUser, token, groups, notifications])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}