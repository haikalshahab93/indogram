import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import Redis from 'ioredis'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 8080
const REDIS_URL = process.env.REDIS_URL || null
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/indogram'
const redis = REDIS_URL ? new Redis(REDIS_URL) : null
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_to_a_long_random_string'

app.use(helmet())
app.use(cors({ origin: '*'}))
app.use(express.json({ limit: '2mb' }))
app.use(compression())
app.use(morgan('tiny'))
app.use(rateLimit({ windowMs: 60*1000, max: 200 }))

// Auth (optional) middleware
const issueToken = (user)=> jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '7d' })
const authOptional = (req, res, next)=>{
  const auth = req.headers.authorization || ''
  const m = auth.match(/^Bearer\s+(.+)/i)
  if(m){
    try{
      const payload = jwt.verify(m[1], JWT_SECRET)
      if(payload?.username){ req.user = { username: payload.username } }
    }catch(err){ /* ignore invalid token */ }
  }
  next()
}
app.use(authOptional)

// Mongo Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, index: true },
  nameid: { type: String, default: '', index: true },
  name: { type: String, default: '' },
  avatar: { type: String, default: '' },
  passwordHash: { type: String, default: null },
  following: { type: [String], default: [] },
}, { timestamps: true })
const PostSchema = new mongoose.Schema({
  images: { type: [String], default: [] },
  caption: String,
  tags: { type: [String], default: [] },
  createdAt: { type: Number, default: ()=> Date.now() },
  likes: { type: Number, default: 0 },
  liked: { type: Boolean, default: false },
  comments: { type: [{ id: String, text: String, createdAt: Number, author: { username: String } }], default: [] },
  author: { username: { type: String, index: true } },
}, { timestamps: true })
const FollowersSchema = new mongoose.Schema({
  username: { type: String, unique: true, index: true },
  followers: { type: [String], default: [] },
}, { timestamps: true })

const NotificationSchema = new mongoose.Schema({
  username: { type: String, index: true }, // receiver
  type: { type: String, default: '' }, // e.g. group_invite, group_invite_accepted, group_invite_declined
  data: { type: Object, default: {} },
  createdAt: { type: Number, default: ()=> Date.now() },
  unread: { type: Boolean, default: true },
}, { timestamps: true })

const User = mongoose.model('User', UserSchema)
const Post = mongoose.model('Post', PostSchema)
const Followers = mongoose.model('Followers', FollowersSchema)
const Notification = mongoose.model('Notification', NotificationSchema)

// Helpers
const extractTags = (caption)=>{
  if(!caption) return []
  const matches = caption.match(/#([\w\-]+)/g) || []
  return matches.map(t=> t.replace(/^#/, ''))
}
const toPostDTO = (p)=> ({
  id: p._id.toString(),
  images: p.images,
  image: p.images?.[0],
  caption: p.caption,
  tags: p.tags,
  createdAt: p.createdAt,
  likes: p.likes||0,
  liked: !!p.liked,
  comments: p.comments||[],
  author: { username: p.author?.username }
})
const getTrendingTagsDB = async ()=>{
  const posts = await Post.find({}, { tags: 1 }).lean()
  const counts = new Map()
  posts.forEach(p=> (p.tags||[]).forEach(t=> counts.set(t, (counts.get(t)||0)+1)))
  const arr = Array.from(counts.entries()).map(([tag,count])=>({tag,count}))
  arr.sort((a,b)=> b.count - a.count || a.tag.localeCompare(b.tag))
  return arr
}

// Users
app.get('/api/users/:username', async (req,res,next)=>{
  const { username } = req.params
  // Avoid route conflict: let /api/users/search hit the dedicated search handler
  if(username === 'search') return next()
  let user = await User.findOne({ username }).lean()
  if(!user){ user = await User.create({ username, name: username, following: [] }) }
  const me = req.user?.username || req.query.me || 'Indogrammer'
  if(me !== username){
    const meDoc = await User.findOne({ username: me }, { following: 1 }).lean()
    const theyDoc = await Followers.findOne({ username }, { followers: 1 }).lean()
    const isMutual = (meDoc?.following||[]).includes(username) && (theyDoc?.followers||[]).includes(me)
    if(!isMutual) return res.status(403).json({ error: 'not_allowed' })
  }
  res.json({ username: user.username, name: user.name||user.username, following: user.following||[] })
})
app.post('/api/users/:username/follow', async (req,res)=>{
  const { username } = req.params
  const me = (req.body?.me||'Indogrammer')
  if(me === username) return res.status(400).json({ error: 'cannot_follow_self' })
  const user = await User.findOneAndUpdate(
    { username: me },
    { $addToSet: { following: username } },
    { upsert: true, new: true }
  )
  await Followers.updateOne(
    { username },
    { $addToSet: { followers: me } },
    { upsert: true }
  )
  res.json({ ok: true, following: user.following||[] })
})
app.post('/api/users/:username/unfollow', async (req,res)=>{
  const { username } = req.params
  const me = (req.body?.me||'Indogrammer')
  const user = await User.findOneAndUpdate(
    { username: me },
    { $pull: { following: username } },
    { new: true }
  )
  await Followers.updateOne(
    { username },
    { $pull: { followers: me } }
  )
  res.json({ ok: true, following: user?.following||[] })
})
app.get('/api/users/:username/stats', async (req,res)=>{
  const { username } = req.params
  const me = req.user?.username || req.query.me || 'Indogrammer'
  if(me !== username){
    const meDoc = await User.findOne({ username: me }, { following: 1 }).lean()
    const theyDoc = await Followers.findOne({ username }, { followers: 1 }).lean()
    const isMutual = (meDoc?.following||[]).includes(username) && (theyDoc?.followers||[]).includes(me)
    if(!isMutual) return res.status(403).json({ error: 'not_allowed' })
  }
  const user = await User.findOne({ username }).lean()
  const followersDoc = await Followers.findOne({ username }).lean()
  res.json({ followers: (followersDoc?.followers||[]).length, following: (user?.following||[]).length })
})
app.post('/api/users/:old/rename', async (req,res)=>{
  const { old } = req.params
  const to = (req.body?.to||'').trim()
  if(!to) return res.status(400).json({ error: 'to_required' })
  if(old === to) return res.json({ ok: true, username: to })
  const exists = await User.findOne({ username: to }).lean()
  if(exists) return res.status(400).json({ error: 'username_taken' })
  const user = await User.findOne({ username: old })
  if(!user) return res.status(404).json({ error: 'user_not_found' })
  user.username = to
  await user.save()
  // Update posts author usernames
  await Post.updateMany({ 'author.username': old }, { $set: { 'author.username': to } })
  // Update comments author usernames
  await Post.updateMany(
    { 'comments.author.username': old },
    { $set: { 'comments.$[c].author.username': to } },
    { arrayFilters: [ { 'c.author.username': old } ] }
  )
  // Update Followers doc key
  await Followers.updateOne({ username: old }, { $set: { username: to } }, { upsert: true })
  // Replace occurrences in followers arrays
  const affectedFollowers = await Followers.find({ followers: old }).lean()
  await Promise.all(affectedFollowers.map(doc=> Followers.updateOne({ _id: doc._id }, { $addToSet: { followers: to } })))
  await Followers.updateMany({ followers: old }, { $pull: { followers: old } })
  // Replace occurrences in Users.following arrays
  const affectedUsers = await User.find({ following: old }).lean()
  await Promise.all(affectedUsers.map(u=> User.updateOne({ _id: u._id }, { $addToSet: { following: to } })))
  await User.updateMany({ following: old }, { $pull: { following: old } })
  res.json({ ok: true, username: to })
})

// Posts
app.get('/api/posts', async (req,res)=>{
  const filter = req.query.filter || 'all'
  const me = req.user?.username || req.query.me || 'Indogrammer'
  const followingSet = new Set((await User.findOne({ username: me }).lean())?.following||[])
  // mutual follow set: only include authors that also follow me
  const followingArr = Array.from(followingSet)
  const mutualDocs = followingArr.length ? await Followers.find({ username: { $in: followingArr }, followers: me }).lean() : []
  const mutualSet = new Set(mutualDocs.map(d=> d.username))
  const q = filter === 'following' ? { $or: [ { 'author.username': me }, { 'author.username': { $in: Array.from(mutualSet) } } ] } : {}
  const posts = await Post.find(q).sort({ createdAt: -1 }).lean()
  res.json(posts.map(toPostDTO))
})
app.get('/api/users/:username/posts', async (req,res)=>{
  const { username } = req.params
  const me = req.user?.username || req.query.me || 'Indogrammer'
  if(me !== username){
    const meDoc = await User.findOne({ username: me }, { following: 1 }).lean()
    const theyDoc = await Followers.findOne({ username }, { followers: 1 }).lean()
    const isMutual = (meDoc?.following||[]).includes(username) && (theyDoc?.followers||[]).includes(me)
    if(!isMutual) return res.status(403).json({ error: 'not_allowed' })
  }
  const posts = await Post.find({ 'author.username': username }).sort({ createdAt: -1 }).lean()
  res.json(posts.map(toPostDTO))
})
app.get('/api/tags/:tag/posts', async (req,res)=>{
  const { tag } = req.params
  const posts = await Post.find({ tags: tag }).sort({ createdAt: -1 }).lean()
  res.json(posts.map(toPostDTO))
})
app.get('/api/tags/trending', async (req,res)=>{
  if(redis){
    const key = 'indogram:trending'
    try{
      const cache = await redis.get(key)
      if(cache) return res.json(JSON.parse(cache))
      const data = await getTrendingTagsDB()
      await redis.set(key, JSON.stringify(data), 'EX', 60)
      return res.json(data)
    }catch(err){ return res.status(500).json({ error: 'redis_error', detail: String(err) }) }
  } else {
    const data = await getTrendingTagsDB()
    res.json(data)
  }
})
app.post('/api/posts', async (req,res)=>{
  const { images, caption, author } = req.body || {}
  if(!Array.isArray(images) || images.length === 0) return res.status(400).json({ error: 'images_required' })
  const tags = extractTags(caption)
  const post = await Post.create({ images, caption, tags, createdAt: Date.now(), likes: 0, liked: false, comments: [], author: { username: author?.username || req.user?.username || 'Indogrammer' } })
  res.status(201).json(toPostDTO(post))
})
app.post('/api/posts/:id/like', async (req,res)=>{
  const { id } = req.params
  const post = await Post.findById(id)
  if(!post) return res.status(404).json({ error: 'not_found' })
  post.liked = !post.liked
  post.likes = post.liked ? (post.likes||0)+1 : Math.max(0, (post.likes||0)-1)
  await post.save()
  res.json(toPostDTO(post))
})
app.post('/api/posts/:id/comments', async (req,res)=>{
  const { id } = req.params
  const { text, author } = req.body || {}
  if(!text?.trim()) return res.status(400).json({ error: 'text_required' })
  const post = await Post.findById(id)
  if(!post) return res.status(404).json({ error: 'not_found' })
  const c = { id: String(Date.now()), text: text.trim(), createdAt: Date.now(), author: { username: author?.username || req.user?.username || 'Indogrammer' } }
  post.comments = [...(post.comments||[]), c]
  await post.save()
  res.status(201).json(c)
})
app.delete('/api/posts/:id', async (req,res)=>{
  const { id } = req.params
  const deleted = await Post.findByIdAndDelete(id)
  if(!deleted) return res.status(404).json({ error: 'not_found' })
  res.json({ ok: true })
})

// Health
app.get('/health', (req,res)=> res.json({ ok: true }))

// Bootstrap
mongoose.connect(MONGO_URL).then(()=>{
  app.listen(PORT, ()=>{
    console.log(`Indogram backend running on http://localhost:${PORT}`)
  })
}).catch(err=>{
  console.error('Mongo connection error', err)
  process.exit(1)
})

// Auth Endpoints
app.post('/api/auth/register', async (req,res)=>{
  const { username, password, nameid, name, avatar } = req.body || {}
  const uname = (username||'').trim()
  if(!uname) return res.status(400).json({ error: 'username_required' })
  if(!password || String(password).length < 6) return res.status(400).json({ error: 'weak_password' })
  let user = await User.findOne({ username: uname })
  const hash = await bcrypt.hash(String(password), 10)
  if(user){
    if(user.passwordHash){ return res.status(400).json({ error: 'user_exists' }) }
    user.passwordHash = hash
    if(nameid && !user.nameid) user.nameid = String(nameid).trim() || uname
    if(name && !user.name) user.name = String(name).trim() || uname
    if(avatar && !user.avatar) user.avatar = String(avatar)
    await user.save()
  } else {
    user = await User.create({ username: uname, nameid: (nameid||uname), name: (name||uname), avatar: (avatar||''), passwordHash: hash, following: [] })
  }
  const token = issueToken(user)
  res.status(201).json({ ok: true, token, user: { username: user.username, nameid: user.nameid||'', name: user.name||user.username, avatar: user.avatar||'' } })
})
app.post('/api/auth/login', async (req,res)=>{
  const { username, password } = req.body || {}
  const uname = (username||'').trim()
  if(!uname || !password) return res.status(400).json({ error: 'credentials_required' })
  const user = await User.findOne({ username: uname })
  if(!user || !user.passwordHash) return res.status(404).json({ error: 'user_not_found' })
  const ok = await bcrypt.compare(String(password), user.passwordHash)
  if(!ok) return res.status(400).json({ error: 'invalid_credentials' })
  const token = issueToken(user)
  res.json({ ok: true, token, user: { username: user.username, nameid: user.nameid||'', name: user.name||user.username, avatar: user.avatar||'' } })
})
app.get('/api/auth/me', async (req,res)=>{
  if(!req.user?.username) return res.status(401).json({ error: 'unauthorized' })
  const user = await User.findOne({ username: req.user.username }).lean()
  if(!user) return res.status(404).json({ error: 'user_not_found' })
  res.json({ username: user.username, name: user.name||user.username, nameid: user.nameid||'', avatar: user.avatar||'', following: user.following||[] })
})

// Update users endpoints me resolution
app.post('/api/users/:old/rename', async (req,res)=>{
  const { old } = req.params
  const to = (req.body?.to||'').trim()
  if(!to) return res.status(400).json({ error: 'to_required' })
  if(old === to) return res.json({ ok: true, username: to })
  const exists = await User.findOne({ username: to }).lean()
  if(exists) return res.status(400).json({ error: 'username_taken' })
  const user = await User.findOne({ username: old })
  if(!user) return res.status(404).json({ error: 'user_not_found' })
  user.username = to
  await user.save()
  // Update posts author usernames
  await Post.updateMany({ 'author.username': old }, { $set: { 'author.username': to } })
  // Update comments author usernames
  await Post.updateMany(
    { 'comments.author.username': old },
    { $set: { 'comments.$[c].author.username': to } },
    { arrayFilters: [ { 'c.author.username': old } ] }
  )
  // Update Followers doc key
  await Followers.updateOne({ username: old }, { $set: { username: to } }, { upsert: true })
  // Replace occurrences in followers arrays
  const affectedFollowers = await Followers.find({ followers: old }).lean()
  await Promise.all(affectedFollowers.map(doc=> Followers.updateOne({ _id: doc._id }, { $addToSet: { followers: to } })))
  await Followers.updateMany({ followers: old }, { $pull: { followers: old } })
  // Replace occurrences in Users.following arrays
  const affectedUsers = await User.find({ following: old }).lean()
  await Promise.all(affectedUsers.map(u=> User.updateOne({ _id: u._id }, { $addToSet: { following: to } })))
  await User.updateMany({ following: old }, { $pull: { following: old } })
  res.json({ ok: true, username: to })
})
app.get('/api/users/search', async (req,res)=>{
  const q = (req.query?.nameid||'').trim()
  if(!q) return res.json([])
  const me = req.user?.username || req.query.me || 'Indogrammer'
  const escaped = q.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'i')
  const users = await User.find({ nameid: regex }, { username: 1, nameid: 1, avatar: 1 }).limit(20).lean()
  const meDoc = await User.findOne({ username: me }, { following: 1 }).lean()
  const myFollowing = new Set(meDoc?.following||[])
  const results = await Promise.all(users.map(async (u)=>{
    const fDoc = await Followers.findOne({ username: u.username }, { followers: 1 }).lean()
    const isFollowing = myFollowing.has(u.username)
    const isFollower = (fDoc?.followers||[]).includes(me)
    const isMutual = isFollowing && isFollower
    return { username: u.username, name: u.nameid||u.username, nameid: u.nameid||'', avatar: u.avatar||'', isFollowing, isMutual }
  }))
  res.json(results)
})
// Groups Schema & Model
const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  admins: { type: [String], default: [] },
  members: { type: [String], default: [] },
  locked: { type: Boolean, default: false },
  messages: { type: [{ id: String, text: String, createdAt: Number, author: { username: String } }], default: [] },
  invites: { type: [{ username: String, invitedBy: String, status: String, createdAt: Number }], default: [] },
}, { timestamps: true })
const Group = mongoose.model('Group', GroupSchema)

const toGroupDTO = (g)=> ({
  id: g._id.toString(),
  name: g.name,
  locked: !!g.locked,
  admins: g.admins||[],
  members: g.members||[],
  messages: g.messages||[],
})
// Groups Endpoints
app.get('/api/groups', async (req,res)=>{
  const me = req.user?.username || req.query.me || 'Indogrammer'
  const groups = await Group.find({ $or: [ { members: me }, { admins: me } ] }).sort({ updatedAt: -1 }).lean()
  res.json(groups.map(toGroupDTO))
})
app.post('/api/groups', async (req,res)=>{
  const me = req.user?.username || req.body?.me || 'Indogrammer'
  const { name, locked } = req.body || {}
  const n = (name||'').trim()
  if(!n) return res.status(400).json({ error: 'name_required' })
  const g = await Group.create({ name: n, admins: [me], members: [me], locked: !!locked, messages: [] })
  res.status(201).json(toGroupDTO(g))
})
app.get('/api/groups/:id', async (req,res)=>{
  const me = req.user?.username || req.query.me || 'Indogrammer'
  const g = await Group.findById(req.params.id).lean()
  if(!g) return res.status(404).json({ error: 'not_found' })
  const isMember = (g.members||[]).includes(me) || (g.admins||[]).includes(me)
  if(!isMember) return res.status(403).json({ error: 'not_allowed' })
  const dto = {
    id: g._id.toString(),
    name: g.name,
    locked: !!g.locked,
    admins: g.admins||[],
    members: g.members||[],
    messages: g.messages||[],
    invites: (g.admins||[]).includes(me) ? (g.invites||[]) : (g.invites||[]).filter(i=> i.username===me)
  }
  res.json(dto)
})
app.post('/api/groups/:id/invite', async (req,res)=>{
  const me = req.user?.username || req.body?.me || 'Indogrammer'
  const { username } = req.body || {}
  const u = (username||'').trim()
  if(!u) return res.status(400).json({ error: 'username_required' })
  const g = await Group.findById(req.params.id)
  if(!g) return res.status(404).json({ error: 'not_found' })
  if(!(g.admins||[]).includes(me)) return res.status(403).json({ error: 'admin_only' })
  if((g.members||[]).includes(u)) return res.status(400).json({ error: 'already_member' })
  const existing = (g.invites||[]).find(i=> i.username===u && i.status==='pending')
  if(existing) return res.status(400).json({ error: 'already_invited' })
  const invite = { username: u, invitedBy: me, status: 'pending', createdAt: Date.now() }
  g.invites = [ ...(g.invites||[]), invite ]
  await g.save()
  await Notification.create({ username: u, type: 'group_invite', data: { groupId: g._id.toString(), groupName: g.name, inviter: me }, createdAt: Date.now(), unread: true })
  const updated = await Group.findById(g._id).lean()
  res.json({ ok: true, group: { id: updated._id.toString(), name: updated.name, locked: !!updated.locked, admins: updated.admins||[], members: updated.members||[], messages: updated.messages||[], invites: updated.invites||[] } })
})
app.post('/api/groups/:id/invite/respond', async (req,res)=>{
  const me = req.user?.username || req.body?.me || 'Indogrammer'
  const { action } = req.body || {}
  const g = await Group.findById(req.params.id)
  if(!g) return res.status(404).json({ error: 'not_found' })
  const inv = (g.invites||[]).find(i=> i.username===me && i.status==='pending')
  if(!inv) return res.status(404).json({ error: 'invite_not_found' })
  if(action === 'accept'){
    g.members = Array.from(new Set([ ...(g.members||[]), me ]))
    g.invites = (g.invites||[]).map(i=> i===inv ? { ...i, status: 'accepted' } : i)
    await g.save()
    await Notification.create({ username: inv.invitedBy, type: 'group_invite_accepted', data: { groupId: g._id.toString(), groupName: g.name, invitee: me }, createdAt: Date.now(), unread: true })
  } else if(action === 'decline'){
    g.invites = (g.invites||[]).map(i=> i===inv ? { ...i, status: 'declined' } : i)
    await g.save()
    await Notification.create({ username: inv.invitedBy, type: 'group_invite_declined', data: { groupId: g._id.toString(), groupName: g.name, invitee: me }, createdAt: Date.now(), unread: true })
  } else {
    return res.status(400).json({ error: 'invalid_action' })
  }
  const updated = await Group.findById(g._id).lean()
  res.json({ ok: true, group: { id: updated._id.toString(), name: updated.name, locked: !!updated.locked, admins: updated.admins||[], members: updated.members||[], messages: updated.messages||[], invites: updated.invites||[] } })
})
app.post('/api/groups/:id/messages', async (req,res)=>{
  const me = req.user?.username || req.body?.me || 'Indogrammer'
  const { text } = req.body || {}
  const t = (text||'').trim()
  if(!t) return res.status(400).json({ error: 'text_required' })
  const g = await Group.findById(req.params.id)
  if(!g) return res.status(404).json({ error: 'not_found' })
  const isMember = (g.members||[]).includes(me) || (g.admins||[]).includes(me)
  if(!isMember) return res.status(403).json({ error: 'not_allowed' })
  if(!!g.locked && !(g.admins||[]).includes(me)) return res.status(403).json({ error: 'group_locked' })
  const m = { id: String(Date.now()), text: t, createdAt: Date.now(), author: { username: me } }
  g.messages = [ ...(g.messages||[]), m ]
  await g.save()
  res.status(201).json(m)
})
app.post('/api/groups/:id/lock', async (req,res)=>{
  const me = req.user?.username || req.body?.me || 'Indogrammer'
  const { locked } = req.body || {}
  const g = await Group.findById(req.params.id)
  if(!g) return res.status(404).json({ error: 'not_found' })
  if(!(g.admins||[]).includes(me)) return res.status(403).json({ error: 'admin_only' })
  g.locked = !!locked
  await g.save()
  res.json(toGroupDTO(g))
})
app.get('/api/notifications', async (req,res)=>{
  const me = req.user?.username || req.query.me || 'Indogrammer'
  const list = await Notification.find({ username: me }).sort({ createdAt: -1 }).limit(100).lean()
  res.json(list.map(n=> ({ id: n._id.toString(), type: n.type, data: n.data||{}, createdAt: n.createdAt||Date.now(), unread: !!n.unread })))
})
app.post('/api/notifications/:id/read', async (req,res)=>{
  const { id } = req.params
  const n = await Notification.findById(id)
  if(!n) return res.status(404).json({ error: 'not_found' })
  n.unread = false
  await n.save()
  res.json({ ok: true })
})
app.post('/api/friends/invite', async (req,res)=>{
  const me = req.user?.username || req.body?.me || 'Indogrammer'
  const to = (req.body?.to||'').trim()
  if(!to) return res.status(400).json({ error: 'to_required' })
  if(me === to) return res.status(400).json({ error: 'cannot_invite_self' })
  // If already mutual followers, no need to invite
  const meDoc = await User.findOne({ username: me }, { following: 1 }).lean()
  const theyDoc = await Followers.findOne({ username: to }, { followers: 1 }).lean()
  const isMutual = (meDoc?.following||[]).includes(to) && (theyDoc?.followers||[]).includes(me)
  if(isMutual) return res.status(400).json({ error: 'already_friends' })
  // Avoid duplicate pending invites
  const existing = await Notification.findOne({ username: to, type: 'friend_invite', 'data.inviter': me, unread: true }).lean()
  if(existing) return res.status(400).json({ error: 'already_invited' })
  const notif = await Notification.create({ username: to, type: 'friend_invite', data: { inviter: me }, createdAt: Date.now(), unread: true })
  res.json({ ok: true, id: notif._id.toString() })
})
app.post('/api/friends/respond', async (req,res)=>{
  const me = req.user?.username || req.body?.me || 'Indogrammer'
  const id = (req.body?.id||'').trim()
  const action = (req.body?.action||'').trim()
  if(!id || !['accept','decline'].includes(action)) return res.status(400).json({ error: 'invalid_request' })
  const n = await Notification.findById(id)
  if(!n || n.username !== me || n.type !== 'friend_invite') return res.status(404).json({ error: 'not_found' })
  n.unread = false
  await n.save()
  const inviter = n.data?.inviter
  if(!inviter) return res.status(400).json({ error: 'invalid_invite' })
  if(action === 'accept'){
    await Notification.create({ username: inviter, type: 'friend_invite_accepted', data: { invitee: me }, createdAt: Date.now(), unread: true })
    // Mutual follow: both users follow each other
    await User.updateOne({ username: me }, { $addToSet: { following: inviter } }, { upsert: true })
    await Followers.updateOne({ username: inviter }, { $addToSet: { followers: me } }, { upsert: true })
    await User.updateOne({ username: inviter }, { $addToSet: { following: me } }, { upsert: true })
    await Followers.updateOne({ username: me }, { $addToSet: { followers: inviter } }, { upsert: true })
    return res.json({ ok: true, otherUser: inviter })
  } else {
    await Notification.create({ username: inviter, type: 'friend_invite_declined', data: { invitee: me }, createdAt: Date.now(), unread: true })
    return res.json({ ok: true })
  }
})