import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PostCard from '../components/PostCard.jsx'
import './Profile.css'
import { useEffect } from 'react'

export default function Profile(){
  const { posts, currentUser, setUsername, fetchUserStats, setAvatar } = useApp()
  const [name, setName] = useState(currentUser?.username || 'Indogrammer')

  const myPosts = useMemo(()=> posts.filter(p=> p.author?.username === (currentUser?.username || 'Indogrammer')), [posts, currentUser])

  const [stats, setStats] = useState({ followers: 0, following: 0 })
  useEffect(()=>{ (async()=>{ setStats(await fetchUserStats(currentUser.username)) })() }, [currentUser, fetchUserStats])

  const save = (e)=>{
    e.preventDefault()
    setUsername(name)
  }

  const onAvatarChange = async (e)=>{
    const file = e.target.files?.[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if(typeof dataUrl === 'string') setAvatar(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <section className="profile">
      <header className="profile-header">
        <div
          className="avatar large"
          aria-hidden="true"
          style={{ backgroundImage: currentUser?.avatar ? `url(${currentUser.avatar})` : undefined }}
        />
        <div className="info">
          <form className="edit" onSubmit={save}>
            <input value={name} onChange={(e)=>setName(e.target.value)} />
            <button type="submit">Simpan</button>
          </form>
          <div className="stats">
            <span><strong>{myPosts.length}</strong> postingan</span>
            <span><strong>{stats.followers}</strong> pengikut</span>
            <span><strong>{stats.following}</strong> mengikuti</span>
          </div>
          <div className="avatar-edit">
            <label>
              <span>Ubah foto profil</span>
              <input type="file" accept="image/*" onChange={onAvatarChange} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </header>

      <h2>Postingan Anda</h2>
      {myPosts.length === 0 ? (
        <p>Belum ada postingan. Buat postingan di menu Buat.</p>
      ) : (
        <div className="posts">
          {myPosts.map(p=> <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </section>
  )
}