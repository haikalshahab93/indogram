import './Composer.css'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import './Composer.css'

export default function Composer(){
  const [images, setImages] = useState([])
  const [caption, setCaption] = useState('')
  const { addPost } = useApp()
  const navigate = useNavigate()

  const onFile = async (e)=>{
    const files = Array.from(e.target.files || [])
    if(!files.length) return
    const readers = files.map(f=> new Promise((resolve)=>{
      const r = new FileReader()
      r.onload = ()=> resolve(r.result)
      r.readAsDataURL(f)
    }))
    const urls = await Promise.all(readers)
    setImages(urls)
  }

  const onSubmit = (e)=>{
    e.preventDefault()
    if(!images.length) return alert('Silakan pilih gambar terlebih dahulu')
    addPost({ images, caption })
    navigate('/')
  }

  return (
    <section className="composer">
      <h2>Buat Postingan</h2>
      <form className="compose-form" onSubmit={onSubmit}>
        <label className="file">
          <input type="file" accept="image/*" multiple onChange={onFile} />
          <span>Pilih Gambar</span>
        </label>
        {images.length > 0 && (
          <div className="preview-grid">
            {images.map((src, i)=> (
              <img key={i} src={src} alt={`preview-${i}`} />
            ))}
          </div>
        )}
        <textarea placeholder="Tulis caption..." value={caption} onChange={(e)=>setCaption(e.target.value)} />
        <button type="submit" className="primary">Publikasikan</button>
      </form>
    </section>
  )
}