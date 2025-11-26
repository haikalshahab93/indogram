import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import PostCard from '../components/PostCard.jsx'
import './UserProfile.css'
import { useEffect, useState } from 'react'

export default function UserProfile(){
  const { username } = useParams()
  const { currentUser, followUser, unfollowUser, fetchUserPosts, fetchUserStats, checkUserAccess } = useApp()
  const isMe = currentUser?.username === username
  const isFollowing = useMemo(()=> (currentUser?.following||[]).includes(username), [currentUser, username])

  const [posts, setPosts] = useState([])
  const [stats, setStats] = useState({ followers: 0, following: 0 })
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(()=>{ (async()=>{ setPosts(await fetchUserPosts(username)) })() }, [username, fetchUserPosts])
  useEffect(()=>{ (async()=>{ setStats(await fetchUserStats(username)) })() }, [username, fetchUserStats])
  useEffect(()=>{ (async()=>{ setAccessDenied(!(await checkUserAccess(username))) })() }, [username, checkUserAccess])

  const toggleFollow = ()=>{
    if(isMe) return
    if(isFollowing) unfollowUser(username)
    else followUser(username)
  }

  return (
    <section className="user-profile">
      <header className="profile-header">
        <div className="avatar large" aria-hidden="true" />
        <div className="info">
          <div className="top">
            <h2>{username}</h2>
            {!isMe && (
              <button className={"follow" + (isFollowing? ' following' : '')} onClick={toggleFollow}>
                {isFollowing ? 'Mengikuti' : 'Ikuti'}
              </button>
            )}
          </div>
          <div className="stats">
            <span><strong>{posts.length}</strong> postingan</span>
            <span><strong>{stats.followers}</strong> pengikut</span>
            <span><strong>{stats.following}</strong> mengikuti</span>
            {!isMe && isFollowing && <span className="following-label">Diikuti oleh Anda</span>}
          </div>
        </div>
      </header>

      <h3>Postingan {isMe? 'Anda' : username}</h3>
      {accessDenied && !isMe ? (
        <p className="mutual-required">Profil ini hanya dapat dilihat jika kalian saling mengikuti.</p>
      ) : posts.length === 0 ? (
        <p>Belum ada postingan.</p>
      ) : (
        <div className="posts">
          {posts.map(p=> <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </section>
  )
}