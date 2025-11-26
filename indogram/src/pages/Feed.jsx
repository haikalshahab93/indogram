import './Feed.css'

import { useApp } from '../context/AppContext.jsx'
import PostCard from '../components/PostCard.jsx'
import './Feed.css'
import { useEffect, useState } from 'react'

export default function Feed(){
  const { fetchFeed, currentUser } = useApp()
  const [posts, setPosts] = useState([])
  const [filter, setFilter] = useState('following')

  useEffect(()=>{
    const following = Array.isArray(currentUser?.following) ? currentUser.following : []
    if(filter === 'following' && following.length === 0){
      setPosts([])
      return
    }
    (async()=>{ setPosts(await fetchFeed(filter)) })()
  }, [fetchFeed, filter, currentUser])

  return (
    <section className="feed">
      <div className="feed-filter">
        <button className="active">Mengikuti</button>
      </div>

      {Array.isArray(currentUser?.following) && currentUser.following.length === 0 ? (
        <p className="empty-follow">Mulai mengikuti akun untuk melihat feed. Jelajahi rekomendasi di Explore.</p>
      ) : posts.length === 0 ? (
        <p>Belum ada postingan dari akun yang Anda ikuti.</p>
      ) : (
        <div className="posts">
          {posts.map(p=> (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </section>
  )
}