import { createContext, useContext, useEffect, useMemo, useState } from 'react'

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
      return { username: d.username || 'Indogrammer', name: d.name || d.username || 'Indogrammer', following: Array.isArray(d.following) ? d.following : [] }
    }catch{ return { username: 'Indogrammer', name: 'Indogrammer', following: [] } }
  })
  const [followersMap, setFollowersMap] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('indogram_followers')||'{}') }catch{ return {} }
  })
  const [token, setToken] = useState(()=>{
    try{ return localStorage.getItem('indogram_token') || '' }catch{ return '' }
  })

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

  const API_BASE = (import.meta.env?.VITE_API_BASE) || 'http://localhost:8080'
  const authHeaders = ()=> (token ? { Authorization: `Bearer ${token}` } : {})
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
            following: Array.isArray(me.following) ? me.following : (u.following || [])
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
        body: JSON.stringify({ images: imgs, caption, author: { username: currentUser?.username || 'Indogrammer' } })
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
        body: JSON.stringify({ text: text.trim(), author: { username: currentUser?.username || 'Indogrammer' } })
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
      setCurrentUser({ username: data?.user?.username, name: data?.user?.name || data?.user?.username, following: [] })
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
      setCurrentUser({ username: data?.user?.username, name: data?.user?.name || data?.user?.username, following: [] })
      return { ok: true }
    }catch(err){ return { ok: false, error: 'Kesalahan jaringan' } }
  }

  const logout = ()=>{
    setToken('')
    setCurrentUser({ username: 'Indogrammer', name: 'Indogrammer', following: [] })
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
  }), [posts, currentUser, token])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}