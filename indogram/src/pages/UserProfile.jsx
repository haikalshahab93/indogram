import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import PostCard from '../components/PostCard.jsx'
import './UserProfile.css'
import { useEffect, useState } from 'react'

export default function UserProfile(){
  const { username } = useParams()
  const { currentUser, followUser, unfollowUser, fetchUserPosts, fetchUserStats, checkUserAccess, setAvatar, inviteFriend } = useApp()
  const isMe = currentUser?.username === username
  const isFollowing = useMemo(()=> (currentUser?.following||[]).includes(username), [currentUser, username])

  const [posts, setPosts] = useState([])
  const [stats, setStats] = useState({ followers: 0, following: 0 })
  const [accessDenied, setAccessDenied] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  useEffect(()=>{ (async()=>{ setPosts(await fetchUserPosts(username)) })() }, [username, fetchUserPosts])
  useEffect(()=>{ (async()=>{ setStats(await fetchUserStats(username)) })() }, [username, fetchUserStats])
  useEffect(()=>{ (async()=>{ setAccessDenied(!(await checkUserAccess(username))) })() }, [username, checkUserAccess])

  const toggleFollow = ()=>{
    if(isMe) return
    if(isFollowing) unfollowUser(username)
    else followUser(username)
  }

  const onAvatarChange = (e)=>{
    const file = e.target.files?.[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = ()=>{
      const dataUrl = reader.result
      if(typeof dataUrl === 'string') setAvatar(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const onInviteFriend = async ()=>{
    if(isMe || inviting || inviteSent) return
    setInviting(true)
    const res = await inviteFriend(username)
    if(res?.ok){ setInviteSent(true) }
    setInviting(false)
  }

  const avatarStyle = { backgroundImage: isMe && currentUser?.avatar ? `url(${currentUser.avatar})` : undefined }

  return (
    <section className="user-profile">
      <header className="profile-header">
        <div className="avatar large" aria-hidden="true" style={avatarStyle} />
        <div className="info">
          <div className="top">
            <h2>{username}</h2>
            {!isMe && (
              <>
                <button className={"follow" + (isFollowing? ' following' : '')} onClick={toggleFollow}>
                  {isFollowing ? 'Mengikuti' : 'Ikuti'}
                </button>
                <button className="follow" style={{ marginLeft: '0.5rem' }} onClick={onInviteFriend} disabled={inviting || inviteSent}>
                  {inviteSent ? 'Undangan terkirim' : (inviting ? 'Mengundang...' : 'Undang berteman')}
                </button>
              </>
            )}
            {isMe && (
              <label className="follow" style={{ marginLeft: 'auto' }}>
                <span>Ubah foto profil</span>
                <input type="file" accept="image/*" onChange={onAvatarChange} style={{ display: 'none' }} />
              </label>
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