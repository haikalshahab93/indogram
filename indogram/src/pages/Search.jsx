import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Link } from 'react-router-dom'
import './Search.css'

export default function Search(){
  const { fetchUsersByName, followUser, unfollowUser, currentUser } = useApp()
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])

  useEffect(()=>{
    const run = async()=>{
      setError('')
      if(!q.trim()){ setResults([]); return }
      setLoading(true)
      const { users, error } = await fetchUsersByName(q.trim())
      if(error){ setError(error) }
      setResults(users||[])
      setLoading(false)
    }
    const t = setTimeout(run, 300)
    return ()=> clearTimeout(t)
  }, [q, fetchUsersByName])

  const onFollowToggle = async (username, isFollowing)=>{
    setError('')
    try{
      if(isFollowing){
        await unfollowUser(username)
      }else{
        await followUser(username)
      }
      // update local results
      setResults(prev => prev.map(u => u.username === username ? { ...u, isFollowing: !isFollowing } : u))
    }catch(err){ setError('Gagal mengubah status mengikuti') }
  }

  return (
    <div className="search-page">
      <h2>Cari Pengguna berdasarkan Name ID</h2>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Masukkan Name ID..."
          value={q}
          onChange={e=> setQ(e.target.value)}
          list="user-suggestions"
        />
        <datalist id="user-suggestions">
          {results.map(u => (
            <option key={u.username} value={u.nameid || u.username} />
          ))}
        </datalist>
      </div>
      {error && <div className="error-msg">{error}</div>}
      {loading && <div className="loading">Mencari...</div>}

      {!loading && results.length === 0 && q.trim() && (
        <div className="empty-state">
          Tidak ada pengguna dengan Name ID "{q.trim()}".
        </div>
      )}

      <ul className="user-results">
        {results.map(u => {
          const isMe = currentUser?.username === u.username
          return (
            <li key={u.username} className="user-item">
              <div className="user-meta">
                <Link to={`/user/${u.username}`} className="user-name">
                  {u.name || u.nameid || u.username}
                </Link>
                <span className="user-username">@{u.nameid || u.username}</span>
              </div>
              <div className="user-actions">
                {isMe ? (
                  <span className="me-label">Anda</span>
                ) : (
                  <button
                    className={`follow-btn ${u.isFollowing ? 'following' : ''}`}
                    onClick={()=> onFollowToggle(u.username, u.isFollowing)}
                  >
                    {u.isFollowing ? 'Mengikuti' : 'Ikuti'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}