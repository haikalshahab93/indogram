import { useMemo } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import './Explore.css'
import { useEffect, useState } from 'react'

function useQuery(){
  const { search } = useLocation()
  return useMemo(()=> new URLSearchParams(search), [search])
}

export default function Explore(){
  const { fetchTrendingTags, fetchPostsByTag } = useApp()
  const query = useQuery()
  const tag = query.get('tag') || ''
  const [trending, setTrending] = useState([])
  const [posts, setPosts] = useState([])

  useEffect(()=>{ (async()=>{ setTrending(await fetchTrendingTags()) })() }, [fetchTrendingTags])
  useEffect(()=>{ (async()=>{ setPosts(tag ? await fetchPostsByTag(tag) : []) })() }, [tag, fetchPostsByTag])

  const isEmptyByTag = tag && posts.length === 0

  return (
    <section className="explore">
      <h2>Explore</h2>

      <div className="trending">
        <h3>Tagar trending</h3>
        <div className="tags">
          {trending.length === 0 ? (
            <span>Tidak ada tagar</span>
          ) : trending.map(t=> (
            <Link key={t.tag} to={`/explore?tag=${encodeURIComponent(t.tag)}`}>#{t.tag} <small>({t.count})</small></Link>
          ))}
        </div>
      </div>

      {tag && (
        <div className="by-tag">
          <h3>Postingan untuk #{tag}</h3>
          {isEmptyByTag ? (
            <p className="mutual-required">Tidak ada postingan untuk tagar ini yang sesuai dengan aturan visibilitas.</p>
          ) : (
            <div className="posts">
              {posts.map(p=> (
                <img key={p.id} src={Array.isArray(p.images)&&p.images[0] ? p.images[0] : p.image} alt="thumb" />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}