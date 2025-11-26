import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import './PostCard.css'
import { Link } from 'react-router-dom'

export default function PostCard({ post }){
  const { toggleLike, addComment, removePost } = useApp()
  const [text, setText] = useState('')
  const [index, setIndex] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [pulse, setPulse] = useState(false)
  const lastTapRef = useRef(0)
  const [shareCopied, setShareCopied] = useState(false)
  const inputRef = useRef(null)
  const touchStartXRef = useRef(0)
  const touchDeltaXRef = useRef(0)
  const [focused, setFocused] = useState(false)
  const MAX_LEN = 280
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false)
  const [showComment, setShowComment] = useState(false)

  useEffect(()=>{
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e)=> setIsMobile(e.matches)
    try{ mq.addEventListener('change', handler) }catch{ mq.addListener(handler) }
    return ()=>{ try{ mq.removeEventListener('change', handler) }catch{ mq.removeListener(handler) } }
  }, [])

  const submit = (e)=>{
    e.preventDefault()
    addComment(post.id, text.trim())
    setText('')
    setShowComment(false)
  }

  useEffect(()=>{
    const el = inputRef.current
    if(!el) return
    el.style.height = 'auto'
    // Clamp tinggi textarea agar tidak menutup layar di mobile
    const maxPx = Math.min(Math.floor((typeof window !== 'undefined' ? window.innerHeight : 480) * 0.35), 240)
    const nextH = Math.min(el.scrollHeight, maxPx)
    el.style.height = `${nextH}px`
  }, [text, focused])

  const onChange = (e)=>{
    const v = e.target.value
    setText(v.slice(0, MAX_LEN))
  }

  const imgs = Array.isArray(post.images) && post.images.length ? post.images : (post.image ? [post.image] : [])
  const prev = ()=> setIndex(i=> (i - 1 + imgs.length) % imgs.length)
  const next = ()=> setIndex(i=> (i + 1) % imgs.length)

  const handleImageClick = ()=>{
    const now = Date.now()
    if(now - lastTapRef.current < 300){
      lastTapRef.current = 0
      if(!post.liked) toggleLike(post.id)
      setPulse(true)
      setTimeout(()=> setPulse(false), 600)
    }else{
      // Single-tap: tidak membuka modal lagi
      lastTapRef.current = now
      setTimeout(()=>{
      // Biarkan timeout untuk membedakan double-tap, tetapi tanpa aksi single-tap
      if(Date.now() - lastTapRef.current >= 300){ /* no-op */ }
      }, 320)
    }
  }

  const onTouchStart = (e)=>{
    touchStartXRef.current = e.touches[0].clientX
  }
  const onTouchMove = (e)=>{
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current
  }
  const onTouchEnd = ()=>{
    if(Math.abs(touchDeltaXRef.current) > 50){
      if(touchDeltaXRef.current < 0) next()
      else prev()
    }
    touchStartXRef.current = 0
    touchDeltaXRef.current = 0
  }

  const handleShare = async ()=>{
    const url = `${window.location.origin}/user/${post.author?.username || ''}`
    try{
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(()=> setShareCopied(false), 1500)
    }catch(err){
      // noop
    }
  }

  return (
    <article className="post">
      <header className="post-header">
        <div className="avatar" aria-hidden="true" />
        <div className="meta">
          <strong className="author">
            <Link to={`/user/${post.author?.username || 'Indogrammer'}`}>@{post.author?.username || 'Indogrammer'}</Link>
          </strong>
          <span className="time">{new Date(post.createdAt).toLocaleString()}</span>
        </div>
      </header>

      <div className="post-image-wrap">
        {imgs.length > 1 && <button className="nav prev" onClick={prev}>‹</button>}
        <img src={imgs[index]} alt="post" className="post-image" onClick={handleImageClick} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
        {/* Ikon khusus untuk membuka modal gambar: tampil hanya saat ingin berkomentar */}
        {(focused || text.length > 0) && (
          <button className="open-modal" onClick={()=> setShowModal(true)} aria-label="Lihat gambar">
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
          </button>
        )}
        {pulse && (
          <div className="dbltap-heart">
            <svg viewBox="0 0 24 24" width="120" height="120" aria-hidden="true">
              <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 3.99 4 6.5 4c1.74 0 3.41 1.01 4.17 2.53C11.09 5.01 12.76 4 14.5 4 17.01 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        )}
        {imgs.length > 1 && <button className="nav next" onClick={next}>›</button>}
        {imgs.length > 1 && (
          <div className="dots">
            {imgs.map((_, i)=> (
              <span key={i} className={"dot" + (i === index ? " active" : "")}></span>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="image-modal" onClick={()=>setShowModal(false)} role="dialog" aria-modal="true">
          <button className="close" onClick={()=>setShowModal(false)} aria-label="Tutup">×</button>
          <div className="image-modal-content" onClick={(e)=>e.stopPropagation()}>
            {imgs.length > 1 && <button className="nav prev" onClick={prev}>‹</button>}
            <img src={imgs[index]} alt="detail" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
            {imgs.length > 1 && <button className="nav next" onClick={next}>›</button>}
            {imgs.length > 1 && (
              <div className="dots">
                {imgs.map((_, i)=> (
                  <span key={i} className={"dot" + (i === index ? " active" : "")}></span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {post.caption && (
        <p className="caption">
          {post.caption.split(/(#[\w\-]+)/g).map((part, i)=>{
            if(/^#[\w\-]+$/.test(part)){
              const tag = part.slice(1)
              return <Link key={i} to={`/explore?tag=${encodeURIComponent(tag)}`} className="tag">{part}</Link>
            }
            return <span key={i}>{part}</span>
          })}
        </p>
      )}

      <div className="actions">
        <button className={"like" + (post.liked ? ' liked' : '')} onClick={()=>toggleLike(post.id)} aria-label={post.liked ? 'Unlike' : 'Like'}>
          <span className="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 3.99 4 6.5 4c1.74 0 3.41 1.01 4.17 2.53C11.09 5.01 12.76 4 14.5 4 17.01 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
          <span className="label">{post.liked ? 'Unlike' : 'Like'}</span>
        </button>
        <button className="comment" onClick={()=> { setShowComment(true); setTimeout(()=> inputRef.current?.focus(), 0); }} aria-label="Komentar">
          <span className="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v14l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
            </svg>
          </span>
          <span className="label">Comment</span>
        </button>
        <button className={"share" + (shareCopied ? ' copied' : '')} onClick={handleShare} aria-label="Bagikan">
          <span className="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M18 8a3 3 0 1 0-2.82-4H15l-6.59 3.3a3 3 0 0 0 0 5.4L15 16h.18A3 3 0 1 0 18 14a2.98 2.98 0 0 0-2.64-2H15l-6.59-3.3a2.98 2.98 0 0 0 0-1.4L15 4h.36A3 3 0 0 0 18 8z" />
            </svg>
          </span>
          <span className="label">{shareCopied ? 'Disalin' : 'Bagikan'}</span>
        </button>
        <span className="likes"><strong>{post.likes || 0}</strong> suka</span>
        <button className="delete" onClick={()=>removePost(post.id)}>Hapus</button>
      </div>

      <div className="comments">
        {Array.isArray(post.comments) && post.comments.map(c=> (
          <div key={c.id} className="comment">
            <strong>{c.author?.username || 'User'}</strong>
            <span>{c.text}</span>
          </div>
        ))}
      </div>


      <form className="comment-form" style={{ display: showComment ? 'flex' : 'none' }} onSubmit={submit}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={onChange}
          onFocus={()=>{ setFocused(true); setShowComment(true); }}
          onBlur={()=>{ setFocused(false); if(!text.trim()) setShowComment(false); }}
          placeholder="Tulis komentar..."
          rows={1}
        />
        <div className="comment-actions">
          <span className={"char-count" + ((MAX_LEN - text.length) <= 0 ? " error" : (MAX_LEN - text.length) <= 20 ? " warn" : "")}>Sisa {MAX_LEN - text.length}</span>
          <button type="submit" disabled={!text.trim()}>
            <span className="icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
              </svg>
            </span>
            <span className="label">Kirim</span>
          </button>
          <button type="button" className="close" onClick={()=> setShowComment(false)}>
            <span className="label">Batal</span>
          </button>
        </div>
      </form>
    </article>
  )
}